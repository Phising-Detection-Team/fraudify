from datetime import datetime
from . import db


# Join table for the many-to-many User ↔ Role relationship
user_roles = db.Table(
    'user_roles',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    db.Column('role_id', db.Integer, db.ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
    db.Column('assigned_at', db.DateTime, default=datetime.utcnow, nullable=False),
    db.Column('assigned_by', db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
)


class Role(db.Model):
    """Role model. Valid names: 'user', 'admin', 'super_admin'."""

    __tablename__ = 'roles'

    VALID_NAMES = {'user', 'admin', 'super_admin'}

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    users = db.relationship(
        'User',
        secondary='user_roles',
        primaryjoin='Role.id == user_roles.c.role_id',
        secondaryjoin='User.id == user_roles.c.user_id',
        back_populates='roles',
        lazy='dynamic',
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<Role {self.name}>'
