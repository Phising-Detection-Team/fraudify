"""
Orchestration Agent Entity: Configuration and state for orchestration.

This entity holds the state for the orchestration agent including
chat history and configuration.
"""

from semantic_kernel.contents import ChatHistory
from .base_entity import BaseEntity


class OrchestrationAgentEntity(BaseEntity):
    """Entity for Orchestration Agent - manages workflow state."""

    def __init__(self):
        """Initialize the orchestration entity with chat history."""
        super().__init__()

        # Initialize chat history
        self.chat_history = ChatHistory()

        # Load and add system prompt to history
        system_prompt = self.get_prompt('orchestration_system')
        self.chat_history.add_system_message(system_prompt)

        print("\n" + "="*60)
        print("🤖 ORCHESTRATION ENTITY INITIALIZED")
        print("="*60 + "\n")

    def reset_chat_history(self):
        """Reset the chat history to start fresh for a new task."""
        self.chat_history = ChatHistory()
        system_prompt = self.get_prompt('orchestration_system')
        self.chat_history.add_system_message(system_prompt)
