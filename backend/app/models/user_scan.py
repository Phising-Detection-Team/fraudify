"""UserScan model — stores individual email scans performed by users."""

from datetime import datetime
from . import db


class UserScan(db.Model):
    """Represents a single email scan submitted by a user."""

    __tablename__ = 'user_scans'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )
    subject = db.Column(db.String(512), nullable=True)
    body_snippet = db.Column(db.Text, nullable=True)
    full_body = db.Column(db.Text, nullable=True)
    verdict = db.Column(
        db.Enum('phishing', 'likely_phishing', 'suspicious', 'likely_legitimate', 'legitimate', name='scan_verdict'),
        nullable=False,
        default='suspicious',
    )
    confidence = db.Column(db.Float, nullable=True)
    scam_score = db.Column(db.Float, nullable=True)
    reasoning = db.Column(db.Text, nullable=True)
    scanned_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship('User', backref=db.backref('scans', lazy='dynamic'))

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'subject': self.subject,
            'body_snippet': self.body_snippet,
            'verdict': self.verdict,
            'confidence': self.confidence,
            'scam_score': self.scam_score,
            'reasoning': self.reasoning,
            'scanned_at': self.scanned_at.isoformat() if self.scanned_at else None,
        }

    def __repr__(self):
        return f'<UserScan {self.id} user={self.user_id} verdict={self.verdict}>'
