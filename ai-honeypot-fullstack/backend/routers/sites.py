import re
import secrets
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from core.audit import record_operator_action
from core.database import db
from core.public_hosts import find_domain_conflict, is_valid_public_host, normalize_public_host
from core.security import hash_api_key
from core.time_utils import iso_now
from dependencies import current_user
from schemas import SiteRequest


router = APIRouter()


@router.get("/sites")
def list_sites(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            "select id, name, domain, created_at, updated_at from sites where user_id = ? order by id desc",
            (user["id"],),
        ).fetchall()
    return [dict(row) for row in rows]


@router.post("/sites")
def create_site(payload: SiteRequest, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    name = re.sub(r"\s+", " ", payload.name.strip())
    if len(name) < 3 or len(name) > 80:
        raise HTTPException(status_code=400, detail="Site name must be between 3 and 80 characters.")
    domain = normalize_public_host(payload.domain)
    if not is_valid_public_host(domain):
        raise HTTPException(status_code=400, detail="Enter a valid public hostname for this site.")
    api_key = f"hp_{secrets.token_hex(4)}_{secrets.token_hex(16)}"
    now = iso_now()
    with db() as conn:
        rows = conn.execute("select id, domain from sites order by id asc").fetchall()
        conflict = find_domain_conflict(rows, domain)
        if conflict is not None:
            existing_domain = normalize_public_host(conflict["domain"])
            raise HTTPException(
                status_code=409,
                detail=f"Domain scope '{domain}' overlaps with existing site '{existing_domain}'.",
            )
        cur = conn.execute(
            "insert into sites (user_id, name, domain, api_key, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
            (user["id"], name, domain, hash_api_key(api_key), now, now),
        )
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "operator"),
            action="site.create",
            summary=f"Created decoy site {name} ({domain})",
            severity="medium",
            target_type="site",
            target_id=cur.lastrowid,
            metadata={"name": name, "domain": domain},
        )
    return {"id": cur.lastrowid, "api_key": api_key}


@router.post("/sites/{site_id}/rotate-key")
def rotate_site_key(site_id: int, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    api_key = f"hp_{secrets.token_hex(4)}_{secrets.token_hex(16)}"
    with db() as conn:
        row = conn.execute("select id, name, domain from sites where id = ? and user_id = ?", (site_id, user["id"])).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Site not found.")
        conn.execute("update sites set api_key = ?, updated_at = ? where id = ?", (hash_api_key(api_key), iso_now(), site_id))
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "operator"),
            action="site.rotate_key",
            summary=f"Rotated API key for {row['name']} ({row['domain']})",
            severity="high",
            target_type="site",
            target_id=site_id,
            metadata={"name": row["name"], "domain": row["domain"]},
        )
    return {"api_key": api_key}
