"""Flask CLI commands — run via `flask <command>`."""

import os

import click
from flask.cli import with_appcontext
from .models import db, Role, User


@click.command('seed')
@with_appcontext
def seed_cmd():
    """Seed the database with initial roles and an admin account. Idempotent."""

    # --- Roles ---
    role_defs = [
        ('user', 'Standard user'),
        ('moderator', 'Moderator'),
        ('admin', 'Admin')
    ]

    created_roles = {}
    for name, description in role_defs:
        role = Role.query.filter_by(name=name).first()
        if not role:
            role = Role(name=name, description=description)
            db.session.add(role)
            click.echo(f'  Created role: {name}')
        else:
            click.echo(f'  Role already exists: {name}')
        created_roles[name] = role

    db.session.flush()  # Ensure roles have IDs before assigning

    # --- Admin account ---
    admin_email = os.environ.get('SEED_ADMIN_EMAIL', 'admin@admin.com')
    admin_username = os.environ.get('SEED_ADMIN_USERNAME', 'admin')
    admin_password = os.environ.get('SEED_ADMIN_PASSWORD')
    if not admin_password:
        click.echo('  WARNING: SEED_ADMIN_PASSWORD not set — skipping admin creation.', err=True)
        db.session.commit()
        click.echo('Seed complete.')
        return

    admin = User.query.filter_by(email=admin_email).first()
    if not admin:
        admin = User(
            email=admin_email,
            username=admin_username,
            email_verified=True,
        )
        admin.set_password(admin_password)
        admin.roles.append(created_roles['admin'])
        db.session.add(admin)
        click.echo(f'  Created admin: {admin_email}')
    else:
        click.echo(f'  Admin already exists: {admin_email}')

    db.session.commit()
    click.echo('Seed complete.')
