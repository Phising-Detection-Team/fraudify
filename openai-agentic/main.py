"""
Main Orchestrator for Phishing Detection System
OpenAI Agents SDK Implementation

This orchestrator coordinates:
- Generator Agent (Gemini 2.0 Flash) - Creates phishing/legitimate emails
- Detector Agent (Claude 3.5 Haiku) - Analyzes emails for phishing

Usage:
    python main.py --emails 10 --rounds 3 --workflows 2

Features:
    - Multiple rounds support
    - Configurable emails per round
    - Parallel workflow execution
    - Complete database integration
    - Automatic judging (no LLM needed)
"""

import asyncio
import json
import argparse
import sys
import time
from typing import Dict, Any
from datetime import datetime

# Import services (your entity-service pattern)
from services.generator_agent_service import GeneratorAgentService
from services.detector_agent_service import DetectorAgentService

# Import database utilities
from utils.db_utils import (
    init_db,
    create_round,
    save_generated_email,
    update_email_with_detection,
    update_round,
    get_round_summary,
    get_all_rounds_summary,
    save_log
)

class Orchestrator:
    """
    Main orchestrator for phishing detection system.
    
    Coordinates Generator (Gemini) and Detector (Claude) agents using
    OpenAI Agents SDK with parallel workflow execution.
    """
    
    def __init__(self, round_id: int, num_parallel_workflows: int = 2):
        """
        Initialize orchestrator for a specific round.
        
        Args:
            round_id: Database round ID
            num_parallel_workflows: Number of parallel workflows (default: 2)
        """
        self.round_id = round_id
        self.num_parallel = num_parallel_workflows
        
        # Initialize services (uses your entity-service pattern)
        self.generator_service = GeneratorAgentService()
        self.detector_service = DetectorAgentService()
        
        # Log initialization
        save_log(
            level='info',
            message=f'Orchestrator initialized for round {round_id}',
            round_id=round_id,
            context={'workflows': num_parallel_workflows}
        )
        
        print(f"[Orchestrator] Round {round_id}: {num_parallel_workflows} parallel workflows")
        print(f"[Orchestrator] Generator: Gemini 2.0 Flash")
        print(f"[Orchestrator] Detector: Claude 3.5 Haiku")

    async def run_single_workflow(
        self,
        workflow_id: int,
        num_emails: int
    ) -> Dict[str, Any]:
        """
        Run a single workflow: Generate N emails → Detect each.
        
        This processes multiple emails sequentially within one workflow.
        Multiple workflows run in parallel.
        
        Args:
            workflow_id: Identifier for this workflow (1, 2, 3, ...)
            num_emails: Number of emails to process in this workflow
        
        Returns:
            dict: Workflow results (processed, succeeded, failed, cost, correct)
        """
        print(f"[Workflow {workflow_id}] Starting with {num_emails} emails")
        
        results = {
            'workflow_id': workflow_id,
            'emails_processed': 0,
            'emails_succeeded': 0,
            'emails_failed': 0,
            'total_cost': 0.0,
            'correct_detections': 0
        }
        
        for i in range(num_emails):
            email_start_time = time.time()
            
            try:
                # ============================================
                # STEP 1: GENERATE EMAIL (Gemini)
                # ============================================
                
                print(f"[Workflow {workflow_id}] Email {i+1}/{num_emails}: Generating...")
                
                gen_start = time.time()
                gen_result = await self.generator_service.generate_email()
                gen_latency_ms = int((time.time() - gen_start) * 1000)
                
                # Parse generator output
                gen_output = self._parse_json_output(gen_result.final_output)
                
                if not gen_output:
                    raise ValueError('Generator returned invalid JSON')
                
                # Extract email data
                subject = gen_output.get('subject', 'No Subject')
                sender = gen_output.get('from', 'unknown@example.com')
                body = gen_output.get('body', '')
                
                # Format full email content
                email_content = (
                    f"From: {sender}\n"
                    f"Subject: {subject}\n\n"
                    f"{body}"
                )
                
                is_phishing = gen_output.get('is_phishing', False)
                metadata = gen_output.get('metadata', {})
                
                # Estimate tokens and cost
                gen_tokens = self._estimate_tokens(gen_result.final_output)
                gen_cost = self._estimate_cost(gen_tokens, 'gemini-2.0-flash')
                
                # Save to database
                email_id = save_generated_email(
                    round_id=self.round_id,
                    content=email_content,
                    prompt="Generated by Gemini 2.0 Flash",
                    subject=subject,
                    body=body,
                    is_phishing=is_phishing,
                    metadata=metadata,
                    llm_provider='gemini',
                    llm_model='gemini-2.0-flash',
                    llm_tokens=gen_tokens,
                    llm_cost=gen_cost,
                    latency_ms=gen_latency_ms
                )
                
                if not email_id:
                    raise ValueError('Failed to save email to database')
                
                results['total_cost'] += gen_cost
                
                print(f"[Workflow {workflow_id}] Email {i+1}: "
                      f"Generated (ID {email_id}, {'Phishing' if is_phishing else 'Legitimate'})")
                
                # ============================================
                # STEP 2: DETECT PHISHING (Claude)
                # ============================================
                
                print(f"[Workflow {workflow_id}] Email {i+1}: Detecting...")
                
                det_start = time.time()
                det_result = await self.detector_service.analyze_email(email_content)
                det_latency_ms = int((time.time() - det_start) * 1000)
                
                # Parse detector output
                det_output = self._parse_json_output(det_result.final_output)
                
                if not det_output:
                    raise ValueError('Detector returned invalid JSON')
                
                # Extract detection data
                verdict_raw = det_output.get('verdict', 'LEGITIMATE')
                
                # Normalize verdict to schema constraint: 'phishing' or 'legitimate'
                verdict = 'phishing' if verdict_raw.upper() in ['SCAM', 'LIKELY SCAM', 'PHISHING'] else 'legitimate'
                
                confidence = float(det_output.get('confidence', 0.5))
                scam_score = float(det_output.get('scam_score', 0.5))
                reasoning = det_output.get('reasoning', 'No reasoning provided')
                
                # Estimate tokens and cost
                det_tokens = self._estimate_tokens(det_result.final_output)
                det_cost = self._estimate_cost(det_tokens, 'claude-3-haiku-20240307')
                
                # Calculate total processing time
                processing_time = time.time() - email_start_time
                
                # Update email with detection results (includes automatic judging)
                is_correct = update_email_with_detection(
                    email_id=email_id,
                    verdict=verdict,
                    confidence=confidence,
                    risk_score=scam_score,
                    reasoning=reasoning,
                    llm_provider='claude',
                    llm_model='claude-3-haiku-20240307',
                    llm_tokens=det_tokens,
                    llm_cost=det_cost,
                    latency_ms=det_latency_ms,
                    processing_time=processing_time
                )
                
                results['total_cost'] += det_cost
                results['emails_succeeded'] += 1

                if is_correct:
                    results['correct_detections'] += 1

                # Emit real-time progress event via SocketIO
                try:
                    from app import socketio as _socketio
                    _n_processed = results['emails_processed'] + 1  # 1-based: not yet incremented in finally
                    _accuracy = (
                        results['correct_detections'] / _n_processed
                        if _n_processed > 0 else 0.0
                    )
                    _socketio.emit('round_progress', {
                        'round_id': self.round_id,
                        'processed': _n_processed,
                        'total': num_emails,
                        'verdict': verdict,
                        'accuracy': float(_accuracy),
                    })
                except Exception:
                    pass  # Never block processing on a failed emit

                print(f"[Workflow {workflow_id}] Email {i+1}: Complete! "
                      f"Verdict: {verdict} ({confidence:.2f}), "
                      f"{'✓ Correct' if is_correct else '✗ Incorrect'}")
                
            except Exception as e:
                results['emails_failed'] += 1
                error_msg = f'Email {i+1} failed: {str(e)}'
                print(f"[Workflow {workflow_id}] {error_msg}")
                
                # Log error
                save_log(
                    level='error',
                    message=error_msg,
                    round_id=self.round_id,
                    context={
                        'workflow_id': workflow_id,
                        'email_number': i+1,
                        'error': str(e)
                    }
                )
                continue
            
            finally:
                results['emails_processed'] += 1
        
        print(f"[Workflow {workflow_id}] Complete! "
              f"{results['emails_succeeded']}/{num_emails} succeeded, "
              f"{results['correct_detections']} correct, "
              f"Cost: ${results['total_cost']:.4f}")
        
        return results
    
    async def run_parallel_workflows(self, total_emails: int) -> Dict[str, Any]:
        """
        Run multiple workflows in parallel.
        
        Divides emails among workflows and executes them concurrently.
        
        Args:
            total_emails: Total emails to process across all workflows
        
        Returns:
            dict: Aggregated results from all workflows
        """
        # Divide emails among workflows
        emails_per_workflow = total_emails // self.num_parallel
        remainder = total_emails % self.num_parallel
        
        # Create async tasks for each workflow
        tasks = []
        for i in range(self.num_parallel):
            num_emails = emails_per_workflow
            if i == 0:
                num_emails += remainder
            
            task = self.run_single_workflow(
                workflow_id=i + 1,
                num_emails=num_emails
            )
            tasks.append(task)
        
        print(f"\n[Orchestrator] Starting {self.num_parallel} parallel workflows")
        print(f"[Orchestrator] Distribution: {emails_per_workflow} emails per workflow + {remainder} remainder\n")
        
        # Run all workflows in parallel
        workflow_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Aggregate results
        total_processed = 0
        total_succeeded = 0
        total_failed = 0
        total_cost = 0.0
        total_correct = 0
        
        for i, result in enumerate(workflow_results):
            if isinstance(result, Exception):
                print(f"[Workflow {i+1}] Failed: {str(result)}")
                total_failed += emails_per_workflow
            else:
                total_processed += result['emails_processed']
                total_succeeded += result['emails_succeeded']
                total_failed += result['emails_failed']
                total_cost += result['total_cost']
                total_correct += result['correct_detections']
        
        # Calculate accuracy
        accuracy = (total_correct / total_processed * 100) if total_processed > 0 else 0
        
        # Update round in database
        update_round(
            round_id=self.round_id,
            status='completed' if total_processed >= total_emails else 'running',
            processed_emails=total_processed,
            detector_accuracy=accuracy,
            total_cost=total_cost
        )
        
        # Log completion
        save_log(
            level='info',
            message=f'Round {self.round_id} completed: {total_correct}/{total_processed} correct ({accuracy:.2f}%)',
            round_id=self.round_id,
            context={
                'processed': total_processed,
                'succeeded': total_succeeded,
                'failed': total_failed,
                'accuracy': accuracy,
                'cost': total_cost
            }
        )
        
        print(f"\n[Orchestrator] Round {self.round_id} Complete!")
        print(f"  Processed: {total_succeeded}/{total_processed} succeeded")
        print(f"  Correct: {total_correct}/{total_processed}")
        print(f"  Accuracy: {accuracy:.2f}%")
        print(f"  Total Cost: ${total_cost:.6f}\n")
        
        return {
            'round_id': self.round_id,
            'total_processed': total_processed,
            'total_succeeded': total_succeeded,
            'total_failed': total_failed,
            'total_cost': total_cost,
            'accuracy': accuracy
        }
    
    def _parse_json_output(self, output: str) -> Dict[str, Any]:
        """Parse JSON output from agent, handling markdown code blocks."""
        try:
            cleaned = output.strip()
            # Remove markdown code blocks
            if cleaned.startswith('```json'):
                cleaned = cleaned[7:]
            if cleaned.startswith('```'):
                cleaned = cleaned[3:]
            if cleaned.endswith('```'):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            print(f"JSON parse error: {e}")
            print(f"Raw output: {output[:500]}...")
            return {}

    def _estimate_tokens(self, text: str) -> int:
        """Rough token estimate: 1 token ≈ 4 characters."""
        return len(text) // 4
    
    def _estimate_cost(self, tokens: int, model: str) -> float:
        """
        Estimate cost based on tokens and model.
        
        Pricing (as of March 2025):
        - Gemini 2.0 Flash: $0.075/$0.30 per 1M tokens (input/output)
        - Claude 3.5 Haiku: $0.25/$1.25 per 1M tokens (input/output)
        
        We use average for simplicity.
        """
        if 'claude' in model.lower() and 'haiku' in model.lower():
            avg_price_per_1m = 0.75  # ($0.25 + $1.25) / 2
            return (tokens / 1_000_000) * avg_price_per_1m
        
        elif 'gemini' in model.lower() and 'flash' in model.lower():
            avg_price_per_1m = 0.1875  # ($0.075 + $0.30) / 2
            return (tokens / 1_000_000) * avg_price_per_1m
        
        return 0.0


async def run_orchestrated_round(round_id: int, total_emails: int, num_workflows: int = 2):
    """
    Run a single round with orchestrator.
    
    Args:
        round_id: Database round ID
        total_emails: Total emails to process
        num_workflows: Number of parallel workflows
    
    Returns:
        dict: Round results
    """
    orchestrator = Orchestrator(
        round_id=round_id,
        num_parallel_workflows=num_workflows
    )
    
    results = await orchestrator.run_parallel_workflows(total_emails)
    
    return results


def main():
    """Main entry point with CLI argument parsing."""
    parser = argparse.ArgumentParser(
        description='Phishing Detection System - OpenAI Agents SDK',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run 1 round with 10 emails
  python main.py --emails 10
  
  # Run 3 rounds, 20 emails each
  python main.py --emails 20 --rounds 3
  
  # Run with 4 parallel workflows (faster!)
  python main.py --emails 100 --rounds 2 --workflows 4
"""
    )
    parser.add_argument(
        '--emails',
        type=int,
        default=10,
        help='Number of emails per round (default: 10)'
    )
    parser.add_argument(
        '--rounds',
        type=int,
        default=1,
        help='Number of rounds to run (default: 1)'
    )
    parser.add_argument(
        '--workflows',
        type=int,
        default=2,
        help='Number of parallel workflows per round (default: 2)'
    )
    
    args = parser.parse_args()
    
    # Print header
    print("=" * 70)
    print("  PHISHING DETECTION SYSTEM")
    print("  OpenAI Agents SDK - Gemini (Generator) + Claude (Detector)")
    print("=" * 70)
    print(f"\nConfiguration:")
    print(f"  Emails per round: {args.emails}")
    print(f"  Number of rounds: {args.rounds}")
    print(f"  Parallel workflows: {args.workflows}")
    print(f"  Total emails: {args.emails * args.rounds}")
    print("\n" + "=" * 70)
    
    # Initialize database
    print("\n[Database] Initializing connection...")
    init_db()
    
    # Run multiple rounds
    all_round_results = []
    total_start_time = time.time()
    
    for round_num in range(1, args.rounds + 1):
        print(f"\n{'=' * 70}")
        print(f"  ROUND {round_num}/{args.rounds}")
        print(f"{'=' * 70}\n")
        
        # Create round in database
        round_id = create_round(
            total_emails=args.emails,
            status='running',
            created_by='CLI',
            notes=f'Round {round_num}/{args.rounds} - {args.emails} emails'
        )
        
        if not round_id:
            print(f"❌ Failed to create round {round_num}")
            continue
        
        # Run orchestrator
        print(f"[Orchestrator] Starting round {round_id}...\n")
        
        try:
            # Run async orchestrator (use loop.run_until_complete to reuse event loop)
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            results = loop.run_until_complete(
                run_orchestrated_round(
                    round_id=round_id,
                    total_emails=args.emails,
                    num_workflows=args.workflows
                )
            )
            
            all_round_results.append(results)
            
            # Print round summary
            summary = get_round_summary(round_id)
            
            print(f"Round {round_num} Summary:")
            print(f"  Status: {summary['status']}")
            print(f"  Accuracy: {summary['accuracy']:.2f}%")
            print(f"  Cost: ${summary['total_cost']:.6f}")
            print(f"  False Positives: {summary['false_positives']}")
            print(f"  False Negatives: {summary['false_negatives']}")
            
        except Exception as e:
            print(f"\n❌ Round {round_num} ERROR: {str(e)}")
            save_log(
                level='critical',
                message=f'Round {round_num} failed: {str(e)}',
                round_id=round_id if 'round_id' in locals() else None
            )
            import traceback
            traceback.print_exc()
            continue
    
    # Overall summary
    total_time = time.time() - total_start_time
    
    print("\n" + "=" * 70)
    print("  OVERALL SUMMARY")
    print("=" * 70)
    
    if all_round_results:
        total_emails_processed = sum(r['total_processed'] for r in all_round_results)
        total_cost = sum(r['total_cost'] for r in all_round_results)
        avg_accuracy = sum(r['accuracy'] for r in all_round_results) / len(all_round_results)
        
        print(f"\nCompleted {len(all_round_results)}/{args.rounds} rounds successfully")
        print(f"\nTotal Statistics:")
        print(f"  Total emails: {total_emails_processed}")
        print(f"  Average accuracy: {avg_accuracy:.2f}%")
        print(f"  Total cost: ${total_cost:.6f}")
        print(f"  Cost per email: ${total_cost/total_emails_processed:.6f}")
        print(f"  Total time: {total_time:.1f}s")
        print(f"  Emails/second: {total_emails_processed/total_time:.2f}")
        
        # Show all rounds
        print(f"\nAll Rounds:")
        all_rounds = get_all_rounds_summary()
        for round_data in all_rounds[-args.rounds:]:
            print(f"  Round {round_data['id']}: "
                  f"{round_data['processed_emails']}/{round_data['total_emails']} emails, "
                  f"{round_data['accuracy']:.2f}% accuracy, "
                  f"${round_data['total_cost']:.6f} cost")
        
        print("\n" + "=" * 70)
        print("  ✅ SUCCESS!")
        print("=" * 70)
        
        return 0
    else:
        print("\n❌ All rounds failed")
        return 1


if __name__ == '__main__':
    sys.exit(main())