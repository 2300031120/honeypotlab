from __future__ import annotations

import json
import logging
import os
import re
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Iterator

from core.config import (
    BACKEND_DB_PATH,
    BOOTSTRAP_ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_PASSWORD,
    BOOTSTRAP_ADMIN_USERNAME,
    DATABASE_BACKEND,
    DATABASE_URL,
    DB_PATH,
    ENABLE_DEMO_SEED,
)
from core.security import hash_password
from core.time_utils import iso_now, utc_now

logger = logging.getLogger(__name__)

MIGRATIONS_ROOT = Path(__file__).resolve().parents[1] / "migrations"
INSERT_ID_TABLES = {
    "users",
    "sites",
    "events",
    "blocked_ips",
    "leads",
    "lead_notes",
    "lead_status_history",
    "analytics_events",
    "canary_tokens",
}


def translate_sql_for_backend(sql: str, backend: str) -> str:
    translated = str(sql)
    if backend != "postgresql":
        return translated
    translated = re.sub(r"\bdatetime\(([^)]+)\)", r"\1", translated, flags=re.IGNORECASE)
    translated = re.sub(r"\binsert\s+or\s+ignore\s+into\b", "insert into", translated, flags=re.IGNORECASE)
    if "insert into blocked_ips" in translated.lower() and "on conflict" not in translated.lower():
        translated = translated.rstrip().rstrip(";") + " on conflict do nothing"
    translated = translated.replace("?", "%s")
    return translated


def _extract_insert_table(sql: str) -> str | None:
    match = re.search(r"^\s*insert(?:\s+or\s+ignore)?\s+into\s+([a-z_][a-z0-9_]*)", sql, flags=re.IGNORECASE)
    if not match:
        return None
    return match.group(1).lower()


def _normalize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, memoryview):
        return value.tobytes().decode("utf-8", errors="replace")
    return value


def _normalize_row(row: Any, description: Any = None) -> dict[str, Any] | None:
    if row is None:
        return None
    if isinstance(row, dict):
        return {key: _normalize_value(value) for key, value in row.items()}
    if isinstance(row, sqlite3.Row):
        return {key: _normalize_value(row[key]) for key in row.keys()}
    if hasattr(row, "keys"):
        return {key: _normalize_value(row[key]) for key in row.keys()}
    if description and isinstance(row, (list, tuple)):
        return {column[0]: _normalize_value(value) for column, value in zip(description, row)}
    return dict(row)


def _split_sql_script(script: str) -> list[str]:
    chunks: list[str] = []
    current: list[str] = []
    in_single_quote = False
    in_double_quote = False
    in_dollar_quote: str | None = None
    index = 0
    length = len(script)

    while index < length:
        char = script[index]
        if not in_single_quote and not in_double_quote:
            dollar_match = re.match(r"\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$", script[index:])
            if dollar_match:
                marker = dollar_match.group(0)
                current.append(marker)
                index += len(marker)
                if in_dollar_quote == marker:
                    in_dollar_quote = None
                elif in_dollar_quote is None:
                    in_dollar_quote = marker
                continue
        if in_dollar_quote:
            current.append(char)
            index += 1
            continue
        if char == "'" and not in_double_quote:
            in_single_quote = not in_single_quote
        elif char == '"' and not in_single_quote:
            in_double_quote = not in_double_quote
        if char == ";" and not in_single_quote and not in_double_quote:
            statement = "".join(current).strip()
            if statement:
                chunks.append(statement)
            current = []
            index += 1
            continue
        current.append(char)
        index += 1

    tail = "".join(current).strip()
    if tail:
        chunks.append(tail)
    return chunks


def _sqlite_path() -> str:
    if BACKEND_DB_PATH:
        return BACKEND_DB_PATH
    return DB_PATH or os.path.join(Path(__file__).resolve().parents[1], "runtime.db")


def _connect_sqlite() -> sqlite3.Connection:
    db_path = _sqlite_path()
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _connect_postgres():
    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError as exc:
        raise RuntimeError("PostgreSQL support requires psycopg. Install backend requirements first.") from exc

    return psycopg.connect(DATABASE_URL, autocommit=False, row_factory=dict_row)


class CursorAdapter:
    def __init__(self, cursor: Any, *, backend: str, lastrowid: int | None = None):
        self._cursor = cursor
        self._backend = backend
        self.lastrowid = lastrowid

    @property
    def description(self):
        return getattr(self._cursor, "description", None)

    def fetchone(self) -> dict[str, Any] | None:
        row = self._cursor.fetchone()
        return _normalize_row(row, self.description)

    def fetchall(self) -> list[dict[str, Any]]:
        rows = self._cursor.fetchall()
        return [_normalize_row(row, self.description) for row in rows]

    def __iter__(self):
        for row in self._cursor:
            yield _normalize_row(row, self.description)

    def close(self) -> None:
        close = getattr(self._cursor, "close", None)
        if callable(close):
            close()


class ConnectionAdapter:
    def __init__(self, raw_connection: Any, backend: str):
        self._raw_connection = raw_connection
        self.backend = backend

    def execute(self, sql: str, params: tuple[Any, ...] | list[Any] = ()) -> CursorAdapter:
        backend_sql = translate_sql_for_backend(sql, self.backend)
        insert_table = _extract_insert_table(sql)
        needs_returning = self.backend == "postgresql" and insert_table in INSERT_ID_TABLES and "returning" not in backend_sql.lower()
        if needs_returning:
            backend_sql = backend_sql.rstrip().rstrip(";") + " returning id"

        if self.backend == "sqlite":
            cursor = self._raw_connection.execute(backend_sql, params or ())
            return CursorAdapter(cursor, backend=self.backend, lastrowid=getattr(cursor, "lastrowid", None))

        cursor = self._raw_connection.cursor()
        cursor.execute(backend_sql, tuple(params or ()))
        lastrowid = None
        if needs_returning:
            row = cursor.fetchone()
            if row:
                normalized = _normalize_row(row, cursor.description) or {}
                row_id = normalized.get("id")
                if row_id is not None:
                    lastrowid = int(row_id)
        return CursorAdapter(cursor, backend=self.backend, lastrowid=lastrowid)

    def executescript(self, script: str) -> None:
        if self.backend == "sqlite":
            self._raw_connection.executescript(script)
            return

        for statement in _split_sql_script(script):
            cursor = self._raw_connection.cursor()
            try:
                cursor.execute(translate_sql_for_backend(statement, self.backend))
            finally:
                cursor.close()

    def commit(self) -> None:
        self._raw_connection.commit()

    def rollback(self) -> None:
        self._raw_connection.rollback()

    def close(self) -> None:
        self._raw_connection.close()


@contextmanager
def db() -> Iterator[ConnectionAdapter]:
    raw_connection = _connect_postgres() if DATABASE_BACKEND == "postgresql" else _connect_sqlite()
    conn = ConnectionAdapter(raw_connection, DATABASE_BACKEND)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _migration_dir() -> Path:
    return MIGRATIONS_ROOT / DATABASE_BACKEND


def run_migrations(conn: ConnectionAdapter) -> None:
    conn.execute(
        """
        create table if not exists schema_migrations (
            version text primary key,
            applied_at text not null
        )
        """
    )
    applied_rows = conn.execute("select version from schema_migrations order by version asc").fetchall()
    applied = {row["version"] for row in applied_rows}
    migration_dir = _migration_dir()
    if not migration_dir.exists():
        raise RuntimeError(f"Migration directory not found: {migration_dir}")

    for path in sorted(migration_dir.glob("*.sql")):
        version = path.stem
        if version in applied:
            continue
        conn.executescript(path.read_text(encoding="utf-8"))
        conn.execute(
            "insert into schema_migrations (version, applied_at) values (?, ?)",
            (version, iso_now()),
        )


def fetch_user_by_id(user_id: int) -> dict[str, Any] | None:
    with db() as conn:
        row = conn.execute("select * from users where id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


def _normalize_captured_data(value: Any) -> dict[str, Any]:
    if not value:
        return {}
    if isinstance(value, dict):
        return value
    if isinstance(value, (bytes, bytearray, memoryview)):
        value = bytes(value).decode("utf-8", errors="replace")
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except Exception:
            return {}
        if isinstance(parsed, dict):
            return parsed
        if isinstance(parsed, list):
            return {"items": parsed}
        return {"value": parsed}
    logger.debug("Unsupported captured_data type encountered: %s", type(value).__name__)
    return {}


def normalize_event(row: dict[str, Any]) -> dict[str, Any]:
    item = dict(row)
    item["captured_data"] = _normalize_captured_data(item.get("captured_data"))
    item["geo"] = item.get("geo") or "Global"
    return item


def frontend_event(row: dict[str, Any]) -> dict[str, Any]:
    item = normalize_event(row)
    tactic = item.get("mitre_tactic") or "Reconnaissance"
    deception_mode = str(item.get("policy_strategy") or "observe").replace("_", " ").upper()
    return {
        **item,
        "ts": item["created_at"],
        "timestamp": item["created_at"],
        "path": item.get("url_path") or item.get("cmd") or item.get("event_type"),
        "timestamp_utc": item["created_at"],
        "country": item.get("geo") or "Unknown",
        "geo_country": item.get("geo") or "Unknown",
        "behavior": item.get("policy_strategy") or "observe",
        "tactic": tactic,
        "decoy": item.get("url_path") or item.get("event_type"),
        "analysis": f"{item.get('mitre_tactic') or 'Reconnaissance'} activity mapped to {item.get('mitre_technique') or 'unknown technique'}.",
        "ai_intent": "Credential access" if item.get("severity") == "high" else "Reconnaissance",
        "deception_mode": deception_mode,
        "ai_explanation": f"Adaptive policy {item.get('policy_strategy') or 'observe'} applied to {item.get('event_type')}.",
        "ai_stage": item.get("mitre_tactic") or "Discovery",
        "confidence": int(float(item.get("score") or 0)),
        "risk_score": float(item.get("policy_risk_score") or item.get("score") or 0),
    }


def _in_clause(column: str, values: list[int]) -> tuple[str, tuple[Any, ...]]:
    if not values:
        return "1 = 0", ()
    placeholders = ", ".join("?" for _ in values)
    return f"{column} in ({placeholders})", tuple(values)


def build_summary(
    conn: ConnectionAdapter,
    *,
    site_ids: list[int] | None = None,
    blocked_user_id: int | None = None,
) -> dict[str, Any]:
    event_sql = "select * from events"
    event_params: tuple[Any, ...] = ()
    if site_ids is not None:
        clause, event_params = _in_clause("site_id", site_ids)
        event_sql += f" where {clause}"
    event_sql += " order by datetime(created_at) desc limit 200"
    rows = conn.execute(event_sql, event_params).fetchall()
    feed = [dict(row) for row in rows]
    total = len(feed)
    critical = sum(1 for row in feed if row["severity"] == "high")
    if blocked_user_id is None:
        blocked = conn.execute("select count(*) as count from blocked_ips").fetchone()["count"]
    else:
        blocked = conn.execute("select count(*) as count from blocked_ips where user_id = ?", (blocked_user_id,)).fetchone()["count"]
    trap_distribution: dict[str, int] = {}
    mitre_distribution: dict[str, int] = {}
    live_sessions = set()
    unique_ips = set()
    for row in feed:
        target = row["url_path"] or row["event_type"] or "unknown"
        trap_distribution[target] = trap_distribution.get(target, 0) + 1
        tactic = row["mitre_tactic"] or "Reconnaissance"
        mitre_distribution[tactic] = mitre_distribution.get(tactic, 0) + 1
        if row["session_id"]:
            live_sessions.add(row["session_id"])
        if row["ip"]:
            unique_ips.add(row["ip"])
    return {
        "summary": {
            "total": total,
            "critical": critical,
            "blocked": blocked,
            "live_sessions": len(live_sessions),
            "unique_ips": len(unique_ips),
        },
        "feed": feed,
        "trap_distribution": trap_distribution,
        "mitre_distribution": mitre_distribution,
    }


def seed_database() -> None:
    with db() as conn:
        run_migrations(conn)

        if conn.execute("select count(*) as count from users").fetchone()["count"] == 0:
            conn.execute(
                "insert into users (username, email, password_hash, role, created_at) values (?, ?, ?, ?, ?)",
                (BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_EMAIL, hash_password(BOOTSTRAP_ADMIN_PASSWORD), "admin", iso_now()),
            )

        if ENABLE_DEMO_SEED and conn.execute("select count(*) as count from events").fetchone()["count"] == 0:
            base = utc_now()
            sample_events = [
                ("sess-alpha", "http_probe", "high", 93, "185.220.101.4", "Germany", "/.env", "GET", None, "scanner", 88, "Credential Access", "T1552", "aggressive_containment", 91),
                ("sess-beta", "http_probe", "medium", 67, "45.83.64.21", "Netherlands", "/phpmyadmin/", "GET", None, "bot", 60, "Reconnaissance", "T1595", "progressive_disclosure", 64),
                ("sess-gamma", "shell_command", "high", 81, "103.27.34.2", "Singapore", None, None, "cat /etc/passwd", "interactive", 76, "Execution", "T1059", "credential_sinkhole", 83),
                ("sess-delta", "http_probe", "low", 28, "198.51.100.7", "United States", "/robots.txt", "GET", None, "crawler", 12, "Reconnaissance", "T1595", "observe", 24),
                ("sess-epsilon", "http_probe", "medium", 58, "203.0.113.42", "India", "/admin", "POST", None, "human", 49, "Initial Access", "T1078", "progressive_disclosure", 57),
            ]
            for index, event in enumerate(sample_events):
                conn.execute(
                    """
                    insert into events (
                        session_id, event_type, severity, score, ip, geo, url_path, http_method, cmd,
                        attacker_type, reputation, mitre_tactic, mitre_technique, policy_strategy,
                        policy_risk_score, captured_data, created_at
                    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (*event, json.dumps({"seed": True}), (base - timedelta(minutes=index * 9)).isoformat()),
                )

        if ENABLE_DEMO_SEED and conn.execute("select count(*) as count from leads").fetchone()["count"] == 0:
            now = iso_now()
            leads = [
                ("demo", "Arjun Rao", "arjun@startup.io", "StartupOps", "Website deception", "Need adaptive decoys for exposed admin surfaces.", "new", "", 5, 0),
                ("contact", "Maya Singh", "maya@secureco.com", "SecureCo", "SOC visibility", "Interested in telemetry integration and AI summaries.", "qualified", "admin", 0, 0),
            ]
            for lead in leads:
                conn.execute(
                    """
                    insert into leads (
                        request_type, name, email, organization, use_case, message, status, assigned_to,
                        spam_score, is_repeat, source_page, notification_channel_status, created_at, updated_at
                    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (*lead, "/demo" if lead[0] == "demo" else "/contact", json.dumps({"system": "sent"}), now, now),
                )
