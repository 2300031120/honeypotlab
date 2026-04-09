#!/usr/bin/env python3
"""
Sync CyberSentil blocked IP exports into Cloudflare IP Access Rules.

Examples:
  py -3 deploy/scripts/sync_cloudflare_edge.py --base-url https://security.example.com --operator-token <jwt> --zone-id <zone_id>
  py -3 deploy/scripts/sync_cloudflare_edge.py --export-file deploy/artifacts/cybersentinel-blocked-ips.cloudflare.json --zone-id <zone_id> --dry-run
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import os
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from export_edge_blocks import build_export_url, fetch_export, first_defined


DEFAULT_API_BASE = "https://api.cloudflare.com/client/v4"
DEFAULT_NOTES_PREFIX = "CyberSentil managed edge block"
ALLOWED_CIDR_PREFIXES = {
    4: {16, 24},
    6: {32, 48, 64},
}


def cloudflare_scope_path(zone_id: str, account_id: str) -> str:
    zone = str(zone_id or "").strip()
    account = str(account_id or "").strip()
    if bool(zone) == bool(account):
        raise ValueError("Provide exactly one of --zone-id or --account-id.")
    if zone:
        return f"zones/{zone}"
    return f"accounts/{account}"


def canonicalize_cloudflare_value(target: str, value: str) -> str:
    raw_value = str(value or "").strip()
    target_name = str(target or "").strip().lower()
    if not raw_value:
        raise ValueError("Missing Cloudflare access rule value.")
    if target_name == "ip":
        return str(ipaddress.ip_address(raw_value))
    if target_name == "ip6":
        address = ipaddress.ip_address(raw_value)
        if address.version != 6:
            raise ValueError(f"Expected IPv6 address, got {raw_value!r}")
        return str(address)
    if target_name == "ip_range":
        network = ipaddress.ip_network(raw_value, strict=False)
        return str(network)
    raise ValueError(f"Unsupported Cloudflare target {target!r}")


def detect_cloudflare_target(raw_value: str) -> tuple[str, str]:
    candidate = str(raw_value or "").strip()
    if not candidate:
        raise ValueError("Blocked IP value is empty.")
    if "/" in candidate:
        network = ipaddress.ip_network(candidate, strict=False)
        allowed_prefixes = ALLOWED_CIDR_PREFIXES.get(network.version, set())
        if network.prefixlen not in allowed_prefixes:
            allowed = ", ".join(f"/{prefix}" for prefix in sorted(allowed_prefixes))
            raise ValueError(
                f"Cloudflare IP access rules only support {allowed} for IPv{network.version} ranges; got /{network.prefixlen}"
            )
        return "ip_range", str(network)
    address = ipaddress.ip_address(candidate)
    return ("ip6", str(address)) if address.version == 6 else ("ip", str(address))


def normalize_note_fragment(value: str, *, limit: int = 180) -> str:
    cleaned = " ".join(str(value or "").split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 3].rstrip() + "..."


def build_managed_note(prefix: str, entry: dict[str, str], source_label: str) -> str:
    parts = [prefix]
    if source_label:
        parts.append(f"source={source_label}")
    parts.append(f"value={entry['value']}")
    comment = normalize_note_fragment(entry.get("comment", ""))
    if comment:
        parts.append(f"reason={comment}")
    note = " | ".join(parts)
    return note[:500]


def load_export_payload(export_file: str, base_url: str, operator_token: str, api_prefix: str, timeout: int) -> bytes:
    export_path = str(export_file or "").strip()
    if export_path:
        return Path(export_path).read_bytes()
    export_url = build_export_url(base_url, api_prefix, "cloudflare-json")
    return fetch_export(export_url, operator_token, timeout)


def parse_cloudflare_export(payload: bytes) -> tuple[dict[str, dict[str, str]], list[str], dict[str, Any]]:
    try:
        raw = json.loads(payload.decode("utf-8"))
    except Exception as exc:
        raise ValueError(f"Export payload is not valid JSON: {exc}") from exc
    if not isinstance(raw, dict):
        raise ValueError("Export payload must be a JSON object.")
    items = raw.get("items")
    if not isinstance(items, list):
        raise ValueError("Export payload is missing the items array.")

    desired: dict[str, dict[str, str]] = {}
    skipped: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            skipped.append("Ignored non-object item in export payload.")
            continue
        raw_value = str(item.get("ip") or "").strip()
        if not raw_value:
            skipped.append("Ignored export item without an ip value.")
            continue
        try:
            target, canonical_value = detect_cloudflare_target(raw_value)
        except ValueError as exc:
            skipped.append(f"{raw_value}: {exc}")
            continue
        desired[canonical_value] = {
            "target": target,
            "value": canonical_value,
            "comment": str(item.get("comment") or "").strip(),
            "created_at": str(item.get("created_at") or "").strip(),
        }
    invalid_entries = raw.get("invalid_entries")
    if isinstance(invalid_entries, list):
        for invalid in invalid_entries:
            label = str(invalid or "").strip()
            if label:
                skipped.append(f"invalid_export:{label}")
    return desired, skipped, raw


def read_response_json(response) -> dict[str, Any]:
    body = response.read()
    if not body:
        return {}
    try:
        return json.loads(body.decode("utf-8"))
    except Exception as exc:
        raise RuntimeError(f"Cloudflare API returned non-JSON data: {exc}") from exc


def format_cloudflare_errors(payload: dict[str, Any]) -> str:
    errors = payload.get("errors")
    if not isinstance(errors, list) or not errors:
        return "unknown Cloudflare API error"
    messages: list[str] = []
    for error in errors:
        if isinstance(error, dict):
            code = error.get("code")
            message = str(error.get("message") or "unknown error").strip()
            if code:
                messages.append(f"{code}: {message}")
            else:
                messages.append(message)
    return "; ".join(messages) or "unknown Cloudflare API error"


def cloudflare_api_request(
    method: str,
    url: str,
    api_token: str,
    timeout: int,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Accept": "application/json",
    }
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")
    request = Request(url, method=method.upper(), headers=headers, data=data)
    try:
        with urlopen(request, timeout=timeout) as response:
            response_payload = read_response_json(response)
    except HTTPError as exc:
        try:
            error_payload = read_response_json(exc)
            message = format_cloudflare_errors(error_payload)
        except Exception:
            message = exc.reason or str(exc)
        raise RuntimeError(f"Cloudflare API {method.upper()} {url} failed: {message}") from exc
    except URLError as exc:
        raise RuntimeError(f"Cloudflare API {method.upper()} {url} failed: {exc.reason}") from exc

    if response_payload and response_payload.get("success") is False:
        raise RuntimeError(f"Cloudflare API {method.upper()} {url} failed: {format_cloudflare_errors(response_payload)}")
    return response_payload


def list_managed_rules(scope_path: str, api_base: str, api_token: str, notes_prefix: str, timeout: int) -> dict[str, list[dict[str, Any]]]:
    base_endpoint = f"{api_base.rstrip('/')}/{scope_path}/firewall/access_rules/rules"
    page = 1
    per_page = 100
    collected: dict[str, list[dict[str, Any]]] = {}
    while True:
        query = urlencode(
            {
                "mode": "block",
                "notes": notes_prefix,
                "page": page,
                "per_page": per_page,
            }
        )
        response = cloudflare_api_request("GET", f"{base_endpoint}?{query}", api_token, timeout)
        rules = response.get("result")
        if not isinstance(rules, list):
            raise RuntimeError("Cloudflare list response is missing result array.")
        for rule in rules:
            if not isinstance(rule, dict):
                continue
            notes = str(rule.get("notes") or "")
            if notes_prefix.lower() not in notes.lower():
                continue
            config = rule.get("configuration")
            if not isinstance(config, dict):
                continue
            try:
                canonical_value = canonicalize_cloudflare_value(config.get("target", ""), config.get("value", ""))
            except ValueError:
                continue
            collected.setdefault(canonical_value, []).append(rule)
        if len(rules) < per_page:
            break
        page += 1
    return collected


def create_access_rule(scope_path: str, api_base: str, api_token: str, timeout: int, entry: dict[str, str], note: str) -> str:
    endpoint = f"{api_base.rstrip('/')}/{scope_path}/firewall/access_rules/rules"
    response = cloudflare_api_request(
        "POST",
        endpoint,
        api_token,
        timeout,
        payload={
            "mode": "block",
            "configuration": {
                "target": entry["target"],
                "value": entry["value"],
            },
            "notes": note,
        },
    )
    result = response.get("result") or {}
    return str(result.get("id") or "").strip()


def delete_access_rule(scope_path: str, api_base: str, api_token: str, timeout: int, rule_id: str) -> None:
    endpoint = f"{api_base.rstrip('/')}/{scope_path}/firewall/access_rules/rules/{rule_id}"
    cloudflare_api_request("DELETE", endpoint, api_token, timeout)


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync CyberSentil blocked IPs into Cloudflare IP Access Rules.")
    parser.add_argument("--base-url", default=os.environ.get("CYBERSENTINEL_BASE_URL", ""), help="Public CyberSentil base URL.")
    parser.add_argument("--operator-token", default=os.environ.get("CYBERSENTINEL_OPERATOR_TOKEN", ""), help="CyberSentil operator bearer token.")
    parser.add_argument("--api-prefix", default=os.environ.get("CYBERSENTINEL_API_PREFIX", "/api"), help="CyberSentil API prefix.")
    parser.add_argument("--export-file", default="", help="Optional path to a previously exported cloudflare-json file.")
    parser.add_argument("--cloudflare-api-token", default=os.environ.get("CLOUDFLARE_API_TOKEN", ""), help="Cloudflare API token with Access Rules write permission.")
    parser.add_argument("--zone-id", default=os.environ.get("CLOUDFLARE_ZONE_ID", ""), help="Cloudflare Zone ID.")
    parser.add_argument("--account-id", default=os.environ.get("CLOUDFLARE_ACCOUNT_ID", ""), help="Cloudflare Account ID. Use instead of zone-id.")
    parser.add_argument("--cloudflare-api-base", default=os.environ.get("CLOUDFLARE_EDGE_BLOCK_API_BASE", DEFAULT_API_BASE), help="Cloudflare API base URL.")
    parser.add_argument("--notes-prefix", default=os.environ.get("CLOUDFLARE_EDGE_BLOCK_NOTES_PREFIX", DEFAULT_NOTES_PREFIX), help="Notes prefix used to identify managed Cloudflare rules.")
    parser.add_argument("--timeout", type=int, default=20, help="HTTP timeout in seconds.")
    parser.add_argument("--dry-run", action="store_true", help="Show planned create/delete operations without changing Cloudflare.")
    args = parser.parse_args()

    export_file = first_defined(args.export_file)
    base_url = first_defined(args.base_url)
    operator_token = first_defined(args.operator_token)
    cloudflare_token = first_defined(args.cloudflare_api_token)
    notes_prefix = first_defined(args.notes_prefix)
    source_label = urlparse(base_url).netloc if base_url else "file-import"

    if not export_file and not base_url:
        print("Missing --base-url or --export-file.", file=sys.stderr)
        return 1
    if not export_file and not operator_token:
        print("Missing --operator-token or CYBERSENTINEL_OPERATOR_TOKEN.", file=sys.stderr)
        return 1
    if not cloudflare_token:
        print("Missing --cloudflare-api-token or CLOUDFLARE_API_TOKEN.", file=sys.stderr)
        return 1
    if not notes_prefix:
        print("Missing --notes-prefix or CLOUDFLARE_EDGE_BLOCK_NOTES_PREFIX.", file=sys.stderr)
        return 1

    try:
        scope_path = cloudflare_scope_path(args.zone_id, args.account_id)
        export_payload = load_export_payload(export_file, base_url, operator_token, args.api_prefix, args.timeout)
        desired, skipped_entries, export_meta = parse_cloudflare_export(export_payload)
        existing = list_managed_rules(scope_path, args.cloudflare_api_base, cloudflare_token, notes_prefix, args.timeout)
    except Exception as exc:
        print(f"Sync failed during setup: {exc}", file=sys.stderr)
        return 1

    create_plan: list[dict[str, str]] = []
    delete_plan: list[dict[str, str]] = []
    preserved_count = 0

    for value, entry in desired.items():
        rules = existing.get(value, [])
        if not rules:
            create_plan.append(entry)
            continue
        preserved_count += 1
        for duplicate_rule in rules[1:]:
            rule_id = str(duplicate_rule.get("id") or "").strip()
            if rule_id:
                delete_plan.append({"id": rule_id, "value": value})

    for value, rules in existing.items():
        if value in desired:
            continue
        for rule in rules:
            rule_id = str(rule.get("id") or "").strip()
            if rule_id:
                delete_plan.append({"id": rule_id, "value": value})

    print(f"Cloudflare scope: {scope_path}")
    print(f"Desired blocked values: {len(desired)}")
    print(f"Existing managed rules: {sum(len(rules) for rules in existing.values())}")
    print(f"Rules preserved: {preserved_count}")
    print(f"Rules to create: {len(create_plan)}")
    print(f"Rules to delete: {len(delete_plan)}")
    if skipped_entries:
        print("Skipped entries:")
        for item in skipped_entries:
            print(f"  - {item}")

    if args.dry_run:
        if create_plan:
            print("Planned creates:")
            for entry in create_plan[:20]:
                print(f"  + {entry['value']} ({entry['target']})")
            if len(create_plan) > 20:
                print(f"  ... {len(create_plan) - 20} more")
        if delete_plan:
            print("Planned deletes:")
            for entry in delete_plan[:20]:
                print(f"  - {entry['value']} [{entry['id']}]")
            if len(delete_plan) > 20:
                print(f"  ... {len(delete_plan) - 20} more")
        return 0

    created_count = 0
    deleted_count = 0
    try:
        for entry in create_plan:
            note = build_managed_note(notes_prefix, entry, source_label)
            create_access_rule(scope_path, args.cloudflare_api_base, cloudflare_token, args.timeout, entry, note)
            created_count += 1
        for entry in delete_plan:
            delete_access_rule(scope_path, args.cloudflare_api_base, cloudflare_token, args.timeout, entry["id"])
            deleted_count += 1
    except Exception as exc:
        print(f"Sync failed while applying Cloudflare changes: {exc}", file=sys.stderr)
        return 1

    generated_at = str(export_meta.get("generated_at") or "").strip()
    print("Cloudflare sync completed.")
    if generated_at:
        print(f"Export generated_at: {generated_at}")
    print(f"Created: {created_count}")
    print(f"Deleted: {deleted_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
