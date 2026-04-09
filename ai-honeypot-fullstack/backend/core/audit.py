import json
import logging
from typing import Any

from core.time_utils import iso_now

logger = logging.getLogger(__name__)


def _safe_metadata(metadata: dict[str, Any] | None) -> str:
    if not metadata:
        return "{}"
    return json.dumps(metadata, sort_keys=True, default=str)


def _load_metadata(raw: Any) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(str(raw))
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def record_operator_action(
    conn,
    *,
    user_id: int,
    actor_username: str,
    action: str,
    summary: str,
    severity: str = "medium",
    target_type: str | None = None,
    target_id: str | int | None = None,
    source_ip: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    conn.execute(
        """
        insert into operator_actions (
            user_id, actor_username, action, target_type, target_id, summary, severity, source_ip, metadata, created_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            int(user_id),
            str(actor_username or "operator").strip() or "operator",
            str(action or "").strip(),
            str(target_type or "").strip() or None,
            str(target_id).strip() if target_id is not None else None,
            str(summary or "").strip(),
            str(severity or "medium").strip().lower() or "medium",
            str(source_ip or "").strip() or None,
            _safe_metadata(metadata),
            iso_now(),
        ),
    )


def operator_action_log_entry(row: dict[str, Any]) -> dict[str, Any]:
    severity = str(row.get("severity") or "medium").strip().lower() or "medium"
    risk_score = {"low": 35.0, "medium": 68.0, "high": 92.0}.get(severity, 68.0)
    created_at = row.get("created_at")
    return {
        "source": "operator",
        "ts": created_at,
        "timestamp": created_at,
        "timestamp_utc": created_at,
        "ip": row.get("source_ip"),
        "cmd": row.get("summary"),
        "deception_mode": "OPERATOR ACTION",
        "risk_score": risk_score,
        "severity": severity,
        "actor_username": row.get("actor_username"),
        "action": row.get("action"),
        "target_type": row.get("target_type"),
        "target_id": row.get("target_id"),
        "metadata": _load_metadata(row.get("metadata")),
    }


# SECURITY EVENT LOGGING - NEW FUNCTIONS ADDED
def log_security_event(
    event_type: str,
    severity: str = "medium",
    source_ip: str | None = None,
    user_id: int | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Log security events for monitoring and audit trails"""
    event_data = {
        "event_type": event_type,
        "severity": severity,
        "source_ip": source_ip,
        "user_id": user_id,
        "details": details or {},
        "timestamp": iso_now(),
    }
    
    log_message = f"SECURITY_EVENT: {event_type} | Severity: {severity}"
    if source_ip:
        log_message += f" | IP: {source_ip}"
    
    if severity == "high":
        logger.warning(log_message, extra={"security_event": event_data})
    elif severity == "critical":
        logger.error(log_message, extra={"security_event": event_data})
    else:
        logger.info(log_message, extra={"security_event": event_data})


def log_failed_login(
    username: str,
    source_ip: str,
    reason: str = "invalid_credentials",
    user_id: int | None = None,
) -> None:
    """Log failed login attempts for security monitoring"""
    log_security_event(
        event_type="failed_login",
        severity="high",
        source_ip=source_ip,
        user_id=user_id,
        details={
            "username": username,
            "reason": reason,
            "action": "authentication_failed",
        },
    )


def log_sql_injection_attempt(
    source_ip: str,
    query: str,
    pattern_detected: str,
    user_id: int | None = None,
) -> None:
    """Log SQL injection attempts"""
    log_security_event(
        event_type="sql_injection_attempt",
        severity="critical",
        source_ip=source_ip,
        user_id=user_id,
        details={
            "query_preview": query[:100] + "..." if len(query) > 100 else query,
            "pattern_detected": pattern_detected,
            "action": "blocked",
        },
    )


def log_rate_limit_violation(
    source_ip: str,
    endpoint: str,
    limit: int,
    window: int,
    user_id: int | None = None,
) -> None:
    """Log rate limit violations"""
    log_security_event(
        event_type="rate_limit_violation",
        severity="medium",
        source_ip=source_ip,
        user_id=user_id,
        details={
            "endpoint": endpoint,
            "limit": limit,
            "window_seconds": window,
            "action": "throttled",
        },
    )


def log_suspicious_activity(
    source_ip: str,
    activity_type: str,
    details: dict[str, Any],
    severity: str = "high",
    user_id: int | None = None,
) -> None:
    """Log general suspicious activities"""
    log_security_event(
        event_type=f"suspicious_{activity_type}",
        severity=severity,
        source_ip=source_ip,
        user_id=user_id,
        details=details,
    )


def log_command_validation_failure(
    source_ip: str,
    command: str,
    reason: str,
    user_id: int | None = None,
) -> None:
    """Log terminal command validation failures"""
    log_security_event(
        event_type="command_validation_failed",
        severity="high",
        source_ip=source_ip,
        user_id=user_id,
        details={
            "command_preview": command[:50] + "..." if len(command) > 50 else command,
            "reason": reason,
            "action": "blocked",
        },
    )
