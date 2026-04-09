from __future__ import annotations

import json
import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr
from typing import Any
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError

from core.config import (
    LEAD_AUTOREPLY_DEMO_BOOKING_URL,
    LEAD_AUTOREPLY_ENABLED,
    LEAD_AUTOREPLY_REPLY_TO,
    LEAD_NOTIFICATION_BRAND_NAME,
    LEAD_NOTIFICATION_CONTACT_EMAIL,
    LEAD_NOTIFICATION_EMAIL_TO,
    LEAD_NOTIFICATION_WEBHOOK_TIMEOUT_SECONDS,
    LEAD_NOTIFICATION_WEBHOOK_URL,
    PUBLIC_BASE_URL,
    SMTP_FROM_EMAIL,
    SMTP_FROM_NAME,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USERNAME,
    SMTP_USE_SSL,
    SMTP_USE_TLS,
)
from core.time_utils import iso_now


logger = logging.getLogger(__name__)


def _smtp_ready() -> bool:
    return bool(SMTP_HOST and SMTP_FROM_EMAIL)


def _marketing_or_app_url() -> str:
    return PUBLIC_BASE_URL or ""


def _format_sender() -> str:
    return formataddr((SMTP_FROM_NAME or LEAD_NOTIFICATION_BRAND_NAME, SMTP_FROM_EMAIL))


def _lead_request_label(request_type: str) -> str:
    return "Demo request" if str(request_type or "").strip().lower() == "demo" else "Contact request"


def _lead_context(lead: dict[str, Any]) -> dict[str, Any]:
    request_type = str(lead.get("request_type") or "contact").strip().lower()
    source_page = str(lead.get("source_page") or "").strip()
    submitted_url = _marketing_or_app_url()
    page_url = f"{submitted_url}{source_page}" if submitted_url and source_page.startswith("/") else source_page or submitted_url
    return {
        "id": int(lead.get("id") or 0),
        "request_type": request_type,
        "request_label": _lead_request_label(request_type),
        "name": str(lead.get("name") or "").strip(),
        "email": str(lead.get("email") or "").strip(),
        "organization": str(lead.get("organization") or "").strip(),
        "use_case": str(lead.get("use_case") or "").strip(),
        "message": str(lead.get("message") or "").strip(),
        "created_at": str(lead.get("created_at") or "").strip(),
        "source_page": source_page,
        "page_url": page_url,
        "campaign": str(lead.get("campaign") or "").strip(),
        "utm_source": str(lead.get("utm_source") or "").strip(),
        "utm_medium": str(lead.get("utm_medium") or "").strip(),
        "utm_campaign": str(lead.get("utm_campaign") or "").strip(),
        "site_id": lead.get("site_id"),
        "user_id": lead.get("user_id"),
    }


def _send_smtp_email(*, to_addrs: list[str], subject: str, body: str, reply_to: str = "") -> None:
    message = EmailMessage()
    message["From"] = _format_sender()
    message["To"] = ", ".join(to_addrs)
    message["Subject"] = subject
    if reply_to:
        message["Reply-To"] = reply_to
    message.set_content(body)

    smtp_factory = smtplib.SMTP_SSL if SMTP_USE_SSL else smtplib.SMTP
    with smtp_factory(SMTP_HOST, SMTP_PORT, timeout=LEAD_NOTIFICATION_WEBHOOK_TIMEOUT_SECONDS) as smtp_client:
        if not SMTP_USE_SSL and SMTP_USE_TLS:
            smtp_client.starttls()
        if SMTP_USERNAME:
            smtp_client.login(SMTP_USERNAME, SMTP_PASSWORD)
        smtp_client.send_message(message)


def _send_webhook(payload: dict[str, Any]) -> None:
    request = urllib_request.Request(
        LEAD_NOTIFICATION_WEBHOOK_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "CyberSentil-LeadNotifier/1.0"},
        method="POST",
    )
    with urllib_request.urlopen(request, timeout=LEAD_NOTIFICATION_WEBHOOK_TIMEOUT_SECONDS) as response:
        status_code = int(getattr(response, "status", 200) or 200)
        if status_code >= 400:
            raise RuntimeError(f"Webhook responded with HTTP {status_code}")


def _team_email_subject(context: dict[str, Any]) -> str:
    return f"[{LEAD_NOTIFICATION_BRAND_NAME}] {context['request_label']} from {context['name'] or context['email']}"


def _team_email_body(context: dict[str, Any]) -> str:
    lines = [
        f"{context['request_label']} received for {LEAD_NOTIFICATION_BRAND_NAME}.",
        "",
        f"Lead ID: {context['id']}",
        f"Name: {context['name'] or 'n/a'}",
        f"Email: {context['email'] or 'n/a'}",
        f"Organization: {context['organization'] or 'n/a'}",
        f"Use case: {context['use_case'] or 'n/a'}",
        f"Submitted: {context['created_at'] or 'n/a'}",
        f"Source page: {context['source_page'] or 'n/a'}",
        f"Source URL: {context['page_url'] or 'n/a'}",
        "",
        "Message:",
        context["message"] or "n/a",
    ]
    if context["campaign"] or context["utm_source"] or context["utm_medium"] or context["utm_campaign"]:
        lines.extend(
            [
                "",
                "Campaign metadata:",
                f"Campaign: {context['campaign'] or 'n/a'}",
                f"UTM source: {context['utm_source'] or 'n/a'}",
                f"UTM medium: {context['utm_medium'] or 'n/a'}",
                f"UTM campaign: {context['utm_campaign'] or 'n/a'}",
            ]
        )
    return "\n".join(lines).strip()


def _autoreply_subject(context: dict[str, Any]) -> str:
    return f"We received your {LEAD_NOTIFICATION_BRAND_NAME} {context['request_type']} request"


def _autoreply_body(context: dict[str, Any]) -> str:
    lines = [
        f"Hi {context['name'] or 'there'},",
        "",
        f"Your {LEAD_NOTIFICATION_BRAND_NAME} {context['request_type']} request was received.",
        "We will review the details and follow up within 1 business day.",
    ]
    if context["request_type"] == "demo" and LEAD_AUTOREPLY_DEMO_BOOKING_URL:
        lines.extend(
            [
                "",
                "If your team already wants a fixed slot, you can book here now:",
                LEAD_AUTOREPLY_DEMO_BOOKING_URL,
            ]
        )
    if LEAD_NOTIFICATION_CONTACT_EMAIL:
        lines.extend(
            [
                "",
                "If you need to update the request before we reply, contact:",
                LEAD_NOTIFICATION_CONTACT_EMAIL,
            ]
        )
    lines.extend(
        [
            "",
            "Original request summary:",
            f"Organization: {context['organization'] or 'n/a'}",
            f"Use case: {context['use_case'] or 'n/a'}",
            "",
            "Thanks,",
            LEAD_NOTIFICATION_BRAND_NAME,
        ]
    )
    return "\n".join(lines).strip()


def dispatch_lead_notifications(lead: dict[str, Any]) -> dict[str, Any]:
    context = _lead_context(lead)
    statuses: dict[str, str] = {}
    errors: list[str] = []
    sent_any = False

    if str(lead.get("status") or "").strip().lower() == "spam":
        statuses.update({"team_webhook": "skipped_spam", "team_email": "skipped_spam", "lead_autoreply": "skipped_spam", "system": "blocked"})
        return {"notification_channel_status": statuses, "notification_error": "Flagged for review", "notification_sent_at": None}

    if bool(lead.get("is_repeat")):
        statuses.update(
            {
                "team_webhook": "skipped_duplicate",
                "team_email": "skipped_duplicate",
                "lead_autoreply": "skipped_duplicate",
                "system": "duplicate",
            }
        )
        return {"notification_channel_status": statuses, "notification_error": "", "notification_sent_at": None}

    if LEAD_NOTIFICATION_WEBHOOK_URL:
        try:
            _send_webhook(
                {
                    "event": "lead.created",
                    "brand": LEAD_NOTIFICATION_BRAND_NAME,
                    "lead": context,
                    "submitted_at": context["created_at"],
                }
            )
            statuses["team_webhook"] = "sent"
            sent_any = True
        except (HTTPError, URLError, OSError, RuntimeError) as exc:
            logger.warning("Lead webhook delivery failed for lead #%s: %s", context["id"], exc)
            statuses["team_webhook"] = "error"
            errors.append(f"team_webhook: {exc}")
    else:
        statuses["team_webhook"] = "disabled"

    if LEAD_NOTIFICATION_EMAIL_TO:
        if _smtp_ready():
            try:
                _send_smtp_email(
                    to_addrs=LEAD_NOTIFICATION_EMAIL_TO,
                    subject=_team_email_subject(context),
                    body=_team_email_body(context),
                    reply_to=context["email"],
                )
                statuses["team_email"] = "sent"
                sent_any = True
            except (smtplib.SMTPException, OSError, RuntimeError) as exc:
                logger.warning("Lead email delivery failed for lead #%s: %s", context["id"], exc)
                statuses["team_email"] = "error"
                errors.append(f"team_email: {exc}")
        else:
            statuses["team_email"] = "disabled"
    else:
        statuses["team_email"] = "disabled"

    if LEAD_AUTOREPLY_ENABLED:
        if _smtp_ready():
            try:
                reply_to = LEAD_AUTOREPLY_REPLY_TO or LEAD_NOTIFICATION_CONTACT_EMAIL
                _send_smtp_email(
                    to_addrs=[context["email"]],
                    subject=_autoreply_subject(context),
                    body=_autoreply_body(context),
                    reply_to=reply_to,
                )
                statuses["lead_autoreply"] = "sent"
                sent_any = True
            except (smtplib.SMTPException, OSError, RuntimeError) as exc:
                logger.warning("Lead auto-reply failed for lead #%s: %s", context["id"], exc)
                statuses["lead_autoreply"] = "error"
                errors.append(f"lead_autoreply: {exc}")
        else:
            statuses["lead_autoreply"] = "disabled"
    else:
        statuses["lead_autoreply"] = "disabled"

    enabled_channels = any(status not in {"disabled"} for key, status in statuses.items() if key != "system")
    if not enabled_channels:
        statuses["system"] = "no_channels"
    elif errors and sent_any:
        statuses["system"] = "partial"
    elif errors:
        statuses["system"] = "error"
    else:
        statuses["system"] = "sent"

    return {
        "notification_channel_status": statuses,
        "notification_error": "; ".join(errors),
        "notification_sent_at": iso_now() if sent_any else None,
    }
