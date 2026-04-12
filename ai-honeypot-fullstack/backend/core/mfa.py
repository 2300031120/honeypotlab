import logging
import secrets
from typing import Any

try:
    import pyotp
    import qrcode
    from io import BytesIO
    import base64
    PYOTP_AVAILABLE = True
except ImportError:
    PYOTP_AVAILABLE = False

from core.database import db
from core.time_utils import iso_now

logger = logging.getLogger(__name__)

# MFA configuration
MFA_ISSUER = "CyberSentinel"
MFA_DIGITS = 6
MFA_INTERVAL = 30


def generate_mfa_secret() -> str:
    """Generate a new TOTP secret"""
    return secrets.token_hex(20)


def generate_totp_uri(secret: str, username: str) -> str:
    """Generate TOTP URI for QR code generation"""
    if not PYOTP_AVAILABLE:
        raise RuntimeError("pyotp library not installed. Install it with: pip install pyotp")
    
    totp = pyotp.TOTP(secret, digits=MFA_DIGITS, interval=MFA_INTERVAL, issuer=MFA_ISSUER)
    return totp.provisioning_uri(name=username, issuer_name=MFA_ISSUER)


def verify_totp(secret: str, code: str) -> bool:
    """Verify TOTP code"""
    if not PYOTP_AVAILABLE:
        raise RuntimeError("pyotp library not installed. Install it with: pip install pyotp")
    
    totp = pyotp.TOTP(secret, digits=MFA_DIGITS, interval=MFA_INTERVAL)
    return totp.verify(code, valid_window=1)  # Allow 1 step window for clock drift


def generate_qr_code(uri: str) -> str:
    """Generate QR code as base64 image"""
    if not PYOTP_AVAILABLE:
        raise RuntimeError("qrcode library not installed. Install it with: pip install qrcode")
    
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    
    img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{img_base64}"


def enable_mfa_for_user(user_id: int, secret: str) -> bool:
    """Enable MFA for a user"""
    try:
        now = iso_now()
        with db() as conn:
            # Check if MFA already enabled
            existing = conn.execute(
                "select id from user_mfa where user_id = ?",
                (user_id,)
            ).fetchone()
            
            if existing:
                # Update existing
                conn.execute(
                    "update user_mfa set secret = ?, enabled = true, updated_at = ? where user_id = ?",
                    (secret, now, user_id)
                )
            else:
                # Insert new
                conn.execute(
                    "insert into user_mfa (user_id, secret, enabled, created_at, updated_at) values (?, ?, true, ?, ?)",
                    (user_id, secret, now, now)
                )
        
        logger.info(f"MFA enabled for user {user_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to enable MFA for user {user_id}: {e}")
        return False


def disable_mfa_for_user(user_id: int) -> bool:
    """Disable MFA for a user"""
    try:
        now = iso_now()
        with db() as conn:
            conn.execute(
                "update user_mfa set enabled = false, updated_at = ? where user_id = ?",
                (now, user_id)
            )
        
        logger.info(f"MFA disabled for user {user_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to disable MFA for user {user_id}: {e}")
        return False


def get_user_mfa_status(user_id: int) -> dict[str, Any]:
    """Get MFA status for a user"""
    with db() as conn:
        row = conn.execute(
            "select enabled, created_at from user_mfa where user_id = ?",
            (user_id,)
        ).fetchone()
        
        if row:
            return {
                "enabled": bool(row["enabled"]),
                "enabled_at": row["created_at"]
            }
        else:
            return {
                "enabled": False,
                "enabled_at": None
            }


def verify_user_mfa(user_id: int, code: str) -> bool:
    """Verify MFA code for a user"""
    try:
        with db() as conn:
            row = conn.execute(
                "select secret, enabled from user_mfa where user_id = ?",
                (user_id,)
            ).fetchone()
            
            if not row or not row["enabled"]:
                return False
            
            secret = row["secret"]
            return verify_totp(secret, code)
    except Exception as e:
        logger.error(f"Failed to verify MFA for user {user_id}: {e}")
        return False


def get_user_mfa_secret(user_id: int) -> str | None:
    """Get MFA secret for a user (for setup)"""
    with db() as conn:
        row = conn.execute(
            "select secret from user_mfa where user_id = ?",
            (user_id,)
        ).fetchone()
        
        if row:
            return row["secret"]
        return None


def is_mfa_required(user_id: int) -> bool:
    """Check if MFA is required for a user"""
    status = get_user_mfa_status(user_id)
    return status["enabled"]


def setup_mfa_for_user(user_id: int, username: str) -> dict[str, Any]:
    """Setup MFA for a user - returns secret and QR code"""
    try:
        # Generate new secret
        secret = generate_mfa_secret()
        
        # Enable MFA in database
        if not enable_mfa_for_user(user_id, secret):
            raise RuntimeError("Failed to enable MFA in database")
        
        # Generate TOTP URI
        uri = generate_totp_uri(secret, username)
        
        # Generate QR code
        qr_code = generate_qr_code(uri)
        
        return {
            "secret": secret,
            "qr_code": qr_code,
            "uri": uri,
            "digits": MFA_DIGITS,
            "interval": MFA_INTERVAL
        }
    except Exception as e:
        logger.error(f"Failed to setup MFA for user {user_id}: {e}")
        raise
