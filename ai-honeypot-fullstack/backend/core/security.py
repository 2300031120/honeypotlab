import base64
import hashlib
import hmac
import secrets
from datetime import timedelta
from typing import Any

import jwt
from fastapi import HTTPException

from core.config import JWT_ALGO, JWT_EXP_HOURS, SECRET_KEY
from core.time_utils import utc_now

try:
    from argon2 import PasswordHasher
    from argon2.exceptions import InvalidHashError, VerifyMismatchError
except ImportError:
    PasswordHasher = None
    InvalidHashError = VerifyMismatchError = ValueError


PBKDF2_PREFIX = "pbkdf2_sha256"
PBKDF2_ITERATIONS = 600_000
LEGACY_SHA256_LENGTH = 64
API_KEY_HASH_PREFIX = "sha256$"
_ARGON2_HASHER = (
    PasswordHasher(time_cost=2, memory_cost=19_456, parallelism=1, hash_len=32, salt_len=16)
    if PasswordHasher is not None
    else None
)


def _hash_pbkdf2(password: str, *, iterations: int = PBKDF2_ITERATIONS, salt: str | None = None) -> str:
    salt_value = salt or secrets.token_urlsafe(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_value.encode("utf-8"), iterations)
    encoded = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return f"{PBKDF2_PREFIX}${iterations}${salt_value}${encoded}"


def _verify_pbkdf2(password: str, stored_hash: str) -> bool:
    try:
        _, raw_iterations, salt, expected = stored_hash.split("$", 3)
        iterations = int(raw_iterations)
    except ValueError:
        return False
    candidate = _hash_pbkdf2(password, iterations=iterations, salt=salt)
    return hmac.compare_digest(candidate, stored_hash)


def _is_legacy_sha256_hash(stored_hash: str) -> bool:
    return len(stored_hash) == LEGACY_SHA256_LENGTH and all(char in "0123456789abcdef" for char in stored_hash.lower())


def hash_password(password: str) -> str:
    if _ARGON2_HASHER is not None:
        return _ARGON2_HASHER.hash(password)
    return _hash_pbkdf2(password)


def verify_password(password: str, stored_hash: str) -> bool:
    if not stored_hash:
        return False
    if stored_hash.startswith("$argon2"):
        if _ARGON2_HASHER is None:
            return False
        try:
            return bool(_ARGON2_HASHER.verify(stored_hash, password))
        except (VerifyMismatchError, InvalidHashError):
            return False
    if stored_hash.startswith(f"{PBKDF2_PREFIX}$"):
        return _verify_pbkdf2(password, stored_hash)
    if _is_legacy_sha256_hash(stored_hash):
        return hmac.compare_digest(stored_hash, hashlib.sha256(password.encode("utf-8")).hexdigest())
    return False


def password_needs_rehash(stored_hash: str) -> bool:
    if not stored_hash:
        return True
    if stored_hash.startswith("$argon2"):
        return bool(_ARGON2_HASHER and _ARGON2_HASHER.check_needs_rehash(stored_hash))
    if stored_hash.startswith(f"{PBKDF2_PREFIX}$"):
        try:
            _, raw_iterations, _, _ = stored_hash.split("$", 3)
            iterations = int(raw_iterations)
        except ValueError:
            return True
        return _ARGON2_HASHER is not None or iterations < PBKDF2_ITERATIONS
    return True


def verify_and_upgrade_password(password: str, stored_hash: str) -> tuple[bool, str | None]:
    if not verify_password(password, stored_hash):
        return False, None
    if password_needs_rehash(stored_hash):
        return True, hash_password(password)
    return True, None


def stable_hash(value: str, length: int = 16) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:length]


def hash_api_key(api_key: str) -> str:
    return f"{API_KEY_HASH_PREFIX}{hashlib.sha256(str(api_key or '').encode('utf-8')).hexdigest()}"


def verify_api_key(api_key: str, stored_value: str) -> bool:
    if not api_key or not stored_value:
        return False
    candidate = hash_api_key(api_key)
    if stored_value.startswith(API_KEY_HASH_PREFIX):
        return hmac.compare_digest(candidate, stored_value)
    return hmac.compare_digest(str(api_key), str(stored_value))


def create_token(user: dict[str, Any]) -> str:
    payload = {
        "sub": str(user["id"]),
        "username": user["username"],
        "role": user["role"],
        "email": user.get("email"),
        "exp": utc_now() + timedelta(hours=JWT_EXP_HOURS),
        "iat": utc_now(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGO)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGO])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token.") from exc


def parse_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header.")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid authorization header.")
    return token
