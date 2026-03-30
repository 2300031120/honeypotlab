import secrets
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from core.database import db
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
    api_key = f"hp_{secrets.token_hex(4)}_{secrets.token_hex(16)}"
    now = iso_now()
    with db() as conn:
        cur = conn.execute(
            "insert into sites (user_id, name, domain, api_key, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
            (user["id"], payload.name.strip(), payload.domain.strip(), hash_api_key(api_key), now, now),
        )
    return {"id": cur.lastrowid, "api_key": api_key}


@router.post("/sites/{site_id}/rotate-key")
def rotate_site_key(site_id: int, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    api_key = f"hp_{secrets.token_hex(4)}_{secrets.token_hex(16)}"
    with db() as conn:
        row = conn.execute("select id from sites where id = ? and user_id = ?", (site_id, user["id"])).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Site not found.")
        conn.execute("update sites set api_key = ?, updated_at = ? where id = ?", (hash_api_key(api_key), iso_now(), site_id))
    return {"api_key": api_key}
