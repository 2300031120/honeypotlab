import base64
import csv
import hashlib
import hmac
import io
import json
import logging
import secrets
import sqlite3
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from core.audit import record_operator_action
from core.config import ALLOWED_STATUS, LEAD_RATE_LIMIT_MAX_ATTEMPTS, LEAD_RATE_LIMIT_WINDOW_SECONDS, SECRET_KEY, STATUS_TRANSITIONS
from core.data_retention import cleanup_old_data, anonymize_ip_addresses
from core.request_logging import cleanup_old_request_logs, get_request_logs, get_request_log_stats
from core.database import db
from core.lead_notifications import dispatch_lead_notifications
from core.public_hosts import normalize_public_host, select_matching_site_row
from core.request_security import build_rate_limit_dependency
from core.time_utils import iso_now, utc_now
from dependencies import current_admin_user, current_user, require_csrf_optional
from schemas import LeadAssignPayload, LeadNotePayload, LeadSubmission, StatusUpdate


router = APIRouter()
logger = logging.getLogger(__name__)
lead_rate_limit = build_rate_limit_dependency("lead-submit", LEAD_RATE_LIMIT_MAX_ATTEMPTS, LEAD_RATE_LIMIT_WINDOW_SECONDS)
LEAD_CHALLENGE_TTL_SECONDS = 15 * 60


def _resolve_lead_scope_from_host(conn, host: str) -> tuple[int | None, int | None]:
    rows = conn.execute("select id, user_id, domain from sites order by id asc").fetchall()
    row = select_matching_site_row(rows, host, allow_local_singleton_fallback=True)
    if row is None:
        return None, None
    user_id = row["user_id"] if row["user_id"] is not None else None
    return (int(user_id) if user_id is not None else None, int(row["id"]))


def _resolve_lead_scope(conn, request: Request, payload: "LeadSubmission") -> tuple[int | None, int | None]:
    host = normalize_public_host(request.headers.get("host") or request.url.hostname or "")
    user_id, site_id = _resolve_lead_scope_from_host(conn, host)
    if user_id is not None or site_id is not None:
        return user_id, site_id
    source_host = normalize_public_host(urlparse(str(payload.source or "")).hostname or "")
    if source_host:
        return _resolve_lead_scope_from_host(conn, source_host)
    return None, None


def _lead_filter_for_user(user_id: int) -> tuple[str, list[Any]]:
    return "user_id = ?", [user_id]


def _tenant_lead_or_404(conn, user_id: int, lead_id: int) -> sqlite3.Row:
    lead = conn.execute("select * from leads where id = ? and user_id = ?", (lead_id, user_id)).fetchone()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    return lead


def _challenge_signature(left: int, right: int, issued_at: int, nonce: str) -> str:
    raw = f"{left}:{right}:{issued_at}:{nonce}".encode("utf-8")
    return hmac.new(SECRET_KEY.encode("utf-8"), raw, hashlib.sha256).hexdigest()


def challenge_payload() -> dict[str, Any]:
    left = secrets.randbelow(8) + 2
    right = secrets.randbelow(8) + 2
    issued_at = int(utc_now().timestamp())
    nonce = secrets.token_urlsafe(8)
    encoded = {
        "left": left,
        "right": right,
        "issued_at": issued_at,
        "nonce": nonce,
        "sig": _challenge_signature(left, right, issued_at, nonce),
    }
    challenge_id = base64.urlsafe_b64encode(json.dumps(encoded, separators=(",", ":")).encode("utf-8")).decode("ascii")
    return {"enabled": True, "challenge_id": challenge_id, "prompt": f"What is {left} + {right}?"}


def verify_challenge(challenge_id: str | None, challenge_answer: str | None) -> bool:
    if not challenge_id:
        return False
    try:
        raw = base64.urlsafe_b64decode(challenge_id.encode("ascii")).decode("utf-8")
        payload = json.loads(raw)
        left = int(payload["left"])
        right = int(payload["right"])
        issued_at = int(payload["issued_at"])
        nonce = str(payload["nonce"])
        signature = str(payload["sig"])
        if utc_now().timestamp() - issued_at > LEAD_CHALLENGE_TTL_SECONDS:
            return False
        expected_signature = _challenge_signature(left, right, issued_at, nonce)
        if not hmac.compare_digest(signature, expected_signature):
            return False
        return str(left + right) == str(challenge_answer or "").strip()
    except Exception:
        return False


def honeypot_triggered(payload: LeadSubmission) -> bool:
    if payload.referral_code.strip():
        return True
    legacy_value = payload.website.strip()
    if not legacy_value:
        return False
    normalized_legacy = legacy_value.casefold()
    if normalized_legacy in {
        payload.email.strip().casefold(),
        payload.name.strip().casefold(),
        payload.organization.strip().casefold(),
    }:
        return False
    return True


def save_lead(request_type: str, payload: LeadSubmission, request: Request) -> dict[str, Any]:
    if honeypot_triggered(payload):
        raise HTTPException(status_code=400, detail="Spam trap triggered.")
    if not verify_challenge(payload.challenge_id, payload.challenge_answer):
        raise HTTPException(status_code=400, detail="Challenge validation failed.")
    now = iso_now()
    email = payload.email.strip().lower()
    lead_id = 0
    user_id: int | None = None
    site_id: int | None = None
    is_repeat = 0
    status = "new"
    with db() as conn:
        user_id, site_id = _resolve_lead_scope(conn, request, payload)
        if user_id is not None:
            existing = conn.execute(
                "select * from leads where user_id = ? and email = ? and request_type = ? order by id desc limit 1",
                (user_id, email, request_type),
            ).fetchone()
        else:
            existing = conn.execute(
                "select * from leads where user_id is null and email = ? and request_type = ? order by id desc limit 1",
                (email, request_type),
            ).fetchone()
        is_repeat = 1 if existing else 0
        spam_score = 10 if is_repeat else 0
        if len(payload.message.strip()) < 14:
            spam_score += 20
        status = "spam" if spam_score >= 40 else "new"
        cur = conn.execute(
            """
            insert into leads (
                user_id, site_id,
                request_type, name, email, organization, use_case, message, status, assigned_to,
                spam_score, is_repeat, source_page, campaign, utm_source, utm_medium, utm_campaign,
                notification_sent_at, notification_error, notification_channel_status, created_at, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                site_id,
                request_type,
                payload.name.strip(),
                email,
                payload.organization.strip(),
                payload.use_case.strip(),
                payload.message.strip(),
                status,
                "",
                spam_score,
                is_repeat,
                payload.source,
                payload.campaign,
                payload.utm_source,
                payload.utm_medium,
                payload.utm_campaign,
                None,
                "",
                json.dumps({"system": "pending"}),
                now,
                now,
            ),
        )
        lead_id = int(cur.lastrowid or 0)
    notification_result: dict[str, Any]
    try:
        notification_result = dispatch_lead_notifications(
            {
                "id": lead_id,
                "user_id": user_id,
                "site_id": site_id,
                "request_type": request_type,
                "name": payload.name.strip(),
                "email": email,
                "organization": payload.organization.strip(),
                "use_case": payload.use_case.strip(),
                "message": payload.message.strip(),
                "status": status,
                "is_repeat": bool(is_repeat),
                "source_page": payload.source,
                "campaign": payload.campaign,
                "utm_source": payload.utm_source,
                "utm_medium": payload.utm_medium,
                "utm_campaign": payload.utm_campaign,
                "created_at": now,
            }
        )
    except Exception as exc:
        logger.exception("Lead notification dispatch failed for lead #%s", lead_id)
        notification_result = {
            "notification_channel_status": {"system": "error"},
            "notification_error": f"notification_runtime: {exc}",
            "notification_sent_at": None,
        }
    with db() as conn:
        conn.execute(
            "update leads set notification_sent_at = ?, notification_error = ?, notification_channel_status = ?, updated_at = ? where id = ?",
            (
                notification_result.get("notification_sent_at"),
                str(notification_result.get("notification_error") or ""),
                json.dumps(notification_result.get("notification_channel_status") or {}),
                iso_now(),
                lead_id,
            ),
        )
    if status == "spam":
        message = "Request captured for manual review. Use the contact path for urgent follow-up."
        next_step = "manual_review"
        review_state = "manual_review"
    elif is_repeat:
        message = "Request already received. Team will continue from the existing thread."
        next_step = "existing_thread"
        review_state = "duplicate"
    else:
        message = "Request received. Team will review it shortly."
        next_step = "team_review"
        review_state = "new"
    return {
        "id": lead_id,
        "status": "duplicate_suppressed" if is_repeat else "accepted",
        "duplicate": bool(is_repeat),
        "is_repeat": bool(is_repeat),
        "lead_status": status,
        "spam_blocked": status == "spam",
        "review_state": review_state,
        "next_step": next_step,
        "message": message,
    }


def lead_with_flags(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["is_repeat"] = bool(item["is_repeat"])
    try:
        item["notification_channel_status"] = json.loads(item["notification_channel_status"] or "{}")
    except Exception:
        item["notification_channel_status"] = {}
    return item


@router.get("/lead/challenge")
def lead_challenge() -> dict[str, Any]:
    return challenge_payload()


@router.post("/contact/submit")
def contact_submit(payload: LeadSubmission, request: Request, _: None = Depends(lead_rate_limit), __: None = Depends(require_csrf_optional)) -> dict[str, Any]:
    return save_lead("contact", payload, request)


@router.post("/demo/submit")
def demo_submit(payload: LeadSubmission, request: Request, _: None = Depends(lead_rate_limit), __: None = Depends(require_csrf_optional)) -> dict[str, Any]:
    return save_lead("demo", payload, request)


@router.get("/admin/leads/statuses")
def admin_lead_statuses(_: dict[str, Any] = Depends(current_admin_user)) -> dict[str, Any]:
    return {"statuses": ALLOWED_STATUS, "transitions": STATUS_TRANSITIONS}


@router.get("/admin/leads")
def admin_leads(
    request_type: str | None = None,
    status: str | None = None,
    assigned_to: str | None = None,
    q: str | None = None,
    created_from: str | None = None,
    created_to: str | None = None,
    limit: int = 50,
    offset: int = 0,
    user: dict[str, Any] = Depends(current_admin_user),
) -> dict[str, Any]:
    where, params = _lead_filter_for_user(int(user["id"]))
    clauses = [where]
    if request_type:
        clauses.append("request_type = ?")
        params.append(request_type)
    if status:
        clauses.append("status = ?")
        params.append(status)
    if assigned_to:
        clauses.append("assigned_to = ?")
        params.append(assigned_to)
    if q:
        clauses.append("(name like ? or email like ? or organization like ? or use_case like ?)")
        qv = f"%{q}%"
        params.extend([qv, qv, qv, qv])
    if created_from:
        clauses.append("date(created_at) >= date(?)")
        params.append(created_from)
    if created_to:
        clauses.append("date(created_at) <= date(?)")
        params.append(created_to)
    where_clause = f"where {' and '.join(clauses)}"
    with db() as conn:
        total = conn.execute(f"select count(*) as count from leads {where_clause}", params).fetchone()["count"]
        rows = conn.execute(
            f"select * from leads {where_clause} order by datetime(created_at) desc limit ? offset ?",
            (*params, limit, offset),
        ).fetchall()
    return {"items": [lead_with_flags(row) for row in rows], "total": total, "limit": limit, "offset": offset}


@router.get("/admin/leads/owners")
def admin_lead_owners(user: dict[str, Any] = Depends(current_admin_user)) -> dict[str, Any]:
    return {"owners": [{"username": user["username"], "role": user["role"]}]}


@router.get("/admin/leads/report")
def admin_lead_report(user: dict[str, Any] = Depends(current_admin_user)) -> dict[str, Any]:
    where, params = _lead_filter_for_user(int(user["id"]))
    with db() as conn:
        total = conn.execute(f"select count(*) as count from leads where {where}", params).fetchone()["count"]
        repeat = conn.execute(f"select count(*) as count from leads where {where} and is_repeat = 1", params).fetchone()["count"]
        failures = conn.execute(
            f"select count(*) as count from leads where {where} and notification_error is not null and notification_error != ''",
            params,
        ).fetchone()["count"]
        demo_count = conn.execute(f"select count(*) as count from leads where {where} and request_type = 'demo'", params).fetchone()["count"]
    return {
        "totals": {"all": total, "repeat": repeat, "notification_failures": failures},
        "demo_requests_by_week": [{"week": "current", "count": demo_count}],
    }


@router.get("/admin/leads/export.csv")
def admin_export_leads(
    request_type: str | None = None,
    status: str | None = None,
    user: dict[str, Any] = Depends(current_admin_user),
) -> StreamingResponse:
    where, params = _lead_filter_for_user(int(user["id"]))
    clauses = [where]
    if request_type:
        clauses.append("request_type = ?")
        params.append(request_type)
    if status:
        clauses.append("status = ?")
        params.append(status)
    where_clause = f"where {' and '.join(clauses)}"
    with db() as conn:
        rows = conn.execute(f"select * from leads {where_clause} order by datetime(created_at) desc", params).fetchall()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["id", "request_type", "name", "email", "organization", "use_case", "status", "assigned_to", "created_at"])
    for row in rows:
        writer.writerow([row["id"], row["request_type"], row["name"], row["email"], row["organization"], row["use_case"], row["status"], row["assigned_to"], row["created_at"]])
    buffer.seek(0)
    return StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv")


@router.get("/admin/leads/{lead_id}")
def admin_lead_detail(lead_id: int, user: dict[str, Any] = Depends(current_admin_user)) -> dict[str, Any]:
    with db() as conn:
        lead = _tenant_lead_or_404(conn, int(user["id"]), lead_id)
        notes = conn.execute("select * from lead_notes where lead_id = ? order by datetime(created_at) desc", (lead_id,)).fetchall()
        history = conn.execute(
            "select * from lead_status_history where lead_id = ? order by datetime(changed_at) desc",
            (lead_id,),
        ).fetchall()
    return {"lead": lead_with_flags(lead), "notes": [dict(row) for row in notes], "status_history": [dict(row) for row in history]}


@router.post("/admin/leads/{lead_id}/status")
def admin_update_lead_status(lead_id: int, payload: StatusUpdate, user: dict[str, Any] = Depends(current_admin_user)) -> dict[str, Any]:
    if payload.status not in ALLOWED_STATUS:
        raise HTTPException(status_code=400, detail="Invalid lead status.")
    actor = (user or {}).get("username", "admin")
    now = iso_now()
    with db() as conn:
        lead = _tenant_lead_or_404(conn, int(user["id"]), lead_id)
        current_status = str(lead["status"] or "new")
        allowed_next = STATUS_TRANSITIONS.get(current_status, [])
        if payload.status != current_status and payload.status not in allowed_next:
            raise HTTPException(status_code=400, detail=f"Invalid transition from {current_status} to {payload.status}.")
        conn.execute(
            "update leads set status = ?, updated_at = ?, first_response_at = coalesce(first_response_at, ?) where id = ?",
            (payload.status, now, now if payload.status != "new" else None, lead_id),
        )
        cur = conn.execute(
            "insert into lead_status_history (lead_id, old_status, new_status, changed_by_username, changed_at) values (?, ?, ?, ?, ?)",
            (lead_id, current_status, payload.status, actor, now),
        )
        updated = conn.execute("select * from leads where id = ?", (lead_id,)).fetchone()
        history_row = conn.execute("select * from lead_status_history where id = ?", (cur.lastrowid,)).fetchone()
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=actor,
            action="lead.status_update",
            summary=f"Updated lead #{lead_id} status from {current_status} to {payload.status}",
            severity="medium",
            target_type="lead",
            target_id=lead_id,
            metadata={"old_status": current_status, "new_status": payload.status},
        )
    return {"lead": lead_with_flags(updated), "history_item": dict(history_row)}


@router.post("/admin/leads/{lead_id}/notes")
def admin_add_lead_note(lead_id: int, payload: LeadNotePayload, user: dict[str, Any] = Depends(current_admin_user)) -> dict[str, Any]:
    actor = (user or {}).get("username", "admin")
    note_text = payload.note.strip()
    with db() as conn:
        lead = _tenant_lead_or_404(conn, int(user["id"]), lead_id)
        cur = conn.execute(
            "insert into lead_notes (lead_id, author_username, note_text, created_at) values (?, ?, ?, ?)",
            (lead_id, actor, note_text, iso_now()),
        )
        note = conn.execute("select * from lead_notes where id = ?", (cur.lastrowid,)).fetchone()
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(actor),
            action="lead.add_note",
            summary=f"Added note to lead #{lead_id}",
            severity="low",
            target_type="lead",
            target_id=lead_id,
            metadata={"note_length": len(note_text)},
        )
    return {"note": dict(note), "lead": lead_with_flags(lead)}


@router.post("/admin/leads/{lead_id}/assign")
def admin_assign_lead(lead_id: int, payload: LeadAssignPayload, user: dict[str, Any] = Depends(current_admin_user)) -> dict[str, Any]:
    assigned_to = payload.assigned_to.strip()
    with db() as conn:
        _tenant_lead_or_404(conn, int(user["id"]), lead_id)
        conn.execute("update leads set assigned_to = ?, updated_at = ? where id = ?", (assigned_to, iso_now(), lead_id))
        updated = conn.execute("select * from leads where id = ?", (lead_id,)).fetchone()
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str((user or {}).get("username") or "admin"),
            action="lead.assign",
            summary=f"Assigned lead #{lead_id} to {assigned_to}",
            severity="medium",
            target_type="lead",
            target_id=lead_id,
            metadata={"assigned_to": assigned_to},
        )
    return {"lead": lead_with_flags(updated)}


@router.post("/admin/data-retention/cleanup")
def admin_data_retention_cleanup(user: dict[str, Any] = Depends(current_admin_user)) -> dict[str, Any]:
    """Trigger data retention cleanup (admin only)"""
    result = cleanup_old_data()
    with db() as conn:
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "admin"),
            action="data_retention.cleanup",
            summary=f"Data retention cleanup: {result['total_deleted']} records deleted",
            severity="low",
            target_type="system",
            metadata=result,
        )
    return result


@router.post("/admin/data-retention/anonymize-ips")
def admin_anonymize_ips(user: dict[str, Any] = Depends(current_admin_user)) -> dict[str, Any]:
    """Trigger IP address anonymization (admin only)"""
    result = anonymize_ip_addresses()
    with db() as conn:
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "admin"),
            action="data_retention.anonymize_ips",
            summary=f"IP address anonymization: {result['anonymized_count']} addresses anonymized",
            severity="low",
            target_type="system",
            metadata=result,
        )
    return result


@router.get("/admin/request-logs")
def admin_request_logs(
    limit: int = 100,
    offset: int = 0,
    client_ip: str | None = None,
    status_code: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    _: dict[str, Any] = Depends(current_admin_user)
) -> dict[str, Any]:
    """Get request logs with optional filters (admin only)"""
    logs = get_request_logs(limit, offset, client_ip, None, status_code, start_date, end_date)
    return {"logs": logs, "count": len(logs)}


@router.get("/admin/request-logs/stats")
def admin_request_log_stats(days: int = 7, _: dict[str, Any] = Depends(current_admin_user)) -> dict[str, Any]:
    """Get request log statistics (admin only)"""
    return get_request_log_stats(days)


@router.post("/admin/request-logs/cleanup")
def admin_request_logs_cleanup(_: dict[str, Any] = Depends(current_admin_user)) -> dict[str, Any]:
    """Clean up old request logs (admin only)"""
    deleted_count = cleanup_old_request_logs()
    return {"deleted_count": deleted_count}
