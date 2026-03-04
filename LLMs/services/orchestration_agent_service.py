"""
Orchestration Agent Service: AI-powered workflow orchestration operations.

This service orchestrates the execution of Generator, Detector, and Judge agents
using Semantic Kernel's function calling capabilities.
"""

import semantic_kernel as sk
from semantic_kernel.contents import FunctionCallContent, FinishReason
from semantic_kernel.connectors.ai.open_ai.prompt_execution_settings.open_ai_prompt_execution_settings import OpenAIChatPromptExecutionSettings
from semantic_kernel.connectors.ai.function_choice_behavior import FunctionChoiceBehavior
from semantic_kernel.functions import kernel_function
import json

from services.base_service import BaseService
from entities.orchestration_agent_entity import OrchestrationAgentEntity


class OrchestrationAgentService(BaseService):
    """Service for orchestrating multi-agent workflows with function calling.

    This service owns and manages its own OrchestrationAgentEntity.
    """

    def __init__(self):
        """Initialize Orchestration Agent Service with its own entity."""
        super().__init__()
        self.entity = OrchestrationAgentEntity()

    @kernel_function(
        description="AI-powered orchestration using function calling to generate and analyze scam emails",
        name="ai_orchestrate"
    )
    async def ai_orchestrate(
        self,
        kernel: sk.Kernel = None,
        round_id: int = None,
        max_rounds: int = 10
    ) -> dict | None:
        """AI-powered orchestration using function calling.

        Args:
            kernel: The Semantic Kernel instance with registered plugins
            round_id: Optional round ID to pass to agent services for database logging
            max_rounds: Maximum number of function calling rounds (default: 10)

        Returns:
            dict: Parsed JSON result or None if failed
        """
        if not kernel:
            raise ValueError("kernel parameter is required")

        # Set round_id on generator and detector services if provided
        if round_id is not None:
            try:
                generator_plugin = kernel.get_plugin("generator")
                detector_plugin = kernel.get_plugin("detector")

                # Access service instances through plugin functions
                for func_obj in generator_plugin.functions.values():
                    if hasattr(func_obj, 'method') and hasattr(func_obj.method, '__self__'):
                        service_instance = func_obj.method.__self__
                        if hasattr(service_instance, 'round_id'):
                            service_instance.round_id = round_id
                            break

                for func_obj in detector_plugin.functions.values():
                    if hasattr(func_obj, 'method') and hasattr(func_obj.method, '__self__'):
                        service_instance = func_obj.method.__self__
                        if hasattr(service_instance, 'round_id'):
                            service_instance.round_id = round_id
                            break

            except Exception as e:
                print(f"⚠️  Could not set round_id on services: {e}")
        self.entity.reset_chat_history()

        chat_service = kernel.get_service("openai")
        execution_settings = OpenAIChatPromptExecutionSettings(
            max_completion_tokens=16000,
            function_choice_behavior=FunctionChoiceBehavior.Auto(
                filters={"included_plugins": ["generator", "detector"]}  # Removed "judge"
            )
        )

        for round_num in range(1, max_rounds + 1):
            response = await chat_service.get_chat_message_contents(
                chat_history=self.entity.chat_history,
                settings=execution_settings,
                kernel=kernel
            )

            message = response[0]

            # Log round progress
            function_calls = [item for item in (message.items or []) if isinstance(item, FunctionCallContent)]
            if function_calls:
                print(f"Round {round_num}: Executing {len(function_calls)} function(s)")
                for fc in function_calls:
                    print(f"  → {fc.plugin_name}.{fc.function_name}")
            else:
                print(f"Round {round_num}: Generating final response")

            # Add message to history
            self.entity.chat_history.add_message(message)

            # Handle token limit
            if hasattr(message, 'finish_reason') and message.finish_reason == FinishReason.LENGTH:
                print(f"  ⚠️  Token limit reached, continuing...\n")
                continue

            # Check completion: no pending function calls and has content
            has_pending_calls = any(isinstance(item, FunctionCallContent) for item in (message.items or []))
            has_content = bool(message.content and message.content.strip())
            is_complete = (not has_pending_calls and has_content) or \
                        (hasattr(message, 'finish_reason') and message.finish_reason == FinishReason.STOP)

            if is_complete:
                final_response = str(message.content)
                try:
                    result_dict = json.loads(final_response)
                    print(f"✅ Successfully parsed JSON result ({len(result_dict)} keys)\n")
                    return result_dict
                except json.JSONDecodeError as e:
                    print(f"⚠️  Failed to parse JSON: {e}\n")
                    return {"raw_response": final_response, "parse_error": str(e)}

        print(f"\n⚠️  Maximum rounds ({max_rounds}) reached without completion\n")
        return None
