"""
WEB SECURITY MODULE - XSS, CSRF, and Input Validation Protection
"""

import html
import re
from typing import Any


def sanitize_html_input(value: str, max_length: int = 1000) -> str:
    """Sanitize user input to prevent XSS attacks"""
    if not value:
        return ""
    
    # Truncate to max length
    value = value[:max_length]
    
    # Escape HTML entities
    value = html.escape(value)
    
    # Additional XSS pattern removal
    dangerous_patterns = [
        r'<script[^>]*>.*?</script>',
        r'javascript:',
        r'on\w+\s*=',
        r'<iframe',
        r'<object',
        r'<embed',
        r'data:text/html',
    ]
    
    for pattern in dangerous_patterns:
        value = re.sub(pattern, '', value, flags=re.IGNORECASE | re.DOTALL)
    
    return value


def sanitize_sql_input(value: str) -> str:
    """Sanitize input to prevent SQL injection"""
    if not value:
        return ""
    
    # Remove SQL comment patterns
    value = re.sub(r'--.*$', '', value, flags=re.MULTILINE)
    value = re.sub(r'/\*.*?\*/', '', value, flags=re.DOTALL)
    
    # Remove dangerous SQL keywords (for non-parameterized queries)
    dangerous = [';', '/*', '*/', 'xp_', 'sp_', 'sysobjects', 'syscolumns']
    for d in dangerous:
        value = value.replace(d, '')
    
    return value.strip()


def validate_email(email: str) -> bool:
    """Validate email format strictly"""
    if not email or len(email) > 254:
        return False
    
    # Strict email regex
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_username(username: str) -> bool:
    """Validate username format and prevent injection"""
    if not username or len(username) < 3 or len(username) > 100:
        return False
    
    # Only allow alphanumeric and basic special chars
    pattern = r'^[a-zA-Z0-9_@.-]+$'
    if not re.match(pattern, username):
        return False
    
    # Check for dangerous patterns
    dangerous = ['<script', 'javascript:', 'onload=', 'onerror=']
    username_lower = username.lower()
    for d in dangerous:
        if d in username_lower:
            return False
    
    return True


def validate_password_strength(password: str) -> tuple[bool, list[str]]:
    """Validate password strength requirements"""
    errors = []
    
    if len(password) < 8:
        errors.append("Password must be at least 8 characters")
    
    if len(password) > 128:
        errors.append("Password must be less than 128 characters")
    
    if not re.search(r'[A-Z]', password):
        errors.append("Password must contain uppercase letter")
    
    if not re.search(r'[a-z]', password):
        errors.append("Password must contain lowercase letter")
    
    if not re.search(r'\d', password):
        errors.append("Password must contain number")
    
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        errors.append("Password must contain special character")
    
    # Check for common passwords
    common_passwords = ['password', '123456', 'qwerty', 'admin', 'letmein', 'welcome']
    if password.lower() in common_passwords:
        errors.append("Password is too common")
    
    return len(errors) == 0, errors


def validate_ip_address(ip: str) -> bool:
    """Validate IP address format"""
    if not ip:
        return False
    
    # IPv4 pattern
    ipv4_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
    if re.match(ipv4_pattern, ip):
        parts = ip.split('.')
        return all(0 <= int(p) <= 255 for p in parts)
    
    # IPv6 pattern (simplified)
    ipv6_pattern = r'^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$'
    if re.match(ipv6_pattern, ip):
        return True
    
    return False


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal"""
    if not filename:
        return ""
    
    # Remove path components
    filename = filename.replace('..', '')
    filename = filename.replace('/', '')
    filename = filename.replace('\\', '')
    
    # Remove null bytes
    filename = filename.replace('\x00', '')
    
    # Only allow safe characters
    filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    
    return filename[:255]


def validate_url(url: str) -> bool:
    """Validate URL format and prevent javascript: protocol"""
    if not url or len(url) > 2000:
        return False
    
    # Block javascript: and data: protocols
    dangerous_protocols = ['javascript:', 'data:', 'vbscript:', 'file:']
    url_lower = url.lower()
    for protocol in dangerous_protocols:
        if url_lower.startswith(protocol):
            return False
    
    # Must start with http:// or https://
    if not re.match(r'^https?://', url_lower):
        return False
    
    return True


def escape_json_value(value: Any) -> Any:
    """Escape values for safe JSON output"""
    if isinstance(value, str):
        # Remove control characters
        value = re.sub(r'[\x00-\x1F\x7F-\x9F]', '', value)
        return value
    elif isinstance(value, dict):
        return {k: escape_json_value(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [escape_json_value(v) for v in value]
    return value


# Security headers configuration
SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
}


def get_csp_header() -> str:
    """Get Content Security Policy header value"""
    return (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://accounts.google.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' https://accounts.google.com; "
        "frame-ancestors 'none'; "
        "form-action 'self';"
    )
