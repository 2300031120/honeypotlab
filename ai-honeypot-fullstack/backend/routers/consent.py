from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from core.audit import record_operator_action
from core.config import CONSENT_RATE_LIMIT_MAX_ATTEMPTS, CONSENT_RATE_LIMIT_WINDOW_SECONDS
from core.consent import (
    check_consent_for_purpose,
    get_user_consent,
    process_data_deletion,
    request_data_deletion,
    revoke_user_consent,
    update_user_consent,
)
from core.database import db
from core.request_security import build_rate_limit_dependency
from core.time_utils import iso_now
from dependencies import current_admin_user, current_user
from schemas import ConsentUpdateRequest

router = APIRouter()
consent_rate_limit = build_rate_limit_dependency("consent-update", CONSENT_RATE_LIMIT_MAX_ATTEMPTS, CONSENT_RATE_LIMIT_WINDOW_SECONDS)
deletion_rate_limit = build_rate_limit_dependency("data-deletion", 3, 3600)


@router.get("/consent")
def get_consent(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    """Get current user's consent preferences"""
    return get_user_consent(int(user["id"]))


@router.post("/consent")
def update_consent(payload: ConsentUpdateRequest, user: dict[str, Any] = Depends(current_user), _: None = Depends(consent_rate_limit)) -> dict[str, Any]:
    """Update user's consent preferences"""
    result = update_user_consent(
        user_id=int(user["id"]),
        consent_given=payload.consent_given,
        preferences=payload.preferences,
    )
    
    with db() as conn:
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "operator"),
            action="consent.update",
            summary=f"Updated consent preferences: consent_given={payload.consent_given}",
            severity="low",
            target_type="consent",
            metadata={"preferences": payload.preferences},
        )
    
    return result


@router.post("/consent/revoke")
def revoke_consent(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    """Revoke all user consent (GDPR right to withdraw consent)"""
    result = revoke_user_consent(int(user["id"]))
    
    with db() as conn:
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "operator"),
            action="consent.revoke",
            summary="Revoked all consent preferences",
            severity="medium",
            target_type="consent",
            metadata={},
        )
    
    return result


@router.get("/consent/check/{purpose}")
def check_consent(purpose: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    """Check if user has consented to a specific purpose"""
    has_consent = check_consent_for_purpose(int(user["id"]), purpose)
    return {"purpose": purpose, "has_consent": has_consent}


@router.post("/data-deletion/request")
def request_deletion(user: dict[str, Any] = Depends(current_user), _: None = Depends(deletion_rate_limit)) -> dict[str, Any]:
    """Request deletion of personal data (GDPR right to be forgotten)"""
    result = request_data_deletion(int(user["id"]))
    
    with db() as conn:
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "operator"),
            action="data_deletion.request",
            summary=f"Requested data deletion: {result['message']}",
            severity="high",
            target_type="user",
            target_id=int(user["id"]),
            metadata=result,
        )
    
    return result


@router.get("/admin/data-deletion/requests")
def list_deletion_requests(admin: dict[str, Any] = Depends(current_admin_user)) -> dict[str, Any]:
    """List all data deletion requests (admin only)"""
    with db() as conn:
        rows = conn.execute(
            "select * from data_deletion_requests order by requested_at desc",
        ).fetchone()
    
    return {"requests": [dict(row) for row in rows]}


@router.post("/admin/data-deletion/{request_id}/process")
def process_deletion(
    request_id: int,
    approved: bool,
    admin: dict[str, Any] = Depends(current_admin_user),
) -> dict[str, Any]:
    """Process a data deletion request (admin only)"""
    result = process_data_deletion(request_id, approved, int(admin["id"]))
    
    with db() as conn:
        record_operator_action(
            conn,
            user_id=int(admin["id"]),
            actor_username=str(admin.get("username") or "admin"),
            action="data_deletion.process",
            summary=f"Processed deletion request {request_id}: {result['status']}",
            severity="critical",
            target_type="data_deletion_request",
            target_id=request_id,
            metadata=result,
        )
    
    return result
