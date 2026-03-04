from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from entities.base_entity import BaseEntity


class BaseService:
    """Base service class for all agent services.

    Services are self-contained and manage their own entity instances.
    Configuration is passed to the service constructor and used to initialize
    the appropriate entity.
    """

    def __init__(self):
        """Initialize base service."""
        pass