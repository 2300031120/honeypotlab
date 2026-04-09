"""
Enhanced Error Handling Module for AI Honeypot System
Provides centralized, structured error handling with proper logging and monitoring
"""

import asyncio
import logging
import traceback
from datetime import datetime
from enum import Enum
from typing import Dict, Any, Optional, Union, Callable
from functools import wraps
import json

from fastapi import HTTPException, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class ErrorSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ErrorCategory(Enum):
    VALIDATION = "validation"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    DATABASE = "database"
    NETWORK = "network"
    SECURITY = "security"
    BUSINESS_LOGIC = "business_logic"
    EXTERNAL_SERVICE = "external_service"
    SYSTEM = "system"


class HoneypotError(Exception):
    """Custom exception class for honeypot-specific errors"""
    
    def __init__(
        self,
        message: str,
        error_code: str,
        category: ErrorCategory = ErrorCategory.SYSTEM,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        http_status: int = 500,
        details: Optional[Dict[str, Any]] = None,
        user_friendly_message: Optional[str] = None
    ):
        self.message = message
        self.error_code = error_code
        self.category = category
        self.severity = severity
        self.http_status = http_status
        self.details = details or {}
        self.user_friendly_message = user_friendly_message or message
        super().__init__(message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary format for API responses"""
        return {
            "error": True,
            "error_code": self.error_code,
            "message": self.user_friendly_message,
            "category": self.category.value,
            "severity": self.severity.value,
            "timestamp": datetime.utcnow().isoformat(),
            "details": self.details
        }


class ErrorHandler:
    """Centralized error handling and logging"""
    
    def __init__(self):
        self.error_callbacks: Dict[str, Callable] = {}
        self.error_metrics: Dict[str, int] = {}
    
    def register_callback(self, error_code: str, callback: Callable):
        """Register a callback for specific error codes"""
        self.error_callbacks[error_code] = callback
    
    def handle_error(
        self, 
        error: Exception, 
        request: Optional[Request] = None,
        additional_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Handle any exception and return standardized response"""
        
        # Convert to HoneypotError if needed
        if not isinstance(error, HoneypotError):
            honeypot_error = self._convert_to_honeypot_error(error)
        else:
            honeypot_error = error
        
        # Log the error
        self._log_error(honeypot_error, request, additional_context)
        
        # Update metrics
        self._update_metrics(honeypot_error.error_code)
        
        # Execute callback if registered
        if honeypot_error.error_code in self.error_callbacks:
            try:
                self.error_callbacks[honeypot_error.error_code](honeypot_error, request)
            except Exception as callback_error:
                logger.error(f"Error in callback for {honeypot_error.error_code}: {callback_error}")
        
        return honeypot_error.to_dict()
    
    def _convert_to_honeypot_error(self, error: Exception) -> HoneypotError:
        """Convert standard exceptions to HoneypotError"""
        
        if isinstance(error, HTTPException):
            return HoneypotError(
                message=error.detail,
                error_code="HTTP_ERROR",
                category=ErrorCategory.VALIDATION,
                severity=ErrorSeverity.MEDIUM,
                http_status=error.status_code,
                details={"status_code": error.status_code}
            )
        
        elif isinstance(error, ValueError):
            return HoneypotError(
                message=str(error),
                error_code="VALIDATION_ERROR",
                category=ErrorCategory.VALIDATION,
                severity=ErrorSeverity.MEDIUM,
                http_status=400
            )
        
        elif isinstance(error, PermissionError):
            return HoneypotError(
                message="Permission denied",
                error_code="PERMISSION_DENIED",
                category=ErrorCategory.AUTHORIZATION,
                severity=ErrorSeverity.HIGH,
                http_status=403
            )
        
        elif "database" in str(error).lower() or "connection" in str(error).lower():
            return HoneypotError(
                message="Database operation failed",
                error_code="DATABASE_ERROR",
                category=ErrorCategory.DATABASE,
                severity=ErrorSeverity.HIGH,
                http_status=503,
                user_friendly_message="Service temporarily unavailable"
            )
        
        else:
            # Unknown error - log full traceback
            return HoneypotError(
                message="An unexpected error occurred",
                error_code="INTERNAL_ERROR",
                category=ErrorCategory.SYSTEM,
                severity=ErrorSeverity.CRITICAL,
                http_status=500,
                details={
                    "original_error": str(error),
                    "traceback": traceback.format_exc()
                },
                user_friendly_message="Service temporarily unavailable"
            )
    
    def _log_error(
        self, 
        error: HoneypotError, 
        request: Optional[Request] = None,
        additional_context: Optional[Dict[str, Any]] = None
    ):
        """Log error with structured information"""
        
        log_data = {
            "error_code": error.error_code,
            "category": error.category.value,
            "severity": error.severity.value,
            "message": error.message,
            "http_status": error.http_status,
            "details": error.details,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Add request context if available
        if request:
            log_data.update({
                "request_method": request.method,
                "request_url": str(request.url),
                "client_ip": getattr(request.client, 'host', 'unknown') if request.client else 'unknown',
                "user_agent": request.headers.get("user-agent", "unknown"),
                "request_id": getattr(request.state, 'request_id', 'unknown')
            })
        
        # Add additional context
        if additional_context:
            log_data["context"] = additional_context
        
        # Choose log level based on severity
        if error.severity == ErrorSeverity.CRITICAL:
            logger.critical(f"Critical error: {error.error_code}", extra=log_data)
        elif error.severity == ErrorSeverity.HIGH:
            logger.error(f"High severity error: {error.error_code}", extra=log_data)
        elif error.severity == ErrorSeverity.MEDIUM:
            logger.warning(f"Medium severity error: {error.error_code}", extra=log_data)
        else:
            logger.info(f"Low severity error: {error.error_code}", extra=log_data)
    
    def _update_metrics(self, error_code: str):
        """Update error metrics"""
        self.error_metrics[error_code] = self.error_metrics.get(error_code, 0) + 1
    
    def get_metrics(self) -> Dict[str, int]:
        """Get current error metrics"""
        return self.error_metrics.copy()


# Global error handler instance
error_handler = ErrorHandler()


def handle_exceptions(
    error_code: str = "UNKNOWN_ERROR",
    category: ErrorCategory = ErrorCategory.SYSTEM,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    http_status: int = 500,
    user_friendly_message: Optional[str] = None,
    reraise: bool = False
):
    """Decorator for handling exceptions in functions"""
    
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                if isinstance(e, HoneypotError):
                    error = e
                else:
                    error = HoneypotError(
                        message=str(e),
                        error_code=error_code,
                        category=category,
                        severity=severity,
                        http_status=http_status,
                        user_friendly_message=user_friendly_message
                    )
                
                if reraise:
                    raise error
                
                # For async functions, we need to handle the error differently
                # This will be caught by the middleware
                raise error
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if isinstance(e, HoneypotError):
                    error = e
                else:
                    error = HoneypotError(
                        message=str(e),
                        error_code=error_code,
                        category=category,
                        severity=severity,
                        http_status=http_status,
                        user_friendly_message=user_friendly_message
                    )
                
                if reraise:
                    raise error
                
                # For sync functions, return error response
                return error.to_dict()
        
        # Return appropriate wrapper based on function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware for handling all HTTP errors consistently"""
    
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except HoneypotError as e:
            error_response = error_handler.handle_error(e, request)
            return JSONResponse(
                status_code=e.http_status,
                content=error_response
            )
        except Exception as e:
            error_response = error_handler.handle_error(e, request)
            return JSONResponse(
                status_code=500,
                content=error_response
            )


# Common error definitions
class CommonErrors:
    """Predefined common errors"""
    
    INVALID_CREDENTIALS = HoneypotError(
        message="Invalid credentials provided",
        error_code="INVALID_CREDENTIALS",
        category=ErrorCategory.AUTHENTICATION,
        severity=ErrorSeverity.MEDIUM,
        http_status=401,
        user_friendly_message="Invalid username or password"
    )
    
    TOKEN_EXPIRED = HoneypotError(
        message="Authentication token has expired",
        error_code="TOKEN_EXPIRED",
        category=ErrorCategory.AUTHENTICATION,
        severity=ErrorSeverity.MEDIUM,
        http_status=401,
        user_friendly_message="Please log in again"
    )
    
    INSUFFICIENT_PERMISSIONS = HoneypotError(
        message="Insufficient permissions for this operation",
        error_code="INSUFFICIENT_PERMISSIONS",
        category=ErrorCategory.AUTHORIZATION,
        severity=ErrorSeverity.HIGH,
        http_status=403,
        user_friendly_message="You don't have permission to perform this action"
    )
    
    RESOURCE_NOT_FOUND = HoneypotError(
        message="Requested resource not found",
        error_code="RESOURCE_NOT_FOUND",
        category=ErrorCategory.BUSINESS_LOGIC,
        severity=ErrorSeverity.LOW,
        http_status=404,
        user_friendly_message="The requested resource was not found"
    )
    
    RATE_LIMIT_EXCEEDED = HoneypotError(
        message="Rate limit exceeded",
        error_code="RATE_LIMIT_EXCEEDED",
        category=ErrorCategory.SECURITY,
        severity=ErrorSeverity.MEDIUM,
        http_status=429,
        user_friendly_message="Too many requests. Please try again later."
    )
    
    DATABASE_CONNECTION_FAILED = HoneypotError(
        message="Database connection failed",
        error_code="DATABASE_CONNECTION_FAILED",
        category=ErrorCategory.DATABASE,
        severity=ErrorSeverity.HIGH,
        http_status=503,
        user_friendly_message="Service temporarily unavailable"
    )
    
    VALIDATION_ERROR = HoneypotError(
        message="Input validation failed",
        error_code="VALIDATION_ERROR",
        category=ErrorCategory.VALIDATION,
        severity=ErrorSeverity.MEDIUM,
        http_status=400,
        user_friendly_message="Invalid input provided"
    )
    
    SQL_INJECTION_ATTEMPT = HoneypotError(
        message="Potential SQL injection detected",
        error_code="SQL_INJECTION_ATTEMPT",
        category=ErrorCategory.SECURITY,
        severity=ErrorSeverity.HIGH,
        http_status=400,
        user_friendly_message="Invalid query syntax"
    )
    
    SESSION_EXPIRED = HoneypotError(
        message="Session has expired",
        error_code="SESSION_EXPIRED",
        category=ErrorCategory.AUTHENTICATION,
        severity=ErrorSeverity.MEDIUM,
        http_status=401,
        user_friendly_message="Your session has expired. Please log in again."
    )


# Error recovery utilities
class ErrorRecovery:
    """Utilities for error recovery and circuit breaking"""
    
    def __init__(self):
        self.circuit_breakers: Dict[str, Dict[str, Any]] = {}
    
    def is_circuit_open(self, service_name: str) -> bool:
        """Check if circuit breaker is open for a service"""
        breaker = self.circuit_breakers.get(service_name, {})
        if not breaker:
            return False
        
        if breaker.get("state") == "open":
            # Check if timeout has passed
            if datetime.utcnow().timestamp() > breaker.get("timeout", 0):
                # Move to half-open state
                breaker["state"] = "half_open"
                breaker["failure_count"] = 0
                return False
            return True
        
        return False
    
    def record_failure(self, service_name: str):
        """Record a failure for circuit breaker"""
        if service_name not in self.circuit_breakers:
            self.circuit_breakers[service_name] = {
                "failure_count": 0,
                "state": "closed",
                "timeout": 0,
                "failure_threshold": 5,
                "recovery_timeout": 60
            }
        
        breaker = self.circuit_breakers[service_name]
        breaker["failure_count"] += 1
        
        if breaker["failure_count"] >= breaker["failure_threshold"]:
            breaker["state"] = "open"
            breaker["timeout"] = datetime.utcnow().timestamp() + breaker["recovery_timeout"]
    
    def record_success(self, service_name: str):
        """Record a success for circuit breaker"""
        if service_name in self.circuit_breakers:
            breaker = self.circuit_breakers[service_name]
            breaker["failure_count"] = 0
            breaker["state"] = "closed"


# Global error recovery instance
error_recovery = ErrorRecovery()


def with_circuit_breaker(
    service_name: str,
    failure_threshold: int = 5,
    recovery_timeout: int = 60
):
    """Decorator for implementing circuit breaker pattern"""
    
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Check if circuit is open
            if error_recovery.is_circuit_open(service_name):
                raise HoneypotError(
                    message=f"Service {service_name} is temporarily unavailable",
                    error_code="CIRCUIT_BREAKER_OPEN",
                    category=ErrorCategory.EXTERNAL_SERVICE,
                    severity=ErrorSeverity.HIGH,
                    http_status=503,
                    user_friendly_message="Service temporarily unavailable"
                )
            
            try:
                result = await func(*args, **kwargs)
                error_recovery.record_success(service_name)
                return result
            except Exception as e:
                error_recovery.record_failure(service_name)
                raise e
        
        return wrapper
    
    return decorator
