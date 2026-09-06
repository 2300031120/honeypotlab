#!/usr/bin/env python3
"""
Safe configuration validation script - non-breaking, read-only checks
Run this before deployment to catch common configuration issues
"""
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

# Load .env file if it exists
env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(env_file)
        print(f"✅ Loaded environment from {env_file}")
    except ImportError:
        print("⚠️  python-dotenv not installed, using system environment only")
        print("   Install with: pip install python-dotenv")

# Add backend to path
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

PLACEHOLDER_MARKERS = ["change-me", "change_this", "placeholder", "replace_with", "example", "your_"]
CRITICAL_KEYS = [
    "SECRET_KEY",
    "DATABASE_URL", 
    "BOOTSTRAP_ADMIN_PASSWORD",
    "PROTOCOL_SHARED_SECRET",
]

def is_placeholder(value: str) -> bool:
    """Check if value contains placeholder markers"""
    if not value:
        return True
    lowered = str(value).lower()
    return any(marker in lowered for marker in PLACEHOLDER_MARKERS)

def validate_url(value: str, name: str) -> list[str]:
    """Validate URL format"""
    issues = []
    if not value:
        return issues
    
    try:
        parsed = urlparse(value)
        if parsed.scheme not in ["http", "https"]:
            issues.append(f"{name}: URL must use http:// or https://")
        if not parsed.netloc:
            issues.append(f"{name}: URL must have a valid hostname")
    except Exception as e:
        issues.append(f"{name}: Invalid URL format - {e}")
    
    return issues

def validate_database_url(value: str) -> list[str]:
    """Validate database URL format"""
    issues = []
    if not value:
        return ["DATABASE_URL: Not set"]
    
    lowered = value.lower()
    if lowered.startswith("sqlite:///"):
        return []  # SQLite is valid
    elif lowered.startswith(("postgresql://", "postgres://")):
        try:
            parsed = urlparse(value)
            if not parsed.hostname:
                issues.append("DATABASE_URL: PostgreSQL URL must include hostname")
            if not parsed.password or is_placeholder(parsed.password):
                issues.append("DATABASE_URL: PostgreSQL password appears to be placeholder or missing")
        except Exception as e:
            issues.append(f"DATABASE_URL: Invalid format - {e}")
    else:
        issues.append("DATABASE_URL: Must use sqlite:/// or postgresql://")
    
    return issues

def main():
    """Run validation checks"""
    print("🔍 Configuration Validation - Safe Checks Only")
    print("=" * 50)
    
    all_issues = []
    warnings = []
    
    # Check critical secrets
    print("\n🔐 Critical Secrets Check:")
    for key in CRITICAL_KEYS:
        value = os.getenv(key, "")
        if not value:
            all_issues.append(f"{key}: Not set (empty)")
        elif is_placeholder(value):
            all_issues.append(f"{key}: Contains placeholder value")
        elif key == "SECRET_KEY" and len(value) < 32:
            all_issues.append(f"{key}: Too short (must be 32+ characters)")
        else:
            print(f"  ✅ {key}: OK")
    
    # Check database configuration
    print("\n💾 Database Configuration:")
    db_url = os.getenv("DATABASE_URL", "")
    db_issues = validate_database_url(db_url)
    for issue in db_issues:
        all_issues.append(issue)
    if not db_issues:
        print(f"  ✅ DATABASE_URL: Valid format")
    
    # Check CORS configuration
    print("\n🌐 CORS Configuration:")
    cors_origins = os.getenv("CORS_ORIGINS", "")
    if not cors_origins:
        warnings.append("CORS_ORIGINS: Not set (will use wildcard)")
    elif "*" in cors_origins and os.getenv("APP_ENV", "development") == "production":
        all_issues.append("CORS_ORIGINS: Wildcard (*) not allowed in production")
    else:
        print(f"  ✅ CORS_ORIGINS: Set")
    
    # Check trusted hosts
    print("\n🛡️ Trusted Hosts:")
    trusted_hosts = os.getenv("TRUSTED_HOSTS", "")
    if not trusted_hosts:
        warnings.append("TRUSTED_HOSTS: Not set")
    else:
        print(f"  ✅ TRUSTED_HOSTS: Set")
    
    # Check public base URL
    print("\n🌍 Public Base URL:")
    public_url = os.getenv("PUBLIC_BASE_URL", "")
    url_issues = validate_url(public_url, "PUBLIC_BASE_URL")
    for issue in url_issues:
        all_issues.append(issue)
    if not url_issues and public_url:
        print(f"  ✅ PUBLIC_BASE_URL: Valid format")
    
    # Check environment
    print("\n🏗️ Environment:")
    app_env = os.getenv("APP_ENV", "development")
    print(f"  APP_ENV: {app_env}")
    if app_env == "production":
        demo_seed = os.getenv("ENABLE_DEMO_SEED", "true")
        if demo_seed.lower() in ["true", "1", "yes"]:
            all_issues.append("ENABLE_DEMO_SEED: Must be false in production")
        else:
            print(f"  ✅ ENABLE_DEMO_SEED: Correctly disabled")
    
    # Print results
    print("\n" + "=" * 50)
    if all_issues:
        print("❌ CRITICAL ISSUES FOUND:")
        for issue in all_issues:
            print(f"  - {issue}")
        print(f"\nTotal: {len(all_issues)} critical issue(s)")
        return 1
    elif warnings:
        print("⚠️ WARNINGS (non-critical):")
        for warning in warnings:
            print(f"  - {warning}")
        print(f"\nTotal: {len(warnings)} warning(s)")
        return 0
    else:
        print("✅ All checks passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())
