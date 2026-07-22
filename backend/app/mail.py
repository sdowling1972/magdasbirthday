"""Transactional email via iCloud SMTP (smtp.mail.me.com)."""

from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

import certifi

from app.config import settings

logger = logging.getLogger(__name__)


def mail_configured() -> bool:
    return bool(settings.smtp_password.strip())


def _ssl_context() -> ssl.SSLContext:
    # Python.org macOS installs often lack system CAs; certifi provides a reliable bundle.
    return ssl.create_default_context(cafile=certifi.where())


def send_email(subject: str, body: str) -> None:
    """Send a plain-text email. No-op (with warning) if SMTP password is unset."""
    if not mail_configured():
        logger.warning("Skipping email %r — SMTP_PASSWORD is not configured", subject)
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.mail_from
    msg["To"] = settings.mail_to
    msg.set_content(body)

    try:
        context = _ssl_context()
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            smtp.ehlo()
            smtp.starttls(context=context)
            smtp.ehlo()
            smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(msg)
        logger.info("Sent email %r to %s", subject, settings.mail_to)
    except Exception:
        # Never fail the guest request because mail failed
        logger.exception("Failed to send email %r", subject)
