"""
Response Obfuscation Middleware
Obfuscates API responses to hide internal structure and make manual inspection harder
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import json
import random
import string
from typing import Any, Dict
import logging

logger = logging.getLogger(__name__)


# Field name mapping for obfuscation
FIELD_MAPPING = {
    "id": "uid",
    "name": "nm",
    "email": "eml",
    "user": "usr",
    "password": "pwd",
    "token": "tkn",
    "session": "ses",
    "created_at": "ct",
    "updated_at": "ut",
    "status": "st",
    "type": "tp",
    "data": "dt",
    "message": "msg",
    "error": "err",
    "success": "ok",
    "count": "cnt",
    "total": "ttl",
    "page": "pg",
    "limit": "lmt",
    "offset": "off",
}


class ResponseObfuscationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to obfuscate API responses by renaming fields and adding dummy data
    """
    
    def __init__(self, app, enable_obfuscation: bool = True):
        super().__init__(app)
        self.enable_obfuscation = enable_obfuscation
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Skip if obfuscation not enabled
        if not self.enable_obfuscation:
            return response
        
        # Skip StreamingResponse (can't obfuscate streaming responses)
        if hasattr(response, 'body_iterator') or not hasattr(response, 'body'):
            return response
        
        # Skip non-JSON responses
        content_type = response.headers.get("content-type", "")
        if "application/json" not in content_type:
            return response
        
        # Skip health check and other internal endpoints
        if request.url.path in ["/health", "/healthz"]:
            return response
        
        # Get response body
        body = response.body
        if not body:
            return response
        
        try:
            # Parse JSON
            data = json.loads(body.decode())
            
            # Obfuscate the data
            obfuscated = self._obfuscate_data(data)
            
            # Create new response with obfuscated data
            new_body = json.dumps(obfuscated)
            response.body = new_body.encode()
            response.headers["Content-Length"] = str(len(response.body))
            
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            # If JSON parsing fails, return original response
            logger.warning(f"Failed to obfuscate response: {e}")
        
        return response
    
    def _obfuscate_data(self, data: Any) -> Any:
        """Recursively obfuscate data structure"""
        if isinstance(data, dict):
            obfuscated = {}
            for key, value in data.items():
                # Map field name
                new_key = FIELD_MAPPING.get(key, key)
                
                # Recursively obfuscate value
                obfuscated[new_key] = self._obfuscate_data(value)
            
            # Add dummy fields to confuse analysis
            if len(obfuscated) > 0 and random.random() < 0.3:  # 30% chance
                obfuscated["_dummy"] = self._generate_dummy_data()
            
            return obfuscated
        
        elif isinstance(data, list):
            return [self._obfuscate_data(item) for item in data]
        
        elif isinstance(data, str):
            # Obfuscate sensitive strings (emails, tokens)
            if "@" in data and "." in data:  # Likely email
                parts = data.split("@")
                if len(parts) == 2:
                    username = parts[0]
                    domain = parts[1]
                    # Partially obfuscate email
                    if len(username) > 2:
                        username = username[0] + "*" * (len(username) - 2) + username[-1]
                    return f"{username}@{domain}"
            # Obfuscate tokens
            if len(data) > 20 and all(c in string.hexdigits for c in data):
                return data[:8] + "*" * (len(data) - 16) + data[-8:]
            
            return data
        
        else:
            return data
    
    def _generate_dummy_data(self) -> str:
        """Generate random dummy data to confuse analysis"""
        dummy_types = [
            lambda: "".join(random.choices(string.ascii_letters + string.digits, k=16)),
            lambda: "".join(random.choices(string.ascii_lowercase, k=12)),
            lambda: str(random.randint(100000, 999999)),
            lambda: f"dummy_{random.randint(1, 1000)}",
        ]
        return random.choice(dummy_types)()
