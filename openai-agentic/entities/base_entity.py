from utils.prompts import PROMPTS, get_prompt


class BaseEntity:
    """Base entity class for all agent entities."""

    def __init__(self, api_key: str = None, model: str = None):
        """Initialize the base entity.

        Args:
            api_key: Optional API key for the service
            model: Optional model identifier to use
        """
        self.api_key = api_key
        self.model = model
        self.prompts = PROMPTS

        # Initialize client if API key is provided
        if api_key:
            self.client = self._initialize_client()

    def _initialize_client(self):
        """Initialize the API client. Override in subclasses that need API clients.

        Returns:
            API client instance or None if not needed
        """
        return None

    def get_prompt(self, prompt_name: str) -> str:
        """Get a specific prompt by name."""
        return get_prompt(prompt_name)
