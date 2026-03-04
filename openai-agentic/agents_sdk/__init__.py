"""
OpenAI Agents SDK integration package.

This package provides agentic orchestration for the phishing detection system.
It uses OpenAI Agents SDK to coordinate Generator and Detector agents in parallel workflows.

Architecture:
    - Orchestrator (GPT-4o-mini): Coordinates workflow execution
    - Generator Agent (Gemini): Creates phishing/legitimate emails
    - Detector Agent (Claude): Analyzes emails for phishing
    - Tools: Database integration functions
"""

# Import orchestrator components
from .orchestrator import GeneratorAgent, DetectorAgent, HumanOverrideAgent, OrchestratorAgent, run_orchestrated_round

# Import agent creators
from .generator import create_generator_agent, get_generation_prompt
from .detector import create_detector_agent, get_detection_prompt_for_email

# Import database tools
from .tools import (
    save_generated_email,
    save_detection_result,
    update_round_progress
)

# Export all public interfaces
__all__ = [
    # Orchestrator
    'GeneratorAgent',
    'DetectorAgent',
    'HumanOverrideAgent',
    'OrchestratorAgent',
    'run_orchestrated_round',
    
    # Generator agent
    'create_generator_agent',
    'get_generation_prompt',
    
    # Detector agent
    'create_detector_agent',
    'get_detection_prompt_for_email',
    
    # Database tools
    'save_generated_email',
    'save_detection_result',
    'update_round_progress',
]