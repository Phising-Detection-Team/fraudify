"""Shared Sentra transactional email layout (templates) and Resend-backed senders."""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _email_rendering_bundle() -> tuple[Environment, str]:
    """One-time load: Jinja environment + Sentra theme CSS (shared by all emails)."""
    root = Path(__file__).resolve().parent.parent / "templates"
    theme_css = (root / "email" / "sentra_theme.css").read_text(encoding="utf-8")
    env = Environment(
        loader=FileSystemLoader(str(root)),
        autoescape=select_autoescape(["html", "htm", "xml"]),
    )
    return env, theme_css


def render_sentra_html_email(document_title: str, inner_template: str, **inner_context: object) -> str:
    """
    Render a full Sentra HTML email: shared theme + document shell + inner fragment.

    inner_context is passed to the inner Jinja template; user-controlled values must
    appear only via template variables (autoescaped). The inner HTML is then embedded
    in the outer document with |safe.
    """
    env, theme_css = _email_rendering_bundle()
    inner_body = env.get_template(inner_template).render(**inner_context)
    return env.get_template("email/sentra_document.html").render(
        title=document_title,
        theme_css=theme_css,
        inner_body=inner_body,
    )


def welcome_email_sender(
    to_email: str,
    display_name: str,
    cta_url: str,
    from_email: str,
    api_key: str,
) -> bool:
    """
    Send the post-verification welcome email via Resend.

    Call from the auth flow after email verification has succeeded and been committed.

    Returns:
        True on success, False on failure (non-fatal for callers).
    """
    html_body = render_sentra_html_email(
        "Welcome to Sentra",
        "email/welcome_inner.html",
        display_name=display_name,
        cta_url=cta_url,
    )

    try:
        import resend

        resend.api_key = api_key
        params = {
            'from': from_email,
            'to': [to_email],
            'subject': 'Welcome to Sentra',
            'html': html_body,
        }
        resend.Emails.send(params)  # type: ignore[arg-type]
        logger.info('Welcome email sent to %s', to_email)
        return True
    except Exception as exc:
        logger.error('Failed to send welcome email to %s: %s', to_email, exc)
        return False
