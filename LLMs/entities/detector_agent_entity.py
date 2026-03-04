import os
from anthropic import AsyncAnthropic
from .base_entity import BaseEntity


class DetectorAgentEntity(BaseEntity):
    """Entity for Detector Agent using Anthropic Claude."""

    def __init__(self, api_key: str = None, model: str = "claude-3-haiku-20240307"):
        """Initialize Detector Agent Entity.

        Args:
            api_key: Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
            model: Model to use (default: claude-3-haiku-20240307)
        """
        if api_key is None:
            api_key = os.getenv("ANTHROPIC_API_KEY")

        if not api_key:
            raise ValueError("DetectorAgentEntity requires an API key")

        super().__init__(api_key, model)

    def _initialize_client(self) -> AsyncAnthropic:
        """Initialize the Anthropic client."""
        return AsyncAnthropic(api_key=self.api_key)
