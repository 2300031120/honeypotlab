import os
from urllib.parse import urlparse


APP_TITLE = "CyberSentil Backend"
APP_ENV = os.getenv("APP_ENV", "development").strip().lower() or "development"
JWT_ALGO = "HS256"
JWT_EXP_HOURS = 12
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").strip()
BOOTSTRAP_ADMIN_USERNAME = os.getenv("BOOTSTRAP_ADMIN_USERNAME", "admin").strip() or "admin"
BOOTSTRAP_ADMIN_EMAIL = os.getenv("BOOTSTRAP_ADMIN_EMAIL", "admin@cybersentil.local").strip() or "admin@cybersentil.local"
BOOTSTRAP_ADMIN_PASSWORD = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "ChangeThisAdminPassword_2026!")
ENABLE_DEMO_SEED = os.getenv("ENABLE_DEMO_SEED", "true").strip().lower() in {"1", "true", "yes", "on"}
ALLOW_SIGNUP = os.getenv("ALLOW_SIGNUP", "false").strip().lower() in {"1", "true", "yes", "on"}
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
DATABASE_REPLICA_URL = os.getenv("DATABASE_REPLICA_URL", "").strip()
BACKEND_DB_PATH = os.getenv("BACKEND_DB_PATH", "").strip()
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0").strip()
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


def origin_from_url(value: str) -> str:
    parsed = urlparse(str(value or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    return f"{parsed.scheme}://{parsed.netloc}".lower()


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


def _resolve_csrf_trusted_origins() -> list[str]:
    candidates: set[str] = set()
    for raw in split_env_csv("CSRF_TRUSTED_ORIGINS"):
        origin = origin_from_url(raw)
        if origin:
            candidates.add(origin)

    public_origin = origin_from_url(PUBLIC_BASE_URL)
    if public_origin:
        candidates.add(public_origin)

    for raw in CORS_ORIGINS:
        if raw == "*":
            continue
        origin = origin_from_url(raw)
        if origin:
            candidates.add(origin)

    if APP_ENV != "production":
        candidates.update(
            {
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:4173",
                "http://127.0.0.1:4173",
                "http://testserver",
            }
        )
    return sorted(candidates)


SECRET_KEY = _resolve_secret_key()
DB_PATH = _resolve_db_path()
DATABASE_BACKEND = database_backend_from_url(DATABASE_URL)
CORS_ORIGINS = split_env_csv("CORS_ORIGINS", "*")
TRUSTED_HOSTS = split_env_csv("TRUSTED_HOSTS")
CSRF_TRUSTED_ORIGINS = _resolve_csrf_trusted_origins()
FORCE_HTTPS_REDIRECT = env_flag("FORCE_HTTPS_REDIRECT", default=APP_ENV == "production")
SECURITY_HEADERS_ENABLED = env_flag("SECURITY_HEADERS_ENABLED", default=True)
SECURITY_HSTS_SECONDS = max(0, env_int("SECURITY_HSTS_SECONDS", 31536000 if APP_ENV == "production" else 0))
SECURITY_CONTENT_SECURITY_POLICY = os.getenv("SECURITY_CONTENT_SECURITY_POLICY", "").strip()
DECOY_COOKIE_SECURE = env_flag("DECOY_COOKIE_SECURE", default=APP_ENV == "production")
DECOY_COOKIE_SAMESITE = os.getenv("DECOY_COOKIE_SAMESITE", "lax").strip().lower() or "lax"
CLOUDFLARE_TUNNEL_ENABLED = env_flag("CLOUDFLARE_TUNNEL_ENABLED", default=False)
ADMIN_WHITELIST_IPS = split_env_csv("ADMIN_WHITELIST_IPS", "")
RESPONSE_OBFUSCATION_ENABLED = env_flag("RESPONSE_OBFUSCATION_ENABLED", default=False)
AUTH_COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "cybersentil_session").strip() or "cybersentil_session"
AUTH_COOKIE_SECURE = env_flag("AUTH_COOKIE_SECURE", default=APP_ENV == "production")
AUTH_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "lax").strip().lower() or "lax"
AUTH_COOKIE_MAX_AGE_SECONDS = max(300, env_int("AUTH_COOKIE_MAX_AGE_SECONDS", JWT_EXP_HOURS * 3600))
AUTH_RATE_LIMIT_WINDOW_SECONDS = env_int("AUTH_RATE_LIMIT_WINDOW_SECONDS", 60)
AUTH_RATE_LIMIT_MAX_ATTEMPTS = env_int("AUTH_RATE_LIMIT_MAX_ATTEMPTS", 8)
LEAD_RATE_LIMIT_WINDOW_SECONDS = env_int("LEAD_RATE_LIMIT_WINDOW_SECONDS", 300)
LEAD_RATE_LIMIT_MAX_ATTEMPTS = env_int("LEAD_RATE_LIMIT_MAX_ATTEMPTS", 5)
CONSENT_RATE_LIMIT_WINDOW_SECONDS = env_int("CONSENT_RATE_LIMIT_WINDOW_SECONDS", 60)
CONSENT_RATE_LIMIT_MAX_ATTEMPTS = env_int("CONSENT_RATE_LIMIT_MAX_ATTEMPTS", 10)
TERMINAL_CMD_RATE_LIMIT_WINDOW_SECONDS = env_int("TERMINAL_CMD_RATE_LIMIT_WINDOW_SECONDS", 60)
TERMINAL_CMD_RATE_LIMIT_MAX_ATTEMPTS = env_int("TERMINAL_CMD_RATE_LIMIT_MAX_ATTEMPTS", 60)
AI_ADVISOR_RATE_LIMIT_WINDOW_SECONDS = env_int("AI_ADVISOR_RATE_LIMIT_WINDOW_SECONDS", 60)
AI_ADVISOR_RATE_LIMIT_MAX_ATTEMPTS = env_int("AI_ADVISOR_RATE_LIMIT_MAX_ATTEMPTS", 20)
URL_SCAN_RATE_LIMIT_WINDOW_SECONDS = env_int("URL_SCAN_RATE_LIMIT_WINDOW_SECONDS", 60)
URL_SCAN_RATE_LIMIT_MAX_ATTEMPTS = env_int("URL_SCAN_RATE_LIMIT_MAX_ATTEMPTS", 20)
SIMULATOR_RATE_LIMIT_WINDOW_SECONDS = env_int("SIMULATOR_RATE_LIMIT_WINDOW_SECONDS", 60)
SIMULATOR_RATE_LIMIT_MAX_ATTEMPTS = env_int("SIMULATOR_RATE_LIMIT_MAX_ATTEMPTS", 12)
FINAL_REPORT_RATE_LIMIT_WINDOW_SECONDS = env_int("FINAL_REPORT_RATE_LIMIT_WINDOW_SECONDS", 60)
FINAL_REPORT_RATE_LIMIT_MAX_ATTEMPTS = env_int("FINAL_REPORT_RATE_LIMIT_MAX_ATTEMPTS", 12)
RESEARCH_RUN_RATE_LIMIT_WINDOW_SECONDS = env_int("RESEARCH_RUN_RATE_LIMIT_WINDOW_SECONDS", 60)
RESEARCH_RUN_RATE_LIMIT_MAX_ATTEMPTS = env_int("RESEARCH_RUN_RATE_LIMIT_MAX_ATTEMPTS", 6)
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
LEAD_NOTIFICATION_WEBHOOK_URL = os.getenv("LEAD_NOTIFICATION_WEBHOOK_URL", "").strip()
LEAD_NOTIFICATION_WEBHOOK_TIMEOUT_SECONDS = max(1, env_int("LEAD_NOTIFICATION_WEBHOOK_TIMEOUT_SECONDS", 5))
LEAD_NOTIFICATION_EMAIL_TO = split_env_csv("LEAD_NOTIFICATION_EMAIL_TO")
LEAD_NOTIFICATION_BRAND_NAME = (
    os.getenv("LEAD_NOTIFICATION_BRAND_NAME", os.getenv("VITE_PUBLIC_SHORT_NAME", "CyberSentil")).strip() or "CyberSentil"
)
LEAD_NOTIFICATION_CONTACT_EMAIL = (
    os.getenv("LEAD_NOTIFICATION_CONTACT_EMAIL", os.getenv("VITE_PUBLIC_CONTACT_EMAIL", "")).strip()
)
LEAD_AUTOREPLY_ENABLED = env_flag("LEAD_AUTOREPLY_ENABLED", default=False)
LEAD_AUTOREPLY_REPLY_TO = os.getenv("LEAD_AUTOREPLY_REPLY_TO", "").strip()
LEAD_AUTOREPLY_DEMO_BOOKING_URL = os.getenv(
    "LEAD_AUTOREPLY_DEMO_BOOKING_URL", os.getenv("VITE_PUBLIC_DEMO_BOOKING_URL", "")
).strip()
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = env_int("SMTP_PORT", 587)
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "").strip()
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", LEAD_NOTIFICATION_BRAND_NAME).strip() or LEAD_NOTIFICATION_BRAND_NAME
SMTP_USE_TLS = env_flag("SMTP_USE_TLS", default=True)
SMTP_USE_SSL = env_flag("SMTP_USE_SSL", default=False)
PROTOCOL_SHARED_SECRET = os.getenv("PROTOCOL_SHARED_SECRET", "").strip() or ("dev-protocol-shared-secret" if APP_ENV != "production" else "")
PROTOCOL_SSH_AUTH_TRAP_ENABLED = env_flag("PROTOCOL_SSH_AUTH_TRAP_ENABLED", default=True)
PROTOCOL_SSH_TRAP_CREDENTIALS = os.getenv("PROTOCOL_SSH_TRAP_CREDENTIALS", "").strip()
PROTOCOL_MYSQL_AUTH_TRAP_ENABLED = env_flag("PROTOCOL_MYSQL_AUTH_TRAP_ENABLED", default=True)
PROTOCOL_MYSQL_TRAP_CREDENTIALS = os.getenv("PROTOCOL_MYSQL_TRAP_CREDENTIALS", "").strip()
SSH_DECOY_HEALTH_URL = os.getenv("SSH_DECOY_HEALTH_URL", "").strip()
AI_LLM_ENABLED = env_flag("AI_LLM_ENABLED", default=False)
AI_LLM_PROVIDER = os.getenv("AI_LLM_PROVIDER", "openai").strip().lower() or "openai"
AI_LLM_MODEL = os.getenv("AI_LLM_MODEL", "gpt-4").strip() or "gpt-4"
AI_LLM_API_KEY = os.getenv("AI_LLM_API_KEY", "").strip()
AI_LLM_MAX_TOKENS = env_int("AI_LLM_MAX_TOKENS", 2000)
AI_LLM_TEMPERATURE = env_float("AI_LLM_TEMPERATURE", 0.7)
EVENTS_RETENTION_DAYS = env_int("EVENTS_RETENTION_DAYS", 90)
LEADS_RETENTION_DAYS = env_int("LEADS_RETENTION_DAYS", 365)
AUDIT_LOG_RETENTION_DAYS = env_int("AUDIT_LOG_RETENTION_DAYS", 180)
BLOCKED_IPS_RETENTION_DAYS = env_int("BLOCKED_IPS_RETENTION_DAYS", 30)
REQUEST_LOGS_RETENTION_DAYS = env_int("REQUEST_LOGS_RETENTION_DAYS", 30)
AI_API_COST_BUDGET_MONTHLY = env_float("AI_API_COST_BUDGET_MONTHLY", 100.0)
AI_API_COST_ALERT_THRESHOLD = env_float("AI_API_COST_ALERT_THRESHOLD", 0.8)
HEALTH_CHECK_INTERVAL_SECONDS = env_int("HEALTH_CHECK_INTERVAL_SECONDS", 60)

# QRadar SIEM Integration
QRADAR_HOST = os.getenv("QRADAR_HOST", "").strip()
QRADAR_PORT = env_int("QRADAR_PORT", 443)
QRADAR_TOKEN = os.getenv("QRADAR_TOKEN", "").strip()
QRADAR_VERIFY_TLS = env_flag("QRADAR_VERIFY_TLS", default=True)
QRADAR_TIMEOUT_SECONDS = max(1, env_int("QRADAR_TIMEOUT_SECONDS", 5))

# Elastic Security SIEM Integration
ELASTIC_HOST = os.getenv("ELASTIC_HOST", "").strip()
ELASTIC_PORT = env_int("ELASTIC_PORT", 9200)
ELASTIC_USERNAME = os.getenv("ELASTIC_USERNAME", "").strip()
ELASTIC_PASSWORD = os.getenv("ELASTIC_PASSWORD", "").strip()
ELASTIC_API_KEY = os.getenv("ELASTIC_API_KEY", "").strip()
ELASTIC_INDEX = os.getenv("ELASTIC_INDEX", "deception-events").strip() or "deception-events"
ELASTIC_VERIFY_TLS = env_flag("ELASTIC_VERIFY_TLS", default=True)
ELASTIC_TIMEOUT_SECONDS = max(1, env_int("ELASTIC_TIMEOUT_SECONDS", 5))

# Microsoft Sentinel SIEM Integration
SENTINEL_WORKSPACE_ID = os.getenv("SENTINEL_WORKSPACE_ID", "").strip()
SENTINEL_SHARED_KEY = os.getenv("SENTINEL_SHARED_KEY", "").strip()
SENTINEL_LOG_TYPE = os.getenv("SENTINEL_LOG_TYPE", "DeceptionEvents").strip() or "DeceptionEvents"
SENTINEL_TIMEOUT_SECONDS = max(1, env_int("SENTINEL_TIMEOUT_SECONDS", 10))
HEALTH_CHECK_ALERT_THRESHOLD = env_int("HEALTH_CHECK_ALERT_THRESHOLD", 3)
HEALTH_CHECK_CPU_THRESHOLD = env_int("HEALTH_CHECK_CPU_THRESHOLD", 80)
HEALTH_CHECK_MEMORY_THRESHOLD = env_int("HEALTH_CHECK_MEMORY_THRESHOLD", 80)
HEALTH_CHECK_DISK_THRESHOLD = env_int("HEALTH_CHECK_DISK_THRESHOLD", 85)


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
    if AUTH_COOKIE_SAMESITE not in {"lax", "strict", "none"}:
        failures.append("AUTH_COOKIE_SAMESITE must be one of: lax, strict, none.")
    if AUTH_COOKIE_SAMESITE == "none" and not AUTH_COOKIE_SECURE:
        failures.append("AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAMESITE is 'none'.")
    if any(not origin_from_url(item) for item in CSRF_TRUSTED_ORIGINS):
        failures.append("CSRF_TRUSTED_ORIGINS must contain valid HTTP/HTTPS origins.")
    if AUTH_RATE_LIMIT_WINDOW_SECONDS < 1 or AUTH_RATE_LIMIT_MAX_ATTEMPTS < 1:
        failures.append("AUTH rate limit settings must be positive integers.")
    if LEAD_RATE_LIMIT_WINDOW_SECONDS < 1 or LEAD_RATE_LIMIT_MAX_ATTEMPTS < 1:
        failures.append("Lead rate limit settings must be positive integers.")
    if TERMINAL_CMD_RATE_LIMIT_WINDOW_SECONDS < 1 or TERMINAL_CMD_RATE_LIMIT_MAX_ATTEMPTS < 1:
        failures.append("Terminal command rate limit settings must be positive integers.")
    if AI_ADVISOR_RATE_LIMIT_WINDOW_SECONDS < 1 or AI_ADVISOR_RATE_LIMIT_MAX_ATTEMPTS < 1:
        failures.append("AI advisor rate limit settings must be positive integers.")
    if URL_SCAN_RATE_LIMIT_WINDOW_SECONDS < 1 or URL_SCAN_RATE_LIMIT_MAX_ATTEMPTS < 1:
        failures.append("URL scan rate limit settings must be positive integers.")
    if SIMULATOR_RATE_LIMIT_WINDOW_SECONDS < 1 or SIMULATOR_RATE_LIMIT_MAX_ATTEMPTS < 1:
        failures.append("Simulator rate limit settings must be positive integers.")
    if FINAL_REPORT_RATE_LIMIT_WINDOW_SECONDS < 1 or FINAL_REPORT_RATE_LIMIT_MAX_ATTEMPTS < 1:
        failures.append("Final report rate limit settings must be positive integers.")
    if RESEARCH_RUN_RATE_LIMIT_WINDOW_SECONDS < 1 or RESEARCH_RUN_RATE_LIMIT_MAX_ATTEMPTS < 1:
        failures.append("Research run rate limit settings must be positive integers.")
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
    if LEAD_NOTIFICATION_WEBHOOK_URL:
        parsed_webhook = urlparse(LEAD_NOTIFICATION_WEBHOOK_URL)
        if parsed_webhook.scheme not in {"http", "https"} or not parsed_webhook.netloc:
            failures.append("LEAD_NOTIFICATION_WEBHOOK_URL must be a valid HTTP/HTTPS URL.")
        elif is_placeholder_secret(LEAD_NOTIFICATION_WEBHOOK_URL):
            failures.append("LEAD_NOTIFICATION_WEBHOOK_URL cannot use placeholder/example values.")
    smtp_any = any(
        [
            SMTP_HOST,
            SMTP_USERNAME,
            SMTP_PASSWORD,
            SMTP_FROM_EMAIL,
            bool(LEAD_NOTIFICATION_EMAIL_TO),
            LEAD_AUTOREPLY_ENABLED,
        ]
    )
    if SMTP_PORT < 1 or SMTP_PORT > 65535:
        failures.append("SMTP_PORT must be between 1 and 65535.")
    if SMTP_USE_TLS and SMTP_USE_SSL:
        failures.append("SMTP_USE_TLS and SMTP_USE_SSL cannot both be true.")
    if smtp_any:
        if not SMTP_HOST:
            failures.append("SMTP_HOST must be set when lead email follow-up is enabled.")
        if not SMTP_FROM_EMAIL:
            failures.append("SMTP_FROM_EMAIL must be set when lead email follow-up is enabled.")

    if APP_ENV == "production":
        if len(BOOTSTRAP_ADMIN_PASSWORD) < 12 or is_placeholder_secret(BOOTSTRAP_ADMIN_PASSWORD):
            failures.append("BOOTSTRAP_ADMIN_PASSWORD must be set to a strong non-placeholder value for production.")
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
        if not CSRF_TRUSTED_ORIGINS:
            failures.append("CSRF_TRUSTED_ORIGINS must include at least one trusted origin in production.")
        if any("localhost" in item or "127.0.0.1" in item for item in CSRF_TRUSTED_ORIGINS):
            failures.append("CSRF_TRUSTED_ORIGINS cannot contain localhost/127.0.0.1 in production.")
        if public_origin := origin_from_url(PUBLIC_BASE_URL):
            if public_origin not in CSRF_TRUSTED_ORIGINS:
                failures.append("CSRF_TRUSTED_ORIGINS must include the PUBLIC_BASE_URL origin in production.")
        if not TRUSTED_HOSTS or "*" in TRUSTED_HOSTS:
            failures.append("TRUSTED_HOSTS must be explicitly set and cannot include '*'.")
        if any("localhost" in item.lower() or "127.0.0.1" in item.lower() for item in TRUSTED_HOSTS) and not CLOUDFLARE_TUNNEL_ENABLED:
            failures.append("TRUSTED_HOSTS cannot contain localhost/127.0.0.1 in production unless CLOUDFLARE_TUNNEL_ENABLED is true.")
        if parsed_public and parsed_public.hostname and not trusted_host_matches(parsed_public.hostname, TRUSTED_HOSTS):
            failures.append("TRUSTED_HOSTS must include the PUBLIC_BASE_URL hostname in production.")
        if not FORCE_HTTPS_REDIRECT and not CLOUDFLARE_TUNNEL_ENABLED:
            failures.append("FORCE_HTTPS_REDIRECT must be true in production unless CLOUDFLARE_TUNNEL_ENABLED is true.")
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
