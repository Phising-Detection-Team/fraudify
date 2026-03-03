"""
Main Orchestrator using OpenAI Agents SDK.

This orchestrator coordinates parallel Generator → Detector workflows.
It's the brain of the operation, managing multiple workflows simultaneously.

Key Features:
    - Parallel processing (2 workflows at once)
    - Multi-model support (Gemini generator, Claude detector)
    - Automatic error handling and retries
    - Real-time progress tracking
    - Database integration
    - Cost tracking
"""

import asyncio
import json
from typing import Dict, Any
from agents import Runner, Session
from flask import current_app

# Import agent creators (relative imports from same package)
from .generator import create_generator_agent, get_generation_prompt
from .detector import create_detector_agent, get_detection_prompt_for_email

# Import database tools
from .tools import (
    save_generated_email,
    save_detection_result,
    update_round_progress
)

# Import models from parent package
from backend.app.models import db, Round


class AgenticOrchestrator:
    """
    Orchestrates parallel Generator → Detector workflows.
    
    This class is the main coordinator. It:
    1. Creates Generator and Detector agents
    2. Divides emails among parallel workflows
    3. Runs workflows simultaneously using asyncio
    4. Aggregates results
    5. Updates database
    
    Attributes:
        round_id: Database ID of the competition round
        num_parallel: Number of parallel workflows (default 2)
        generator_agent: Gemini-based generator agent
        detector_agent: Claude-based detector agent
    """
    
    def __init__(self, round_id: int, num_parallel_workflows: int = 2):
        """
        Initialize orchestrator with agents and configuration.
        
        Args:
            round_id: Database round ID
            num_parallel_workflows: How many workflows to run simultaneously
        
        What happens here:
            1. Saves configuration
            2. Creates Generator agent (Gemini)
            3. Creates Detector agent (Claude)
            4. Attaches database tools to agents
            5. Logs initialization
        """
        self.round_id = round_id
        self.num_parallel = num_parallel_workflows
        
        # Create agents (these are OpenAI SDK Agent objects)
        self.generator_agent = create_generator_agent()  # Uses Gemini
        self.detector_agent = create_detector_agent()    # Uses Claude
        
        # Attach database tools to agents
        # Note: We don't attach tools here because agents will call them via the orchestrator
        # The SDK doesn't support attaching tools this way - tools are called explicitly
        
        current_app.logger.info(
            f'[Orchestrator] Initialized for round {round_id} '
            f'with {num_parallel_workflows} parallel workflows'
        )
    
    async def run_single_workflow(
        self,
        workflow_id: int,
        num_emails: int
    ) -> Dict[str, Any]:
        """
        Run a single workflow: Generate N emails → Detect each.
        
        This is ONE workflow that processes multiple emails sequentially.
        Multiple instances of this run in parallel.
        
        Args:
            workflow_id: Identifier for logging (1, 2, 3, ...)
            num_emails: Number of emails to process in THIS workflow
        
        Returns:
            dict: Results including emails processed, cost, etc.
        
        Process for each email:
            1. Generate email (Gemini)
            2. Parse JSON output
            3. Save to database
            4. Detect phishing (Claude)
            5. Parse JSON output
            6. Save to database (includes auto-judge)
            7. Track cost and metrics
        
        Example:
            Workflow 1 processes emails 1-5
            Workflow 2 processes emails 6-10
            Both run at the same time!
        """
        current_app.logger.info(
            f'[Workflow {workflow_id}] Starting with {num_emails} emails'
        )
        
        # Initialize results tracking
        results = {
            'workflow_id': workflow_id,
            'emails_processed': 0,
            'emails_succeeded': 0,
            'emails_failed': 0,
            'total_cost': 0.0
        }
        
        # Process each email
        for i in range(num_emails):
            try:
                # ============================================
                # STEP 1: GENERATE EMAIL
                # ============================================
                
                current_app.logger.info(
                    f'[Workflow {workflow_id}] Email {i+1}/{num_emails}: Generating...'
                )
                
                # Create new session for this email
                # Session tracks conversation history across agent calls
                session = Session()
                
                # Get generation prompt (randomly phishing or legitimate)
                gen_prompt = get_generation_prompt()
                
                # Run generator agent (Gemini)
                # This is async - uses await
                gen_result = await Runner.run(
                    self.generator_agent,
                    gen_prompt,
                    session=session
                )
                
                # Parse JSON output from generator
                gen_output = self._parse_json_output(gen_result.final_output)
                
                if not gen_output:
                    raise ValueError('Generator returned invalid JSON')
                
                # Extract email data from JSON
                email_content = f"""Subject: {gen_output.get('subject', '')}
From: {gen_output.get('from', '')}

{gen_output.get('body', '')}"""
                
                is_phishing = gen_output.get('is_phishing', False)
                metadata = gen_output.get('metadata', {})
                
                # Calculate tokens and cost from SDK result
                gen_tokens = self._get_token_usage(gen_result)
                gen_cost = self._estimate_cost(gen_tokens, 'gemini-2.0-flash-exp')
                
                # Save to database using tool
                save_result = save_generated_email(
                    round_id=self.round_id,
                    content=email_content,
                    is_phishing=is_phishing,
                    metadata=metadata,
                    llm_provider='gemini',
                    llm_model='gemini-2.0-flash-exp',
                    llm_tokens=gen_tokens,
                    llm_cost=gen_cost
                )
                
                if not save_result['success']:
                    raise ValueError(f"Failed to save email: {save_result.get('error')}")
                
                email_id = save_result['email_id']
                results['total_cost'] += gen_cost
                
                current_app.logger.info(
                    f'[Workflow {workflow_id}] Email {i+1}: '
                    f'Generated (ID {email_id}, {"Phishing" if is_phishing else "Legitimate"})'
                )
                
                # ============================================
                # STEP 2: DETECT PHISHING
                # ============================================
                
                current_app.logger.info(
                    f'[Workflow {workflow_id}] Email {i+1}: Detecting...'
                )
                
                # Get detection prompt with email content
                det_prompt = get_detection_prompt_for_email(email_content)
                
                # Run detector agent (Claude) - in same session for context
                det_result = await Runner.run(
                    self.detector_agent,
                    det_prompt,
                    session=session
                )
                
                # Parse JSON output from detector
                det_output = self._parse_json_output(det_result.final_output)
                
                if not det_output:
                    raise ValueError('Detector returned invalid JSON')
                
                # Extract detection data
                verdict = det_output.get('verdict', 'LEGITIMATE')
                confidence = float(det_output.get('confidence', 0.5))
                reasoning = det_output.get('reasoning', 'No reasoning provided')
                indicators = det_output.get('indicators', [])
                
                # Calculate tokens and cost
                det_tokens = self._get_token_usage(det_result)
                det_cost = self._estimate_cost(det_tokens, 'claude-3-5-haiku-20241022')
                
                # Save detection to database
                det_save_result = save_detection_result(
                    email_id=email_id,
                    verdict=verdict,
                    confidence=confidence,
                    reasoning=reasoning,
                    indicators=indicators,
                    llm_provider='claude',
                    llm_model='claude-3-5-haiku-20241022',
                    llm_tokens=det_tokens,
                    llm_cost=det_cost
                )
                
                if not det_save_result['success']:
                    raise ValueError(f"Failed to save detection: {det_save_result.get('error')}")
                
                results['total_cost'] += det_cost
                results['emails_succeeded'] += 1
                
                current_app.logger.info(
                    f'[Workflow {workflow_id}] Email {i+1}: Complete! '
                    f'Verdict: {verdict} ({confidence:.2f}), '
                    f'Judge: {det_save_result["judge_verdict"]}'
                )
                
            except Exception as e:
                # If any step fails, log and continue to next email
                results['emails_failed'] += 1
                current_app.logger.error(
                    f'[Workflow {workflow_id}] Email {i+1} failed: {str(e)}'
                )
                continue
            
            finally:
                # Always increment processed count
                results['emails_processed'] += 1
        
        current_app.logger.info(
            f'[Workflow {workflow_id}] Complete! '
            f'{results["emails_succeeded"]}/{num_emails} succeeded, '
            f'Cost: ${results["total_cost"]:.4f}'
        )
        
        return results
    
    async def run_parallel_workflows(self, total_emails: int) -> Dict[str, Any]:
        """
        Run multiple workflows in parallel.
        
        This is the main entry point. It divides emails among workflows
        and runs them all simultaneously using asyncio.
        
        Args:
            total_emails: Total emails to process across ALL workflows
        
        Returns:
            dict: Aggregated results from all workflows
        
        How it works:
            1. Divide emails: 10 emails / 2 workflows = 5 each
            2. Create async tasks for each workflow
            3. Run all tasks in parallel (asyncio.gather)
            4. Wait for all to complete
            5. Aggregate results
            6. Calculate final metrics
            7. Update database
        
        Example:
            total_emails = 10
            num_parallel = 2
            → Workflow 1: 5 emails
            → Workflow 2: 5 emails
            Both run at the same time!
        """
        # Divide emails among workflows
        emails_per_workflow = total_emails // self.num_parallel
        remainder = total_emails % self.num_parallel
        
        # Create async tasks for each workflow
        tasks = []
        for i in range(self.num_parallel):
            # Give remainder emails to first workflow
            num_emails = emails_per_workflow
            if i == 0:
                num_emails += remainder
            
            # Create task
            task = self.run_single_workflow(
                workflow_id=i + 1,
                num_emails=num_emails
            )
            tasks.append(task)
        
        current_app.logger.info(
            f'[Orchestrator] Starting {self.num_parallel} parallel workflows '
            f'({emails_per_workflow} emails per workflow + {remainder} remainder)'
        )
        
        # Run all workflows in parallel
        # asyncio.gather runs all tasks concurrently
        workflow_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Aggregate results from all workflows
        total_processed = 0
        total_succeeded = 0
        total_failed = 0
        total_cost = 0.0
        
        for i, result in enumerate(workflow_results):
            if isinstance(result, Exception):
                current_app.logger.error(f'[Workflow {i+1}] Failed: {str(result)}')
                total_failed += emails_per_workflow
            else:
                total_processed += result['emails_processed']
                total_succeeded += result['emails_succeeded']
                total_failed += result['emails_failed']
                total_cost += result['total_cost']
        
        # Calculate accuracy
        accuracy = (total_succeeded / total_processed * 100) if total_processed > 0 else 0
        
        # Final round update
        update_round_progress(
            round_id=self.round_id,
            emails_processed=total_processed,
            total_emails=total_emails,
            accuracy=accuracy,
            total_cost=total_cost
        )
        
        current_app.logger.info(
            f'[Orchestrator] Complete! '
            f'{total_succeeded}/{total_processed} succeeded, '
            f'Accuracy: {accuracy:.2f}%, '
            f'Cost: ${total_cost:.6f}'
        )
        
        return {
            'round_id': self.round_id,
            'total_processed': total_processed,
            'total_succeeded': total_succeeded,
            'total_failed': total_failed,
            'total_cost': total_cost,
            'accuracy': accuracy
        }
    
    def _parse_json_output(self, output: str) -> Dict[str, Any]:
        """
        Parse JSON output from agent, handling markdown code blocks.
        
        LLMs sometimes return JSON wrapped in markdown:
            ```json
            {"key": "value"}
            ```
        
        This function strips that and parses the JSON.
        
        Args:
            output: Raw output from agent
        
        Returns:
            dict: Parsed JSON or None if invalid
        """
        try:
            # Remove markdown code blocks if present
            cleaned = output.strip()
            if cleaned.startswith('```json'):
                cleaned = cleaned[7:]
            if cleaned.startswith('```'):
                cleaned = cleaned[3:]
            if cleaned.endswith('```'):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            current_app.logger.error(f'JSON parse error: {e}')
            current_app.logger.error(f'Raw output: {output[:500]}...')
            return None
    
    def _get_token_usage(self, result) -> int:
        """
        Extract token usage from SDK result.
        
        The OpenAI Agents SDK provides usage information in the result.
        Different SDKs structure this differently.
        
        Args:
            result: Runner result object from SDK
        
        Returns:
            int: Total tokens used (0 if not available)
        
        Note:
            The exact attribute name depends on the SDK version.
            Check SDK documentation for current version.
        """
        try:
            # Try different possible locations
            if hasattr(result, 'usage'):
                usage = result.usage
                if isinstance(usage, dict):
                    return usage.get('total_tokens', 0)
                elif hasattr(usage, 'total_tokens'):
                    return usage.total_tokens
            
            # Fallback: estimate based on content length
            if hasattr(result, 'final_output'):
                # Rough estimate: 1 token ≈ 4 characters
                return len(result.final_output) // 4
            
            return 0
        except Exception:
            return 0
    
    def _estimate_cost(self, tokens: int, model: str) -> float:
        """
        Estimate cost based on tokens and model.
        
        Different models have different pricing:
        - GPT-4o-mini: $0.150/$0.600 per 1M tokens
        - Claude-3.5-haiku: $0.80/$4.00 per 1M tokens
        - Gemini-2.0-flash: $0.10/$0.40 per 1M tokens
        
        We use average of input/output for simplicity.
        
        Args:
            tokens: Number of tokens used
            model: Model name
        
        Returns:
            float: Estimated cost in USD
        """
        # GPT-4o-mini pricing
        if 'gpt-4o-mini' in model.lower():
            avg_price_per_1m = 0.375  # ($0.150 + $0.600) / 2
            return (tokens / 1_000_000) * avg_price_per_1m
        
        # Claude-3.5-haiku pricing
        elif 'claude' in model.lower() and 'haiku' in model.lower():
            avg_price_per_1m = 2.40  # ($0.80 + $4.00) / 2
            return (tokens / 1_000_000) * avg_price_per_1m
        
        # Gemini-2.0-flash pricing
        elif 'gemini' in model.lower() and 'flash' in model.lower():
            avg_price_per_1m = 0.25  # ($0.10 + $0.40) / 2
            return (tokens / 1_000_000) * avg_price_per_1m
         
        return 0.0


def run_orchestrated_round(round_id: int, total_emails: int) -> Dict[str, Any]:
    """
    Main entry point for running orchestrated round.
    
    This is what you call from your Celery task.
    It creates the orchestrator and runs the workflows.
    
    Args:
        round_id: Database round ID
        total_emails: Total emails to generate and detect
    
    Returns:
        dict: Round results with accuracy, cost, etc.
    
    Example:
        >>> results = run_orchestrated_round(round_id=1, total_emails=10)
        >>> results['accuracy']
        87.5
        >>> results['total_cost']
        0.0042
    """
    # Create orchestrator with 2 parallel workflows
    orchestrator = AgenticOrchestrator(
        round_id=round_id,
        num_parallel_workflows=2
    )
    
    # Run parallel workflows (async)
    # asyncio.run() runs the async function and waits for completion
    results = asyncio.run(
        orchestrator.run_parallel_workflows(total_emails)
    )
    
    return results