"""Public API for the utils package."""

from utils.prompts import get_detection_prompt

# Database utilities are imported on-demand to avoid import errors
# when database is not configured
try:
    from utils.db_utils import init_db, save_generated_email
except ImportError:
    pass
