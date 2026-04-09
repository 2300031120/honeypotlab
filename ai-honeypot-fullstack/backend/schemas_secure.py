"""
SECURED SCHEMAS - Enhanced validation to prevent injection attacks
"""

import re
from typing import Any
from pydantic import BaseModel, Field, field_validator, model_validator


def validate_no_html(value: str) -> str:
    """Validate string doesn't contain HTML/script tags"""
    if '<script' in value.lower() or '<iframe' in value.lower():
        raise ValueError('HTML tags not allowed')
    return value


def validate_no_sql(value: str) -> str:
    """Validate string doesn't contain SQL injection patterns"""
    dangerous = [';', '--', '/*', '*/', 'drop ', 'delete ', 'insert ', 'update ']
    value_lower = value.lower()
    for pattern in dangerous:
        if pattern in value_lower:
            raise ValueError(f'Invalid characters in input')
    return value


class SecureSignupRequest(BaseModel):
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        pattern=r'^[a-zA-Z0-9_@.-]+$',
        description="Username must be alphanumeric with _@.- only"
    )
    email: str = Field(
        ...,
        min_length=5,
        max_length=254,
        pattern=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    )
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Password must be 8-128 characters"
    )
    plan: str | None = Field(None, max_length=50)
    tenant_name: str | None = Field(None, max_length=100)
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        # Check for XSS patterns
        if re.search(r'<script|javascript:|on\w+=', v, re.IGNORECASE):
            raise ValueError('Username contains invalid characters')
        return v.strip()
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        if len(v) > 254:
            raise ValueError('Email too long')
        return v.lower().strip()
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain number')
        return v


class SecureLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=128)
    
    @field_validator('username', 'password')
    @classmethod
    def validate_no_injection(cls, v: str) -> str:
        # Prevent null bytes and control characters
        if '\x00' in v or '\x01' in v:
            raise ValueError('Invalid characters')
        return v


class SecureLeadSubmission(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., max_length=254)
    organization: str = Field(..., max_length=200)
    use_case: str = Field(..., max_length=1000)
    message: str = Field(..., max_length=2000)
    referral_code: str = Field(default="", max_length=50)
    website: str = Field(default="", max_length=500)
    
    @field_validator('name', 'organization', 'use_case', 'message')
    @classmethod
    def sanitize_input(cls, v: str) -> str:
        # Remove HTML tags
        v = re.sub(r'<[^>]+>', '', v)
        # Remove script patterns
        v = re.sub(r'javascript:|on\w+\s*=', '', v, flags=re.IGNORECASE)
        return v.strip()
    
    @field_validator('email')
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, v):
            raise ValueError('Invalid email format')
        return v.lower().strip()
    
    @field_validator('website')
    @classmethod
    def validate_website(cls, v: str) -> str:
        if v:
            # Must be http:// or https://
            if not re.match(r'^https?://', v.lower()):
                raise ValueError('Website must start with http:// or https://')
            # Block javascript: protocol
            if 'javascript:' in v.lower():
                raise ValueError('Invalid website URL')
        return v


class SecureTerminalCommand(BaseModel):
    cmd: str = Field(..., max_length=1000)
    session_id: str | None = Field(None, max_length=100)
    
    @field_validator('cmd')
    @classmethod
    def validate_command(cls, v: str) -> str:
        # Limit command length
        if len(v) > 1000:
            raise ValueError('Command too long')
        # Check for dangerous patterns
        dangerous = [';', '&&', '||', '`', '$(']
        for pattern in dangerous:
            if pattern in v:
                raise ValueError('Invalid command characters')
        return v
    
    @field_validator('session_id')
    @classmethod
    def validate_session_id(cls, v: str | None) -> str | None:
        if v:
            # Only allow alphanumeric and dashes
            if not re.match(r'^[a-zA-Z0-9-]+$', v):
                raise ValueError('Invalid session ID')
        return v


class SecureUrlScan(BaseModel):
    url: str = Field(..., max_length=2000)
    
    @field_validator('url')
    @classmethod
    def validate_url(cls, v: str) -> str:
        # Must be http:// or https://
        if not re.match(r'^https?://', v.lower()):
            raise ValueError('URL must start with http:// or https://')
        # Block dangerous protocols
        if re.match(r'^(javascript:|data:|vbscript:|file:)', v.lower()):
            raise ValueError('Invalid URL protocol')
        return v


class SecureBlockIp(BaseModel):
    ip: str = Field(..., max_length=45)  # IPv6 max length
    reason: str | None = Field(None, max_length=500)
    
    @field_validator('ip')
    @classmethod
    def validate_ip(cls, v: str) -> str:
        # IPv4 validation
        ipv4_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
        if re.match(ipv4_pattern, v):
            parts = v.split('.')
            if all(0 <= int(p) <= 255 for p in parts):
                return v
        
        # IPv6 validation (simplified)
        ipv6_pattern = r'^([0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}$'
        if re.match(ipv6_pattern, v):
            return v
        
        raise ValueError('Invalid IP address format')
    
    @field_validator('reason')
    @classmethod
    def sanitize_reason(cls, v: str | None) -> str | None:
        if v:
            # Remove HTML
            v = re.sub(r'<[^>]+>', '', v)
            if len(v) > 500:
                v = v[:500]
        return v
