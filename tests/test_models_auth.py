"""Unit tests for User, Role, InviteCode, and TrainingDataLog models."""

import pytest
from datetime import datetime, timedelta

from app.models import db, User, Role, InviteCode, TrainingDataLog, Email, Round


# ---------------------------------------------------------------------------
# User model
# ---------------------------------------------------------------------------

class TestUserModel:
    def test_create_user(self, db, sample_role_user):
        user = User(email='new@example.com', username='newuser')
        user.set_password('Pass1234')
        user.roles.append(sample_role_user)
        db.session.add(user)
        db.session.commit()

        assert user.id is not None
        assert user.email == 'new@example.com'
        assert user.username == 'newuser'
        assert user.is_active is True
        assert user.email_verified is False

    def test_set_and_check_password(self, db):
        user = User(email='pw@example.com', username='pwuser')
        user.set_password('Secret99')
        assert user.check_password('Secret99') is True
        assert user.check_password('wrongpass') is False

    def test_password_hash_not_plaintext(self, db):
        user = User(email='hash@example.com', username='hashuser')
        user.set_password('Secret99')
        assert user.password_hash != 'Secret99'
        assert len(user.password_hash) > 20

    def test_password_policy_too_short(self, db):
        user = User(email='short@example.com', username='shortuser')
        with pytest.raises(ValueError, match='at least 8'):
            user.set_password('Abc1')

    def test_password_policy_no_letter(self, db):
        user = User(email='nolet@example.com', username='noletuser')
        with pytest.raises(ValueError, match='one letter'):
            user.set_password('12345678')

    def test_password_policy_no_digit(self, db):
        user = User(email='nodig@example.com', username='nodiguser')
        with pytest.raises(ValueError, match='one digit'):
            user.set_password('abcdefgh')

    def test_has_role(self, db, sample_user, sample_role_user):
        assert sample_user.has_role('user') is True
        assert sample_user.has_role('admin') is False

    def test_to_dict_excludes_password_hash(self, db, sample_user):
        result = sample_user.to_dict()
        assert 'password_hash' not in result
        assert 'email' in result
        assert 'roles' in result
        assert 'user' in result['roles']

    def test_unique_email_constraint(self, db, sample_role_user):
        u1 = User(email='dup@example.com', username='dup1')
        u1.set_password('Pass1234')
        db.session.add(u1)
        db.session.commit()

        u2 = User(email='dup@example.com', username='dup2')
        u2.set_password('Pass1234')
        db.session.add(u2)
        with pytest.raises(Exception):
            db.session.commit()
        db.session.rollback()

    def test_unique_username_constraint(self, db, sample_role_user):
        u1 = User(email='e1@example.com', username='sameuser')
        u1.set_password('Pass1234')
        db.session.add(u1)
        db.session.commit()

        u2 = User(email='e2@example.com', username='sameuser')
        u2.set_password('Pass1234')
        db.session.add(u2)
        with pytest.raises(Exception):
            db.session.commit()
        db.session.rollback()


# ---------------------------------------------------------------------------
# Role model
# ---------------------------------------------------------------------------

class TestRoleModel:
    def test_create_role(self, db):
        role = Role(name='tester', description='Test role')
        db.session.add(role)
        db.session.commit()
        assert role.id is not None
        assert role.name == 'tester'

    def test_unique_name_constraint(self, db):
        r1 = Role(name='unique_role')
        db.session.add(r1)
        db.session.commit()

        r2 = Role(name='unique_role')
        db.session.add(r2)
        with pytest.raises(Exception):
            db.session.commit()
        db.session.rollback()

    def test_to_dict(self, db, sample_role_user):
        result = sample_role_user.to_dict()
        assert result['name'] == 'user'
        assert 'id' in result
        assert 'created_at' in result

    def test_valid_names_set(self):
        assert 'user' in Role.VALID_NAMES
        assert 'admin' in Role.VALID_NAMES
        assert 'super_admin' in Role.VALID_NAMES


# ---------------------------------------------------------------------------
# InviteCode model
# ---------------------------------------------------------------------------

class TestInviteCodeModel:
    def test_generate_creates_valid_code(self, db, sample_admin, sample_role_user):
        invite = InviteCode.generate(
            created_by=sample_admin.id,
            role_id=sample_role_user.id,
            expires_in_days=7,
        )
        db.session.add(invite)
        db.session.commit()

        assert invite.id is not None
        assert len(invite.code) > 10
        assert invite.used_by is None
        assert invite.is_valid() is True

    def test_is_valid_returns_false_when_used(self, db, sample_admin, sample_role_user):
        invite = InviteCode.generate(
            created_by=sample_admin.id,
            role_id=sample_role_user.id,
        )
        db.session.add(invite)
        db.session.commit()

        invite.used_by = sample_admin.id
        invite.used_at = datetime.utcnow()
        db.session.commit()

        assert invite.is_valid() is False

    def test_is_valid_returns_false_when_expired(self, db, sample_admin, sample_role_user):
        invite = InviteCode.generate(
            created_by=sample_admin.id,
            role_id=sample_role_user.id,
        )
        invite.expires_at = datetime.utcnow() - timedelta(seconds=1)
        db.session.add(invite)
        db.session.commit()

        assert invite.is_valid() is False

    def test_to_dict(self, db, sample_invite_code):
        result = sample_invite_code.to_dict()
        assert 'code' in result
        assert result['used'] is False
        assert 'expires_at' in result
        assert result['role'] == 'user'

    def test_unique_code_constraint(self, db, sample_admin, sample_role_user):
        invite1 = InviteCode.generate(created_by=sample_admin.id, role_id=sample_role_user.id)
        invite1.code = 'same-code'
        db.session.add(invite1)
        db.session.commit()

        invite2 = InviteCode.generate(created_by=sample_admin.id, role_id=sample_role_user.id)
        invite2.code = 'same-code'
        db.session.add(invite2)
        with pytest.raises(Exception):
            db.session.commit()
        db.session.rollback()


# ---------------------------------------------------------------------------
# Email model — created_by FK
# ---------------------------------------------------------------------------

class TestEmailCreatedByFK:
    def test_created_by_nullable(self, db, sample_round):
        email = Email(
            round_id=sample_round.id,
            generated_content='Content',
            is_phishing=False,
            generated_email_metadata={},
            detector_verdict='legitimate',
            created_by=None,
        )
        db.session.add(email)
        db.session.commit()
        assert email.created_by is None

    def test_created_by_set_to_user_id(self, db, sample_round, sample_user):
        email = Email(
            round_id=sample_round.id,
            generated_content='Content',
            is_phishing=False,
            generated_email_metadata={},
            detector_verdict='legitimate',
            created_by=sample_user.id,
        )
        db.session.add(email)
        db.session.commit()
        assert email.created_by == sample_user.id

    def test_training_data_ingested_defaults_false(self, db, sample_round):
        email = Email(
            round_id=sample_round.id,
            generated_content='Content',
            is_phishing=False,
            generated_email_metadata={},
            detector_verdict='legitimate',
        )
        db.session.add(email)
        db.session.commit()
        assert email.training_data_ingested is False
