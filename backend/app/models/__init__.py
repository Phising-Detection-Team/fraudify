from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from .round import Round
from .email import Email
from .log import Log
from .api import API
from .override import Override
from .user import User
from .role import Role, user_roles
from .invite_code import InviteCode
from .training_data_log import TrainingDataLog
from .extension_instance import ExtensionInstance
from .user_scan import UserScan
from .email_verification import EmailVerification

__all__ = [
    'db',
    'Round', 'Email', 'Log', 'API', 'Override',
    'User', 'Role', 'user_roles', 'InviteCode', 'TrainingDataLog',
    'ExtensionInstance', 'UserScan',
    'EmailVerification',
]
