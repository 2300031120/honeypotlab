"""
Health Check Monitoring Module
Provides system health monitoring with alerting capabilities
"""

import logging
import time
from typing import Any, Dict
from core.config import (
    HEALTH_CHECK_INTERVAL_SECONDS,
    HEALTH_CHECK_ALERT_THRESHOLD,
    HEALTH_CHECK_CPU_THRESHOLD,
    HEALTH_CHECK_MEMORY_THRESHOLD,
    HEALTH_CHECK_DISK_THRESHOLD,
)
from core.database import db
from core.time_utils import utc_now

logger = logging.getLogger(__name__)

# Health check state
_health_check_failures: Dict[str, int] = {}
_last_health_check_time = 0.0


def check_database_health() -> Dict[str, Any]:
    """Check database connectivity and performance"""
    try:
        start_time = time.time()
        with db() as conn:
            conn.execute("SELECT 1")
        response_time = (time.time() - start_time) * 1000  # Convert to ms
        
        return {
            "status": "healthy",
            "response_time_ms": round(response_time, 2),
            "timestamp": utc_now().isoformat()
        }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": utc_now().isoformat()
        }


def check_ai_service_health() -> Dict[str, Any]:
    """Check AI service availability and configuration"""
    from core.config import AI_LLM_ENABLED, AI_LLM_API_KEY
    
    if not AI_LLM_ENABLED:
        return {
            "status": "disabled",
            "message": "AI service is disabled",
            "timestamp": utc_now().isoformat()
        }
    
    if not AI_LLM_API_KEY:
        return {
            "status": "misconfigured",
            "message": "AI API key is not configured",
            "timestamp": utc_now().isoformat()
        }
    
    return {
        "status": "healthy",
        "message": "AI service is configured and enabled",
        "timestamp": utc_now().isoformat()
    }


def check_disk_space() -> Dict[str, Any]:
    """Check available disk space"""
    try:
        import shutil
        total, used, free = shutil.disk_usage("/")
        free_percent = (free / total) * 100
        used_percent = (used / total) * 100
        
        status = "healthy"
        if free_percent < (100 - HEALTH_CHECK_DISK_THRESHOLD):
            status = "warning"
        
        return {
            "status": status,
            "total_gb": round(total / (1024**3), 2),
            "used_gb": round(used / (1024**3), 2),
            "free_gb": round(free / (1024**3), 2),
            "free_percent": round(free_percent, 2),
            "used_percent": round(used_percent, 2),
            "timestamp": utc_now().isoformat()
        }
    except Exception as e:
        logger.error(f"Disk space check failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": utc_now().isoformat()
        }


def check_system_resources() -> Dict[str, Any]:
    """Check CPU and memory usage"""
    try:
        import psutil
        
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        
        status = "healthy"
        warnings = []
        
        if cpu_percent > HEALTH_CHECK_CPU_THRESHOLD:
            status = "warning"
            warnings.append(f"High CPU usage: {cpu_percent}%")
        
        if memory_percent > HEALTH_CHECK_MEMORY_THRESHOLD:
            status = "warning"
            warnings.append(f"High memory usage: {memory_percent}%")
        
        return {
            "status": status,
            "cpu_percent": cpu_percent,
            "memory_percent": memory_percent,
            "memory_available_gb": round(memory.available / (1024**3), 2),
            "warnings": warnings,
            "timestamp": utc_now().isoformat()
        }
    except ImportError:
        logger.warning("psutil not installed, skipping system resource check")
        return {
            "status": "skipped",
            "message": "psutil not installed",
            "timestamp": utc_now().isoformat()
        }
    except Exception as e:
        logger.error(f"System resource check failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": utc_now().isoformat()
        }


def run_health_checks() -> Dict[str, Any]:
    """
    Run all health checks and return aggregated results
    """
    global _last_health_check_time, _health_check_failures
    
    _last_health_check_time = time.time()
    
    results = {
        "timestamp": utc_now().isoformat(),
        "checks": {},
        "overall_status": "healthy"
    }
    
    # Run individual health checks
    results["checks"]["database"] = check_database_health()
    results["checks"]["ai_service"] = check_ai_service_health()
    results["checks"]["disk_space"] = check_disk_space()
    results["checks"]["system_resources"] = check_system_resources()
    
    # Determine overall status
    unhealthy_checks = []
    for check_name, check_result in results["checks"].items():
        if check_result.get("status") in ["unhealthy", "error"]:
            unhealthy_checks.append(check_name)
            _health_check_failures[check_name] = _health_check_failures.get(check_name, 0) + 1
        elif check_result.get("status") == "warning":
            unhealthy_checks.append(check_name)
            _health_check_failures[check_name] = _health_check_failures.get(check_name, 0) + 1
        else:
            _health_check_failures[check_name] = 0
    
    # Check if any health check has exceeded failure threshold
    for check_name, failures in _health_check_failures.items():
        if failures >= HEALTH_CHECK_ALERT_THRESHOLD:
            results["overall_status"] = "unhealthy"
            results["alert"] = f"Health check '{check_name}' has failed {failures} times"
            logger.error(results["alert"])
    
    if unhealthy_checks and results["overall_status"] == "healthy":
        results["overall_status"] = "degraded"
    
    return results


def get_health_status() -> Dict[str, Any]:
    """Get current health status without running full checks"""
    return {
        "last_check_time": _last_health_check_time,
        "health_check_interval": HEALTH_CHECK_INTERVAL_SECONDS,
        "alert_threshold": HEALTH_CHECK_ALERT_THRESHOLD,
        "current_failures": _health_check_failures,
        "timestamp": utc_now().isoformat()
    }
