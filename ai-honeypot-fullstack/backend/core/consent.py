import json
import logging
from typing import Any

from core.database import db
from core.time_utils import iso_now, utc_now

logger = logging.getLogger(__name__)


def get_user_consent(user_id: int) -> dict[str, Any]:
    """Get user consent preferences"""
    with db() as conn:
        row = conn.execute(
            "select * from user_consent where user_id = ?",
            (user_id,),
        ).fetchone()
    
    if not row:
        return {
            "user_id": user_id,
            "consent_given": False,
            "preferences": {
                "analytics": False,
                "marketing": False,
                "data_retention": False,
            },
            "updated_at": None,
        }
    
    return {
        "user_id": row["user_id"],
        "consent_given": bool(row["consent_given"]),
        "preferences": json.loads(row["preferences"] or "{}"),
        "updated_at": row["updated_at"],
    }


def update_user_consent(
    user_id: int,
    consent_given: bool,
    preferences: dict[str, bool],
) -> dict[str, Any]:
    """Update user consent preferences"""
    now = iso_now()
    preferences_json = json.dumps(preferences)
    
    with db() as conn:
        # Check if consent record exists
        existing = conn.execute(
            "select id from user_consent where user_id = ?",
            (user_id,),
        ).fetchone()
        
        if existing:
            conn.execute(
                """
                update user_consent
                set consent_given = ?, preferences = ?, updated_at = ?
                where user_id = ?
                """,
                (consent_given, preferences_json, now, user_id),
            )
        else:
            conn.execute(
                """
                insert into user_consent (user_id, consent_given, preferences, created_at, updated_at)
                values (?, ?, ?, ?, ?)
                """,
                (user_id, consent_given, preferences_json, now, now),
            )
    
    return get_user_consent(user_id)


def revoke_user_consent(user_id: int) -> dict[str, Any]:
    """Revoke all user consent (GDPR right to withdraw consent)"""
    return update_user_consent(
        user_id=user_id,
        consent_given=False,
        preferences={
            "analytics": False,
            "marketing": False,
            "data_retention": False,
        },
    )


def check_consent_for_purpose(user_id: int, purpose: str) -> bool:
    """Check if user has consented to a specific purpose"""
    consent = get_user_consent(user_id)
    if not consent["consent_given"]:
        return False
    return consent["preferences"].get(purpose, False)


def request_data_deletion(user_id: int) -> dict[str, Any]:
    """
    Request deletion of user data (GDPR right to be forgotten)
    This creates a deletion request but doesn't immediately delete data.
    Admin must approve the deletion request.
    """
    now = iso_now()
    
    with db() as conn:
        # Check if deletion request already exists
        existing = conn.execute(
            "select id from data_deletion_requests where user_id = ? and status = 'pending'",
            (user_id,),
        ).fetchone()
        
        if existing:
            return {
                "status": "exists",
                "message": "Deletion request already pending",
            }
        
        # Create deletion request
        conn.execute(
            """
            insert into data_deletion_requests (user_id, status, requested_at, processed_at)
            values (?, 'pending', ?, NULL)
            """,
            (user_id, now),
        )
    
    return {
        "status": "created",
        "message": "Data deletion request submitted. Admin approval required.",
    }


def process_data_deletion(request_id: int, approved: bool, admin_user_id: int) -> dict[str, Any]:
    """
    Process a data deletion request (admin only)
    If approved, deletes all user data except for audit records
    """
    with db() as conn:
        # Get the deletion request
        request = conn.execute(
            "select * from data_deletion_requests where id = ?",
            (request_id,),
        ).fetchone()
        
        if not request:
            raise ValueError("Deletion request not found")
        
        if request["status"] != "pending":
            raise ValueError(f"Deletion request already {request['status']}")
        
        user_id = request["user_id"]
        now = iso_now()
        
        if approved:
            # Delete user data (cascade will handle related records)
            # Note: We keep operator_actions for audit trail
            conn.execute("delete from leads where user_id = ?", (user_id,))
            conn.execute("delete from sites where user_id = ?", (user_id,))
            conn.execute("delete from user_consent where user_id = ?", (user_id,))
            conn.execute("delete from users where id = ?", (user_id,))
            
            # Update request status
            conn.execute(
                "update data_deletion_requests set status = 'completed', processed_at = ? where id = ?",
                (now, request_id),
            )
            
            return {
                "status": "completed",
                "message": "User data deleted successfully",
                "user_id": user_id,
            }
        else:
            # Reject the deletion request
            conn.execute(
                "update data_deletion_requests set status = 'rejected', processed_at = ? where id = ?",
                (now, request_id),
            )
            
            return {
                "status": "rejected",
                "message": "Data deletion request rejected",
                "user_id": user_id,
            }
