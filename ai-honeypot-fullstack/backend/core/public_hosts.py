import ipaddress
import re
from typing import Any, Iterable
from urllib.parse import urlparse


RESERVED_PUBLIC_HOSTS = {"localhost", "127.0.0.1", "::1", "backend", "testserver"}
_HOST_LABEL_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")


def normalize_public_host(value: str | None) -> str:
    candidate = str(value or "").strip().lower()
    if not candidate:
        return ""
    if "://" in candidate:
        parsed = urlparse(candidate)
        candidate = parsed.hostname or ""
    candidate = candidate.split(",", 1)[0].strip()
    if candidate.startswith("[") and "]" in candidate:
        candidate = candidate[1 : candidate.index("]")]
    elif ":" in candidate and candidate.count(":") == 1:
        candidate = candidate.split(":", 1)[0]
    candidate = candidate.rstrip(".")
    if candidate.startswith("www."):
        candidate = candidate[4:]
    return candidate


def _is_public_ip(host: str) -> bool:
    try:
        parsed = ipaddress.ip_address(host)
    except ValueError:
        return False
    return not (
        parsed.is_loopback
        or parsed.is_private
        or parsed.is_link_local
        or parsed.is_multicast
        or parsed.is_reserved
        or parsed.is_unspecified
    )


def is_valid_public_host(value: str | None) -> bool:
    host = normalize_public_host(value)
    if not host or host in RESERVED_PUBLIC_HOSTS:
        return False
    if _is_public_ip(host):
        return True
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    if len(host) > 253 or ".." in host:
        return False
    labels = host.split(".")
    if len(labels) < 2:
        return False
    return all(_HOST_LABEL_RE.fullmatch(label) for label in labels)


def host_matches_scope(host: str | None, domain: str | None) -> bool:
    normalized_host = normalize_public_host(host)
    normalized_domain = normalize_public_host(domain)
    if not normalized_host or not normalized_domain:
        return False
    return normalized_host == normalized_domain or normalized_host.endswith(f".{normalized_domain}")


def domains_overlap(left: str | None, right: str | None) -> bool:
    return host_matches_scope(left, right) or host_matches_scope(right, left)


def _row_value(row: Any, key: str) -> Any:
    if isinstance(row, dict):
        return row.get(key)
    getter = getattr(row, "get", None)
    if callable(getter):
        return getter(key)
    try:
        return row[key]
    except Exception:
        return getattr(row, key, None)


def select_matching_site_row(
    rows: Iterable[Any],
    host: str | None,
    *,
    allow_local_singleton_fallback: bool = False,
) -> Any | None:
    normalized_host = normalize_public_host(host)
    rows_list = list(rows)
    matches: list[tuple[int, Any]] = []
    for row in rows_list:
        domain = normalize_public_host(_row_value(row, "domain"))
        if host_matches_scope(normalized_host, domain):
            matches.append((len(domain), row))
    if matches:
        matches.sort(key=lambda item: item[0], reverse=True)
        strongest_length = matches[0][0]
        strongest = [row for length, row in matches if length == strongest_length]
        if len(strongest) == 1:
            return strongest[0]
        return None
    if allow_local_singleton_fallback and normalized_host in RESERVED_PUBLIC_HOSTS and len(rows_list) == 1:
        return rows_list[0]
    return None


def find_domain_conflict(
    rows: Iterable[Any],
    candidate: str | None,
    *,
    skip_site_id: int | None = None,
) -> Any | None:
    normalized_candidate = normalize_public_host(candidate)
    if not normalized_candidate:
        return None
    for row in rows:
        row_site_id = _row_value(row, "id")
        if skip_site_id is not None and row_site_id is not None and int(row_site_id) == skip_site_id:
            continue
        existing_domain = normalize_public_host(_row_value(row, "domain"))
        if domains_overlap(existing_domain, normalized_candidate):
            return row
    return None
