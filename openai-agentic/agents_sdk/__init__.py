"""
OpenAI Agents SDK integration package.

Provides agentic orchestration for Generator → Detector workflows.
"""

from .orchestrator import AgenticOrchestrator, run_orchestrated_round
from .generator_agent import create_generator_agent
from .detector_agent import create_detector_agent
from .tools import (
    save_generated_email,
    save_detection_result,
    update_round_progress
)

__all__ = [
    'AgenticOrchestrator',
    'run_orchestrated_round',
    'create_generator_agent',
    'create_detector_agent',
    'save_generated_email',
    'save_detection_result',
    'update_round_progress'
]