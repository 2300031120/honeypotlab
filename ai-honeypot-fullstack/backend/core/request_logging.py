import json
import logging
from typing import Any
from datetime import datetime

from core.database import db
from core.time_utils import iso_now, utc_now
from core.request_security import extract_client_ip

logger = logging.getLogger(__name__)

# Log retention period in days
REQUEST_LOG_RETENTION_DAYS = 30


def log_request(
    request: Any,
    response_status: int,
    response_time_ms: float,
    user_id: int | None = None,
    error_message: str | None = None
) -> None:
    """Log an API request for security monitoring"""
    try:
        client_ip = extract_client_ip(request)
        method = request.method
        path = request.url.path
        user_agent = request.headers.get("user-agent", "")[:500]
        referer = request.headers.get("referer", "")[:500]
        
        # Sanitize sensitive headers
        headers_to_log = {}
        sensitive_headers = {"authorization", "cookie", "x-api-key", "token"}
        for key, value in request.headers.items():
            if key.lower() not in sensitive_headers:
                headers_to_log[key] = str(value)[:200]
        
        # Get user info if available
        username = None
        if user_id:
            with db() as conn:
                user = conn.execute("select username from users where id = ?", (user_id,)).fetchone()
                if user:
                    username = user["username"]
        
        # Store log entry
        now = iso_now()
        with db() as conn:
            conn.execute(
                """insert into request_logs 
                (timestamp, client_ip, method, path, status_code, response_time_ms, 
                 user_id, username, user_agent, referer, headers, error_message)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    now,
                    client_ip,
                    method,
                    path,
                    response_status,
                    int(response_time_ms),
                    user_id,
                    username,
                    user_agent,
                    referer,
                    json.dumps(headers_to_log),
                    error_message
                )
            )
    except Exception as e:
        logger.error(f"Failed to log request: {e}")


def cleanup_old_request_logs() -> int:
    """Clean up request logs older than retention period"""
    try:
        cutoff_date = (utc_now() - datetime.timedelta(days=REQUEST_LOG_RETENTION_DAYS)).isoformat()
        with db() as conn:
            result = conn.execute(
                "delete from request_logs where timestamp < ?",
                (cutoff_date,)
            )
            deleted_count = result.rowcount
            logger.info(f"Cleaned up {deleted_count} old request logs")
            return deleted_count
    except Exception as e:
        logger.error(f"Failed to cleanup old request logs: {e}")
        return 0


def get_request_logs(
    limit: int = 100,
    offset: int = 0,
    client_ip: str | None = None,
    user_id: int | None = None,
    status_code: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None
) -> list[dict[str, Any]]:
    """Get request logs with optional filters"""
    try:
        conditions = []
        params = []
        
        if client_ip:
            conditions.append("client_ip = ?")
            params.append(client_ip)
        
        if user_id:
            conditions.append("user_id = ?")
            params.append(user_id)
        
        if status_code:
            conditions.append("status_code = ?")
            params.append(status_code)
        
        if start_date:
            conditions.append("timestamp >= ?")
            params.append(start_date)
        
        if end_date:
            conditions.append("timestamp <= ?")
            params.append(end_date)
        
        where_clause = " and ".join(conditions) if conditions else "1=1"
        params.extend([limit, offset])
        
        with db() as conn:
            rows = conn.execute(
                f"""select * from request_logs 
                where {where_clause}
                order by timestamp desc
                limit ? offset ?""",
                params
            ).fetchall()
        
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Failed to get request logs: {e}")
        return []


def get_request_log_stats(days: int = 7) -> dict[str, Any]:
    """Get request log statistics for the last N days"""
    try:
        cutoff_date = (utc_now() - datetime.timedelta(days=days)).isoformat()
        
        with db() as conn:
            # Total requests
            total = conn.execute(
                "select count(*) as count from request_logs where timestamp >= ?",
                (cutoff_date,)
            ).fetchone()["count"]
            
            # Requests by status code
            status_counts = conn.execute(
                """select status_code, count(*) as count 
                from request_logs 
                where timestamp >= ?
                group by status_code
                order by count desc""",
                (cutoff_date,)
            ).fetchall()
            
            # Requests by path
            path_counts = conn.execute(
                """select path, count(*) as count 
                from request_logs 
                where timestamp >= ?
                group by path
                order by count desc
                limit 10""",
                (cutoff_date,)
            ).fetchall()
            
            # Error rate
            errors = conn.execute(
                """select count(*) as count 
                from request_logs 
                where timestamp >= ? and status_code >= 400""",
                (cutoff_date,)
            ).fetchone()["count"]
            
            error_rate = (errors / total * 100) if total > 0 else 0
            
            return {
                "total_requests": total,
                "error_count": errors,
                "error_rate": round(error_rate, 2),
                "status_distribution": {row["status_code"]: row["count"] for row in status_counts},
                "top_paths": {row["path"]: row["count"] for row in path_counts},
                "period_days": days
            }
    except Exception as e:
        logger.error(f"Failed to get request log stats: {e}")
        return {}
