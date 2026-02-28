"""
Main Orchestrator using OpenAI Agents SDK.

Manages parallel workflows: Generator → Detector pipelines.
"""

import asyncio
import json
from typing import Dict, Any, List
from agents import Runner, Session
from flask import current_app

from .generator import create_generator_agent, get_generation_prompt
from .detector import create_detector_agent, get_detection_prompt_for_email
from .tools import (
    save_generated_email,
    save_detection_result,
    update_round_progress
)
from app.models import db, Round


class AgenticOrchestrator:
    """
    Orchestrates parallel Generator → Detector workflows.
    
    Features:
    - Runs 2 workflows simultaneously
    - Tracks progress in real-time
    - Saves all results to database
    - Handles errors gracefully
    """
    
    def __init__(self, round_id: int, num_parallel_workflows: int = 2):
        """
        Initialize orchestrator.
        
        Args:
            round_id: Database round ID
            num_parallel_workflows: Number of parallel workflows (default 2)
        """
        self.round_id = round_id
        self.num_parallel = num_parallel_workflows
        
        # Create agents
        self.generator_agent = create_generator_agent()
        self.detector_agent = create_detector_agent()
        
        # Add database tools to agents
        self.generator_agent.tools = [save_generated_email]
        self.detector_agent.tools = [save_detection_result]
        
        current_app.logger.info(
            f'Orchestrator initialized for round {round_id} '
            f'with {num_parallel_workflows} parallel workflows'
        )
    
    async def run_single_workflow(
        self,
        workflow_id: int,
        num_emails: int
    ) -> Dict[str, Any]:
        """
        Run a single workflow: Generate N emails → Detect each.
        
        Args:
            workflow_id: Identifier for this workflow (1, 2, etc.)
            num_emails: Number of emails to process in this workflow
        
        Returns:
            dict: Workflow results
        """
        current_app.logger.info(
            f'[Workflow {workflow_id}] Starting {num_emails} emails'
        )
        
        results = {
            'workflow_id': workflow_id,
            'emails_processed': 0,
            'emails_succeeded': 0,
            'emails_failed': 0,
            'total_cost': 0.0
        }
        
        for i in range(num_emails):
            try:
                # ============================================
                # STEP 1: GENERATE EMAIL
                # ============================================
                
                current_app.logger.info(
                    f'[Workflow {workflow_id}] Email {i+1}/{num_emails}: Generating...'
                )
                
                # Create new session for each email
                session = Session()
                
                # Get generation prompt
                gen_prompt = get_generation_prompt()
                
                # Run generator agent
                gen_result = await Runner.run(
                    self.generator_agent,
                    gen_prompt,
                    session=session
                )
                
                # Parse generator output
                gen_output = self._parse_json_output(gen_result.final_output)
                
                if not gen_output:
                    raise ValueError('Generator returned invalid JSON')
                
                # Extract data
                email_content = f"""Subject: {gen_output.get('subject', '')}
From: {gen_output.get('from', '')}

{gen_output.get('body', '')}"""
                
                is_phishing = gen_output.get('is_phishing', False)
                metadata = gen_output.get('metadata', {})
                
                # Calculate tokens/cost from SDK trace
                gen_tokens = self._get_token_usage(gen_result)
                gen_cost = self._estimate_cost(gen_tokens, 'gpt-4o-mini')
                
                # Save to database using tool
                save_result = save_generated_email(
                    round_id=self.round_id,
                    content=email_content,
                    is_phishing=is_phishing,
                    metadata=metadata,
                    llm_provider='gpt',
                    llm_model='gpt-4o-mini',
                    llm_tokens=gen_tokens,
                    llm_cost=gen_cost
                )
                
                if not save_result['success']:
                    raise ValueError(f"Failed to save email: {save_result.get('error')}")
                
                email_id = save_result['email_id']
                results['total_cost'] += gen_cost
                
                current_app.logger.info(
                    f'[Workflow {workflow_id}] Email {i+1}: Generated (ID {email_id})'
                )
                
                # ============================================
                # STEP 2: DETECT PHISHING
                # ============================================
                
                current_app.logger.info(
                    f'[Workflow {workflow_id}] Email {i+1}: Detecting...'
                )
                
                # Get detection prompt
                det_prompt = get_detection_prompt_for_email(email_content)
                
                # Run detector agent (in same session for context)
                det_result = await Runner.run(
                    self.detector_agent,
                    det_prompt,
                    session=session
                )
                
                # Parse detector output
                det_output = self._parse_json_output(det_result.final_output)
                
                if not det_output:
                    raise ValueError('Detector returned invalid JSON')
                
                # Extract detection data
                verdict = det_output.get('verdict', 'legitimate')
                confidence = float(det_output.get('confidence', 0.5))
                reasoning = det_output.get('reasoning', 'No reasoning provided')
                indicators = det_output.get('indicators', [])
                
                # Calculate tokens/cost
                det_tokens = self._get_token_usage(det_result)
                det_cost = self._estimate_cost(det_tokens, 'gpt-4o-mini')
                
                # Save detection to database
                det_save_result = save_detection_result(
                    email_id=email_id,
                    verdict=verdict,
                    confidence=confidence,
                    reasoning=reasoning,
                    indicators=indicators,
                    llm_provider='gpt',
                    llm_model='gpt-4o-mini',
                    llm_tokens=det_tokens,
                    llm_cost=det_cost
                )
                
                if not det_save_result['success']:
                    raise ValueError(f"Failed to save detection: {det_save_result.get('error')}")
                
                results['total_cost'] += det_cost
                results['emails_succeeded'] += 1
                
                current_app.logger.info(
                    f'[Workflow {workflow_id}] Email {i+1}: Complete! '
                    f'Verdict: {verdict} (Confidence: {confidence:.2f})'
                )
                
            except Exception as e:
                results['emails_failed'] += 1
                current_app.logger.error(
                    f'[Workflow {workflow_id}] Email {i+1} failed: {str(e)}'
                )
                continue
            
            finally:
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
        
        Args:
            total_emails: Total emails to process across all workflows
        
        Returns:
            dict: Combined results from all workflows
        """
        # Divide emails among workflows
        emails_per_workflow = total_emails // self.num_parallel
        remainder = total_emails % self.num_parallel
        
        # Create tasks for each workflow
        tasks = []
        for i in range(self.num_parallel):
            # Give remainder emails to first workflow
            num_emails = emails_per_workflow + (1 if i == 0 and remainder > 0 else 0)
            
            task = self.run_single_workflow(
                workflow_id=i + 1,
                num_emails=num_emails
            )
            tasks.append(task)
        
        current_app.logger.info(
            f'Starting {self.num_parallel} parallel workflows '
            f'({emails_per_workflow} emails each)'
        )
        
        # Run all workflows in parallel
        workflow_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Aggregate results
        total_processed = 0
        total_succeeded = 0
        total_failed = 0
        total_cost = 0.0
        
        for i, result in enumerate(workflow_results):
            if isinstance(result, Exception):
                current_app.logger.error(f'Workflow {i+1} failed: {str(result)}')
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
            current_app.logger.error(f'Raw output: {output[:500]}')
            return None
    
    def _get_token_usage(self, result) -> int:
        """
        Extract token usage from SDK result.
        
        Args:
            result: Runner result object
        
        Returns:
            int: Total tokens used
        """
        # SDK provides usage info in result
        # This is a placeholder - check SDK docs for exact attribute
        try:
            if hasattr(result, 'usage'):
                return result.usage.get('total_tokens', 0)
            return 0
        except:
            return 0
    
    def _estimate_cost(self, tokens: int, model: str) -> float:
        """
        Estimate cost based on tokens and model.
        
        Args:
            tokens: Number of tokens
            model: Model name
        
        Returns:
            float: Estimated cost in USD
        """
        # GPT-4o-mini pricing (Feb 2024)
        if 'gpt-4o-mini' in model:
            # Average of input ($0.150/1M) and output ($0.600/1M)
            avg_price_per_1m = 0.375
            return (tokens / 1_000_000) * avg_price_per_1m
        
        return 0.0


def run_orchestrated_round(round_id: int, total_emails: int) -> Dict[str, Any]:
    """
    Main entry point for running orchestrated round.
    
    This is what you call from your Celery task.
    
    Args:
        round_id: Database round ID
        total_emails: Total emails to generate and detect
    
    Returns:
        dict: Round results
    """
    # Create orchestrator
    orchestrator = AgenticOrchestrator(
        round_id=round_id,
        num_parallel_workflows=2  # Run 2 workflows in parallel
    )
    
    # Run parallel workflows (async)
    results = asyncio.run(
        orchestrator.run_parallel_workflows(total_emails)
    )
    
    return results