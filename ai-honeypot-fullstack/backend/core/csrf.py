import hmac
import secrets
import logging
from typing import Any

from core.config import SECRET_KEY
from core.time_utils import utc_now

logger = logging.getLogger(__name__)

# CSRF token expiration in seconds (24 hours)
CSRF_TOKEN_EXPIRATION = 86400


def generate_csrf_token(session_id: str) -> str:
    """Generate a CSRF token for a session"""
    timestamp = str(int(utc_now().timestamp()))
    message = f"{session_id}:{timestamp}"
    signature = hmac.new(
        SECRET_KEY.encode(),
        message.encode(),
        digestmod="sha256"
    ).hexdigest()
    token = f"{timestamp}:{signature}"
    return token


def validate_csrf_token(token: str, session_id: str) -> bool:
    """Validate a CSRF token"""
    try:
        parts = token.split(":")
        if len(parts) != 2:
            return False
        
        timestamp_str, signature = parts
        timestamp = int(timestamp_str)
        
        # Check token expiration
        current_time = int(utc_now().timestamp())
        if current_time - timestamp > CSRF_TOKEN_EXPIRATION:
            return False
        
        # Verify signature
        message = f"{session_id}:{timestamp_str}"
        expected_signature = hmac.new(
            SECRET_KEY.encode(),
            message.encode(),
            digestmod="sha256"
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)
    except (ValueError, AttributeError):
        return False


def get_csrf_token_from_request(request: Any) -> str | None:
    """Extract CSRF token from request headers or form data"""
    # Check header first
    token = request.headers.get("X-CSRF-Token")
    if token:
        return token
    
    # Check form data
    if hasattr(request, "form"):
        try:
            form_data = request.form()
            if "csrf_token" in form_data:
                return form_data["csrf_token"]
        except:
            pass
    
    # Check JSON body
    if hasattr(request, "json"):
        try:
            json_data = request.json()
            if isinstance(json_data, dict) and "csrf_token" in json_data:
                return json_data["csrf_token"]
        except:
            pass
    
    return None
