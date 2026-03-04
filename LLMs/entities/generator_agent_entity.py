import os
from openai import AsyncOpenAI
from .base_entity import BaseEntity


class GeneratorAgentEntity(BaseEntity):
    """Entity for Generator Agent using OpenAI."""

    def __init__(self, api_key: str = None, model: str = "gpt-4o-mini"):
        """Initialize Generator Agent Entity.

        Args:
            api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
            model: Model to use (default: gpt-4o-mini)
        """
        if api_key is None:
            api_key = os.getenv("OPENAI_API_KEY")

        if not api_key:
            raise ValueError("GeneratorAgentEntity requires an API key")

        super().__init__(api_key, model)

    def _initialize_client(self) -> AsyncOpenAI:
        """Initialize the OpenAI client."""
        return AsyncOpenAI(api_key=self.api_key)
