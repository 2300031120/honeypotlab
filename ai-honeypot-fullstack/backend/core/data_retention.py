import logging
from datetime import datetime, timedelta
from typing import Any

from core.config import (
    env_int,
    EVENTS_RETENTION_DAYS,
    LEADS_RETENTION_DAYS,
    AUDIT_LOG_RETENTION_DAYS,
    BLOCKED_IPS_RETENTION_DAYS,
    REQUEST_LOGS_RETENTION_DAYS,
)
from core.database import db
from core.time_utils import utc_now

logger = logging.getLogger(__name__)


def _delete_old_events() -> dict[str, Any]:
    """Delete events older than retention period"""
    cutoff_date = utc_now() - timedelta(days=EVENTS_RETENTION_DAYS)
    with db() as conn:
        cursor = conn.execute(
            "delete from events where created_at < ?",
            (cutoff_date.isoformat(),),
        )
        deleted_count = cursor.rowcount
    return {"type": "events", "deleted": deleted_count, "cutoff": cutoff_date.isoformat()}


def _delete_old_leads() -> dict[str, Any]:
    """Delete leads older than retention period (excluding active leads)"""
    cutoff_date = utc_now() - timedelta(days=LEADS_RETENTION_DAYS)
    with db() as conn:
        cursor = conn.execute(
            "delete from leads where created_at < ? and status in ('spam', 'closed_lost', 'closed_won')",
            (cutoff_date.isoformat(),),
        )
        deleted_count = cursor.rowcount
    return {"type": "leads", "deleted": deleted_count, "cutoff": cutoff_date.isoformat()}


def _delete_old_audit_logs() -> dict[str, Any]:
    """Delete audit logs older than retention period"""
    cutoff_date = utc_now() - timedelta(days=AUDIT_LOG_RETENTION_DAYS)
    with db() as conn:
        cursor = conn.execute(
            "delete from operator_actions where created_at < ?",
            (cutoff_date.isoformat(),),
        )
        deleted_count = cursor.rowcount
    return {"type": "audit_logs", "deleted": deleted_count, "cutoff": cutoff_date.isoformat()}


def _delete_old_blocked_ips() -> dict[str, Any]:
    """Delete blocked IPs older than retention period"""
    cutoff_date = utc_now() - timedelta(days=BLOCKED_IPS_RETENTION_DAYS)
    with db() as conn:
        cursor = conn.execute(
            "delete from blocked_ips where created_at < ?",
            (cutoff_date.isoformat(),),
        )
        deleted_count = cursor.rowcount
    return {"type": "blocked_ips", "deleted": deleted_count, "cutoff": cutoff_date.isoformat()}


def _delete_old_request_logs() -> dict[str, Any]:
    """Delete request logs older than retention period"""
    cutoff_date = utc_now() - timedelta(days=REQUEST_LOGS_RETENTION_DAYS)
    with db() as conn:
        cursor = conn.execute(
            "delete from request_logs where created_at < ?",
            (cutoff_date.isoformat(),),
        )
        deleted_count = cursor.rowcount
    return {"type": "request_logs", "deleted": deleted_count, "cutoff": cutoff_date.isoformat()}


def cleanup_old_data() -> dict[str, Any]:
    """
    Run data retention cleanup for all data types.
    Returns summary of deletions.
    """
    logger.info("Starting data retention cleanup")
    
    results = []
    
    try:
        results.append(_delete_old_events())
        logger.info(f"Deleted {results[-1]['deleted']} old events")
    except Exception as exc:
        logger.error(f"Failed to delete old events: {exc}")
        results.append({"type": "events", "error": str(exc)})
    
    try:
        results.append(_delete_old_leads())
        logger.info(f"Deleted {results[-1]['deleted']} old leads")
    except Exception as exc:
        logger.error(f"Failed to delete old leads: {exc}")
        results.append({"type": "leads", "error": str(exc)})
    
    try:
        results.append(_delete_old_audit_logs())
        logger.info(f"Deleted {results[-1]['deleted']} old audit logs")
    except Exception as exc:
        logger.error(f"Failed to delete old audit logs: {exc}")
        results.append({"type": "audit_logs", "error": str(exc)})
    
    try:
        results.append(_delete_old_blocked_ips())
        logger.info(f"Deleted {results[-1]['deleted']} old blocked IPs")
    except Exception as exc:
        logger.error(f"Failed to delete old blocked IPs: {exc}")
        results.append({"type": "blocked_ips", "error": str(exc)})
    
    try:
        results.append(_delete_old_request_logs())
        logger.info(f"Deleted {results[-1]['deleted']} old request logs")
    except Exception as exc:
        logger.error(f"Failed to delete old request logs: {exc}")
        results.append({"type": "request_logs", "error": str(exc)})
    
    total_deleted = sum(r.get("deleted", 0) for r in results)
    summary = {
        "timestamp": utc_now().isoformat(),
        "total_deleted": total_deleted,
        "results": results,
    }
    
    logger.info(f"Data retention cleanup complete: {total_deleted} records deleted")
    return summary


def anonymize_ip_addresses() -> dict[str, Any]:
    """
    Anonymize IP addresses in events by keeping only first 3 octets.
    This is a privacy enhancement for GDPR compliance.
    """
    logger.info("Starting IP address anonymization")
    
    with db() as conn:
        # Get all events with IP addresses
        rows = conn.execute(
            "select id, source_ip from events where source_ip is not null and source_ip != ''"
        ).fetchall()
        
        anonymized_count = 0
        for row in rows:
            ip = row["source_ip"]
            try:
                # Keep only first 3 octets for IPv4
                if "." in ip:
                    parts = ip.split(".")
                    if len(parts) == 4:
                        anonymized_ip = f"{parts[0]}.{parts[1]}.{parts[2]}.0"
                        conn.execute(
                            "update events set source_ip = ? where id = ?",
                            (anonymized_ip, row["id"]),
                        )
                        anonymized_count += 1
                # For IPv6, keep first 3 hextets
                elif ":" in ip:
                    parts = ip.split(":")
                    if len(parts) >= 3:
                        anonymized_ip = f"{parts[0]}:{parts[1]}:{parts[2]}::"
                        conn.execute(
                            "update events set source_ip = ? where id = ?",
                            (anonymized_ip, row["id"]),
                        )
                        anonymized_count += 1
            except Exception:
                # Skip invalid IP addresses
                continue
    
    logger.info(f"IP address anonymization complete: {anonymized_count} addresses anonymized")
    return {
        "timestamp": utc_now().isoformat(),
        "anonymized_count": anonymized_count,
    }
