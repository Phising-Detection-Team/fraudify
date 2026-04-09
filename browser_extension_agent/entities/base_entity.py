class BaseEntity:
    """Base entity class for browser extension agent entities."""

    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key
        self.model = model

    def _initialize_client(self):
        return None
