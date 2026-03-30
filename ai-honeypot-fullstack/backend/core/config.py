import os
from urllib.parse import urlparse


APP_TITLE = "CyberSentinel Backend"
APP_ENV = os.getenv("APP_ENV", "development").strip().lower() or "development"
JWT_ALGO = "HS256"
JWT_EXP_HOURS = 12
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").strip()
BOOTSTRAP_ADMIN_USERNAME = os.getenv("BOOTSTRAP_ADMIN_USERNAME", "admin").strip() or "admin"
BOOTSTRAP_ADMIN_EMAIL = os.getenv("BOOTSTRAP_ADMIN_EMAIL", "admin@cybersentinel.local").strip() or "admin@cybersentinel.local"
BOOTSTRAP_ADMIN_PASSWORD = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "Admin@123")
ENABLE_DEMO_SEED = os.getenv("ENABLE_DEMO_SEED", "true").strip().lower() in {"1", "true", "yes", "on"}
ALLOW_SIGNUP = os.getenv("ALLOW_SIGNUP", "true").strip().lower() in {"1", "true", "yes", "on"}
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
BACKEND_DB_PATH = os.getenv("BACKEND_DB_PATH", "").strip()
ALLOWED_STATUS = ["new", "contacted", "qualified", "demo_scheduled", "closed_won", "closed_lost", "spam"]
STATUS_TRANSITIONS = {
    "new": ["contacted", "qualified", "spam", "closed_lost"],
    "contacted": ["qualified", "demo_scheduled", "closed_lost", "spam"],
    "qualified": ["demo_scheduled", "closed_won", "closed_lost", "spam"],
    "demo_scheduled": ["closed_won", "closed_lost", "spam"],
    "closed_won": [],
    "closed_lost": [],
    "spam": [],
}

_BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))
PLACEHOLDER_MARKERS = ("change-me", "change_this", "placeholder", "replace_with", "example", "your_")
EXAMPLE_TRAP_CREDENTIALS = {"user1:pass1,user2:pass2"}


def split_env_csv(name: str, default: str = "") -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in str(raw or "").split(",") if item.strip()]


def database_backend_from_url(database_url: str) -> str:
    lowered = str(database_url or "").strip().lower()
    if lowered.startswith(("postgresql://", "postgres://")):
        return "postgresql"
    return "sqlite"


def env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return int(str(raw).strip())
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer.") from exc


def env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return float(str(raw).strip())
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a float.") from exc


def is_placeholder_secret(value: str) -> bool:
    lowered = str(value or "").strip().lower()
    if not lowered:
        return True
    return any(marker in lowered for marker in PLACEHOLDER_MARKERS)


def has_real_trap_credentials(value: str) -> bool:
    normalized = ",".join(part.strip() for part in str(value or "").split(",") if part.strip())
    if not normalized:
        return False
    if is_placeholder_secret(normalized) or normalized.lower() in EXAMPLE_TRAP_CREDENTIALS:
        return False
    for pair in normalized.split(","):
        if ":" not in pair:
            return False
        username, password = pair.split(":", 1)
        if not username.strip() or not password.strip():
            return False
    return True


def trusted_host_matches(hostname: str, candidates: list[str]) -> bool:
    target = str(hostname or "").strip().lower()
    if not target:
        return False
    for item in candidates:
        current = str(item or "").strip().lower()
        if not current:
            continue
        if current == target:
            return True
        if current.startswith("*.") and target.endswith(current[1:]):
            return True
    return False


def _resolve_secret_key() -> str:
    secret_key = os.getenv("SECRET_KEY", "").strip()
    if not secret_key and APP_ENV != "production":
        return "dev-secret-key-change-me-at-least-32b"
    return secret_key


def _resolve_db_path() -> str:
    if database_backend_from_url(DATABASE_URL) != "sqlite":
        return ""
    if BACKEND_DB_PATH:
        return BACKEND_DB_PATH
    if not DATABASE_URL:
        return os.path.join(_BACKEND_DIR, "runtime.db")
    lowered = DATABASE_URL.lower()
    if not lowered.startswith("sqlite:///"):
        raise RuntimeError("Only sqlite DATABASE_URL values are currently supported by this backend.")
    target = DATABASE_URL[len("sqlite:///") :]
    if not target:
        return os.path.join(_BACKEND_DIR, "runtime.db")
    if os.path.isabs(target):
        return target
    return os.path.normpath(os.path.join(_BACKEND_DIR, target))


SECRET_KEY = _resolve_secret_key()
DB_PATH = _resolve_db_path()
DATABASE_BACKEND = database_backend_from_url(DATABASE_URL)
CORS_ORIGINS = split_env_csv("CORS_ORIGINS", "*")
TRUSTED_HOSTS = split_env_csv("TRUSTED_HOSTS")
FORCE_HTTPS_REDIRECT = env_flag("FORCE_HTTPS_REDIRECT", default=APP_ENV == "production")
SECURITY_HEADERS_ENABLED = env_flag("SECURITY_HEADERS_ENABLED", default=True)
SECURITY_HSTS_SECONDS = max(0, env_int("SECURITY_HSTS_SECONDS", 31536000 if APP_ENV == "production" else 0))
SECURITY_CONTENT_SECURITY_POLICY = os.getenv("SECURITY_CONTENT_SECURITY_POLICY", "").strip()
DECOY_COOKIE_SECURE = env_flag("DECOY_COOKIE_SECURE", default=APP_ENV == "production")
DECOY_COOKIE_SAMESITE = os.getenv("DECOY_COOKIE_SAMESITE", "lax").strip().lower() or "lax"
AUTH_RATE_LIMIT_WINDOW_SECONDS = env_int("AUTH_RATE_LIMIT_WINDOW_SECONDS", 60)
AUTH_RATE_LIMIT_MAX_ATTEMPTS = env_int("AUTH_RATE_LIMIT_MAX_ATTEMPTS", 8)
LEAD_RATE_LIMIT_WINDOW_SECONDS = env_int("LEAD_RATE_LIMIT_WINDOW_SECONDS", 300)
LEAD_RATE_LIMIT_MAX_ATTEMPTS = env_int("LEAD_RATE_LIMIT_MAX_ATTEMPTS", 5)
TERMINAL_REAL_EXEC_ENABLED = env_flag("TERMINAL_REAL_EXEC_ENABLED", default=False)
TERMINAL_SANDBOX_URL = os.getenv("TERMINAL_SANDBOX_URL", "").strip()
TERMINAL_EXEC_TIMEOUT_SEC = max(1, env_int("TERMINAL_EXEC_TIMEOUT_SEC", 8))
TERMINAL_MAX_OUTPUT_CHARS = max(512, env_int("TERMINAL_MAX_OUTPUT_CHARS", 12000))
SPLUNK_HEC_URL = os.getenv("SPLUNK_HEC_URL", "").strip()
SPLUNK_HEC_TOKEN = os.getenv("SPLUNK_HEC_TOKEN", "").strip()
SPLUNK_HEC_VERIFY_TLS = env_flag("SPLUNK_HEC_VERIFY_TLS", default=True)
SPLUNK_HEC_TIMEOUT_SECONDS = max(1, env_int("SPLUNK_HEC_TIMEOUT_SECONDS", 4))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").strip().upper() or "INFO"
JSON_LOGS = env_flag("JSON_LOGS", default=APP_ENV == "production")
LOG_REQUESTS = env_flag("LOG_REQUESTS", default=True)
SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
SENTRY_ENVIRONMENT = os.getenv("SENTRY_ENVIRONMENT", APP_ENV).strip() or APP_ENV
SENTRY_TRACES_SAMPLE_RATE = env_float("SENTRY_TRACES_SAMPLE_RATE", 0.0)
PROTOCOL_SHARED_SECRET = os.getenv("PROTOCOL_SHARED_SECRET", "").strip() or ("dev-protocol-shared-secret" if APP_ENV != "production" else "")
PROTOCOL_SSH_AUTH_TRAP_ENABLED = env_flag("PROTOCOL_SSH_AUTH_TRAP_ENABLED", default=True)
PROTOCOL_SSH_TRAP_CREDENTIALS = os.getenv("PROTOCOL_SSH_TRAP_CREDENTIALS", "").strip()
PROTOCOL_MYSQL_AUTH_TRAP_ENABLED = env_flag("PROTOCOL_MYSQL_AUTH_TRAP_ENABLED", default=True)
PROTOCOL_MYSQL_TRAP_CREDENTIALS = os.getenv("PROTOCOL_MYSQL_TRAP_CREDENTIALS", "").strip()
SSH_DECOY_HEALTH_URL = os.getenv("SSH_DECOY_HEALTH_URL", "").strip()


def validate_runtime_config() -> None:
    failures: list[str] = []
    parsed_public = urlparse(PUBLIC_BASE_URL) if PUBLIC_BASE_URL else None
    parsed_database = urlparse(DATABASE_URL) if DATABASE_URL else None

    if len(SECRET_KEY) < 32 or (APP_ENV == "production" and is_placeholder_secret(SECRET_KEY)):
        failures.append("SECRET_KEY must be set to a strong 32+ character value.")

    if DATABASE_BACKEND == "sqlite" and DATABASE_URL and not DATABASE_URL.lower().startswith("sqlite:///"):
        failures.append("SQLite DATABASE_URL values must use sqlite:///.")
    if DATABASE_BACKEND not in {"sqlite", "postgresql"}:
        failures.append("DATABASE_URL must use sqlite:/// or postgresql://.")

    if DECOY_COOKIE_SAMESITE not in {"lax", "strict", "none"}:
        failures.append("DECOY_COOKIE_SAMESITE must be one of: lax, strict, none.")
    if DECOY_COOKIE_SAMESITE == "none" and not DECOY_COOKIE_SECURE:
        failures.append("DECOY_COOKIE_SECURE must be true when DECOY_COOKIE_SAMESITE is 'none'.")
    if AUTH_RATE_LIMIT_WINDOW_SECONDS < 1 or AUTH_RATE_LIMIT_MAX_ATTEMPTS < 1:
        failures.append("AUTH rate limit settings must be positive integers.")
    if LEAD_RATE_LIMIT_WINDOW_SECONDS < 1 or LEAD_RATE_LIMIT_MAX_ATTEMPTS < 1:
        failures.append("Lead rate limit settings must be positive integers.")
    if SPLUNK_HEC_URL or SPLUNK_HEC_TOKEN:
        parsed_splunk = urlparse(SPLUNK_HEC_URL) if SPLUNK_HEC_URL else None
        if not SPLUNK_HEC_URL or not SPLUNK_HEC_TOKEN:
            failures.append("SPLUNK_HEC_URL and SPLUNK_HEC_TOKEN must be set together.")
        elif parsed_splunk is None or parsed_splunk.scheme != "https" or not parsed_splunk.netloc:
            failures.append("SPLUNK_HEC_URL must be a valid HTTPS URL.")
        elif is_placeholder_secret(SPLUNK_HEC_URL) or is_placeholder_secret(SPLUNK_HEC_TOKEN):
            failures.append("Splunk HEC settings cannot use placeholder/example values.")
    if SENTRY_DSN:
        parsed_sentry = urlparse(SENTRY_DSN)
        if parsed_sentry.scheme not in {"http", "https"} or not parsed_sentry.netloc:
            failures.append("SENTRY_DSN must be a valid HTTP/HTTPS URL.")
        if not 0.0 <= SENTRY_TRACES_SAMPLE_RATE <= 1.0:
            failures.append("SENTRY_TRACES_SAMPLE_RATE must be between 0.0 and 1.0.")

    if APP_ENV == "production":
        if BOOTSTRAP_ADMIN_PASSWORD == "Admin@123":
            failures.append("BOOTSTRAP_ADMIN_PASSWORD must be changed for production.")
        if ENABLE_DEMO_SEED:
            failures.append("ENABLE_DEMO_SEED must be false in production.")
        if not PUBLIC_BASE_URL or parsed_public is None or parsed_public.scheme != "https" or not parsed_public.netloc:
            failures.append("PUBLIC_BASE_URL must be an HTTPS URL in production.")
        elif is_placeholder_secret(PUBLIC_BASE_URL):
            failures.append("PUBLIC_BASE_URL cannot use placeholder/example values in production.")
        if DATABASE_BACKEND != "postgresql":
            failures.append("DATABASE_URL must use PostgreSQL in production.")
        elif not parsed_database or is_placeholder_secret(parsed_database.password or ""):
            failures.append("DATABASE_URL must include a non-placeholder PostgreSQL password in production.")
        if not CORS_ORIGINS or "*" in CORS_ORIGINS:
            failures.append("CORS_ORIGINS must be explicitly set and cannot include '*'.")
        if any("localhost" in item.lower() or "127.0.0.1" in item.lower() for item in CORS_ORIGINS):
            failures.append("CORS_ORIGINS cannot contain localhost/127.0.0.1 in production.")
        if not TRUSTED_HOSTS or "*" in TRUSTED_HOSTS:
            failures.append("TRUSTED_HOSTS must be explicitly set and cannot include '*'.")
        if any("localhost" in item.lower() or "127.0.0.1" in item.lower() for item in TRUSTED_HOSTS):
            failures.append("TRUSTED_HOSTS cannot contain localhost/127.0.0.1 in production.")
        if parsed_public and parsed_public.hostname and not trusted_host_matches(parsed_public.hostname, TRUSTED_HOSTS):
            failures.append("TRUSTED_HOSTS must include the PUBLIC_BASE_URL hostname in production.")
        if not FORCE_HTTPS_REDIRECT:
            failures.append("FORCE_HTTPS_REDIRECT must be true in production.")
        if not SECURITY_HEADERS_ENABLED:
            failures.append("SECURITY_HEADERS_ENABLED must be true in production.")
        if not DECOY_COOKIE_SECURE:
            failures.append("DECOY_COOKIE_SECURE must be true in production.")
        if TERMINAL_REAL_EXEC_ENABLED and not TERMINAL_SANDBOX_URL:
            failures.append("TERMINAL_SANDBOX_URL must be set when TERMINAL_REAL_EXEC_ENABLED is true in production.")
        if PROTOCOL_SSH_AUTH_TRAP_ENABLED:
            if len(PROTOCOL_SHARED_SECRET) < 24 or is_placeholder_secret(PROTOCOL_SHARED_SECRET):
                failures.append("PROTOCOL_SHARED_SECRET must be a strong non-placeholder value when SSH trap mode is enabled in production.")
            if not has_real_trap_credentials(PROTOCOL_SSH_TRAP_CREDENTIALS):
                failures.append("PROTOCOL_SSH_TRAP_CREDENTIALS must contain non-placeholder user:pass pairs in production.")
        if PROTOCOL_MYSQL_AUTH_TRAP_ENABLED and not has_real_trap_credentials(PROTOCOL_MYSQL_TRAP_CREDENTIALS):
            failures.append("PROTOCOL_MYSQL_TRAP_CREDENTIALS must contain non-placeholder user:pass pairs in production.")

    if failures:
        raise RuntimeError("Production configuration invalid: " + " ".join(failures))
