#!/usr/bin/env python3
"""
Remote redeploy helper for non-git VPS deployments.

What this does:
1) Builds a tar.gz bundle from tracked git files under ai-honeypot-fullstack/.
2) Uploads bundle to remote VPS via SSH/SFTP.
3) Extracts bundle into remote parent dir (preserves remote .env because it is not tracked).
4) Rebuilds/restarts backend + frontend containers.
5) Verifies live /api/health and optional full smoke flow.

Usage (password auth):
  py -3 deploy/scripts/remote_redeploy.py --host 72.61.248.44 --user root --ssh-password "..." --base-url https://cybersentil.online --smoke-user admin --smoke-password "..."

Usage (SSH key auth):
  py -3 deploy/scripts/remote_redeploy.py --host 72.61.248.44 --user root --ssh-key C:/Users/me/.ssh/id_rsa --base-url https://cybersentil.online
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tarfile
import tempfile
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


try:
    import paramiko
except Exception as exc:  # pragma: no cover - runtime dependency guard
    raise SystemExit(
        "paramiko is required for remote deploy. Install with: py -3 -m pip install paramiko"
    ) from exc


def run_local(command: list[str], *, cwd: Path | None = None) -> str:
    proc = subprocess.run(
        command,
        cwd=str(cwd) if cwd else None,
        text=True,
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"Local command failed ({proc.returncode}): {' '.join(command)}\n"
            f"stdout:\n{proc.stdout}\n"
            f"stderr:\n{proc.stderr}"
        )
    return proc.stdout.strip()


def normalize_api_base(base_url: str) -> str:
    clean = str(base_url or "").strip().rstrip("/")
    if not clean:
        raise ValueError("base_url is required.")
    if clean.endswith("/api"):
        return clean
    return clean + "/api"


def create_git_bundle(*, project_root: Path) -> Path:
    repo_root = Path(run_local(["git", "-C", str(project_root), "rev-parse", "--show-toplevel"]))
    relative_project = project_root.relative_to(repo_root).as_posix()

    tmp_dir = Path(tempfile.mkdtemp(prefix="remote-redeploy-"))
    archive_path = tmp_dir / "bundle.tar.gz"

    run_local(
        [
            "git",
            "-C",
            str(repo_root),
            "archive",
            "--format=tar.gz",
            "--output",
            str(archive_path),
            "HEAD",
            relative_project,
        ]
    )
    if not archive_path.exists() or archive_path.stat().st_size == 0:
        raise RuntimeError("Failed to create deployment archive from git.")
    return archive_path


def ssh_connect(
    *,
    host: str,
    port: int,
    user: str,
    password: str,
    key_path: str,
    key_passphrase: str,
) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    kwargs: dict[str, Any] = {
        "hostname": host,
        "port": port,
        "username": user,
        "timeout": 25,
        "banner_timeout": 25,
        "auth_timeout": 25,
    }
    if key_path:
        kwargs["key_filename"] = key_path
        if key_passphrase:
            kwargs["passphrase"] = key_passphrase
    else:
        kwargs["password"] = password

    client.connect(**kwargs)
    return client


def exec_remote(client: paramiko.SSHClient, command: str, *, timeout: int = 1200) -> str:
    stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
    _ = stdin
    out = stdout.read().decode("utf-8", errors="ignore")
    err = stderr.read().decode("utf-8", errors="ignore")
    status = stdout.channel.recv_exit_status()
    if status != 0:
        raise RuntimeError(
            f"Remote command failed ({status}): {command}\nstdout:\n{out}\nstderr:\n{err}"
        )
    return (out + ("\n" + err if err else "")).strip()


def deploy_bundle(
    *,
    client: paramiko.SSHClient,
    local_archive: Path,
    remote_root: str,
) -> None:
    remote_parent = os.path.dirname(remote_root.rstrip("/")) or "/"
    remote_archive = f"/tmp/ai-honeypot-deploy-{int(time.time())}.tar.gz"

    print(f"[deploy] Uploading archive to {remote_archive}")
    sftp = client.open_sftp()
    try:
        sftp.put(str(local_archive), remote_archive)
    finally:
        sftp.close()

    print("[deploy] Extracting archive on remote host")
    exec_remote(client, f"mkdir -p {remote_parent}")
    exec_remote(client, f"tar -xzf {remote_archive} -C {remote_parent}")
    exec_remote(client, f"rm -f {remote_archive}")


def restart_services(*, client: paramiko.SSHClient, remote_root: str) -> None:
    print("[deploy] Rebuilding backend container")
    exec_remote(client, f"cd {remote_root} && docker compose up -d --build backend")

    print("[deploy] Restarting frontend container")
    exec_remote(client, f"cd {remote_root} && docker compose restart frontend")

    print("[deploy] Waiting for startup stabilization")
    time.sleep(4)

    print("[deploy] Container status")
    output = exec_remote(client, f"cd {remote_root} && docker compose ps")
    print(output)


def http_json(
    *,
    method: str,
    url: str,
    body: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 20,
    insecure: bool = False,
) -> tuple[int, dict[str, str], Any]:
    payload = None
    request_headers = dict(headers or {})
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        request_headers.setdefault("Content-Type", "application/json")

    req = Request(url=url, method=method.upper(), data=payload, headers=request_headers)

    context = None
    if insecure:
        import ssl

        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE

    try:
        with urlopen(req, timeout=timeout, context=context) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            status = int(getattr(resp, "status", 200) or 200)
            response_headers = {str(k): str(v) for k, v in resp.headers.items()}
            try:
                parsed = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                parsed = raw
            return status, response_headers, parsed
    except HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="ignore")
        try:
            parsed = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            parsed = raw
        response_headers = {str(k): str(v) for k, v in exc.headers.items()} if exc.headers else {}
        return int(exc.code), response_headers, parsed
    except URLError as exc:
        raise RuntimeError(f"HTTP call failed for {url}: {exc}") from exc


def health_check(*, api_base: str, insecure: bool) -> str:
    print("[verify] Health check")
    status, headers, payload = http_json(method="GET", url=f"{api_base}/health", insecure=insecure)
    if status != 200:
        raise RuntimeError(f"/health returned {status}: {payload}")
    request_id = headers.get("X-Request-ID", "") or headers.get("x-request-id", "")
    if not request_id:
        raise RuntimeError("/health missing X-Request-ID header.")
    print(f"[verify] health=200 request_id={request_id}")
    return request_id


def run_smoke(
    *,
    api_base: str,
    username: str,
    password: str,
    insecure: bool,
    site_name: str,
    site_domain: str,
) -> None:
    print("[smoke] Login")
    status, _, login_payload = http_json(
        method="POST",
        url=f"{api_base}/auth/login",
        body={"username": username, "password": password},
        insecure=insecure,
    )
    if status != 200 or not isinstance(login_payload, dict) or not login_payload.get("token"):
        raise RuntimeError(f"Login failed ({status}): {login_payload}")
    token = str(login_payload["token"])

    auth_headers = {"Authorization": f"Bearer {token}"}

    print("[smoke] Auth profile")
    status, _, me = http_json(method="GET", url=f"{api_base}/auth/me", headers=auth_headers, insecure=insecure)
    if status != 200 or not isinstance(me, dict):
        raise RuntimeError(f"/auth/me failed ({status}): {me}")

    print("[smoke] Site key (create/rotate)")
    status, _, sites_payload = http_json(method="GET", url=f"{api_base}/sites", headers=auth_headers, insecure=insecure)
    if status != 200:
        raise RuntimeError(f"/sites failed ({status}): {sites_payload}")
    sites: list[dict[str, Any]] = []
    if isinstance(sites_payload, list):
        sites = [item for item in sites_payload if isinstance(item, dict)]

    target_site = None
    for item in sites:
        if str(item.get("name", "")) == site_name or str(item.get("domain", "")) == site_domain:
            target_site = item
            break

    api_key = ""
    if target_site is None:
        status, _, created = http_json(
            method="POST",
            url=f"{api_base}/sites",
            headers=auth_headers,
            body={"name": site_name, "domain": site_domain},
            insecure=insecure,
        )
        if status != 200 or not isinstance(created, dict):
            raise RuntimeError(f"Site create failed ({status}): {created}")
        api_key = str(created.get("api_key", "") or "")
    else:
        site_id = int(target_site["id"])
        status, _, rotated = http_json(
            method="POST",
            url=f"{api_base}/sites/{site_id}/rotate-key",
            headers=auth_headers,
            insecure=insecure,
        )
        if status != 200 or not isinstance(rotated, dict):
            raise RuntimeError(f"Site rotate-key failed ({status}): {rotated}")
        api_key = str(rotated.get("api_key", "") or "")

    if not api_key:
        raise RuntimeError("Site API key not returned.")

    print("[smoke] Ingest")
    session_id = f"remote-redeploy-{int(time.time())}"
    status, _, ingest = http_json(
        method="POST",
        url=f"{api_base}/ingest",
        headers={"X-API-Key": api_key},
        body={
            "event_type": "smoke_test",
            "url_path": "/remote-redeploy",
            "http_method": "POST",
            "session_id": session_id,
            "captured_data": {"source": "remote_redeploy.py", "utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
        },
        insecure=insecure,
    )
    if status != 200 or not isinstance(ingest, dict) or str(ingest.get("status", "")) != "accepted":
        raise RuntimeError(f"/ingest failed ({status}): {ingest}")

    print("[smoke] Dashboard")
    status, _, dashboard = http_json(
        method="GET",
        url=f"{api_base}/dashboard/stats",
        headers=auth_headers,
        insecure=insecure,
    )
    if status != 200 or not isinstance(dashboard, dict):
        raise RuntimeError(f"/dashboard/stats failed ({status}): {dashboard}")
    summary = dashboard.get("summary", {})
    total = int(summary.get("total", 0)) if isinstance(summary, dict) else 0
    if total < 1:
        raise RuntimeError("Dashboard total events is 0 after ingest.")

    print("[smoke] Public snapshot")
    status, _, snapshot = http_json(method="GET", url=f"{api_base}/public/telemetry/snapshot", insecure=insecure)
    if status != 200 or not isinstance(snapshot, dict):
        raise RuntimeError(f"/public/telemetry/snapshot failed ({status}): {snapshot}")
    if snapshot.get("summary") is None:
        raise RuntimeError("Public snapshot summary missing.")

    print(f"[smoke] Passed (session_id={session_id})")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Remote redeploy helper for non-git VPS targets.")
    parser.add_argument("--host", required=True, help="Remote VPS hostname or IP.")
    parser.add_argument("--port", type=int, default=22, help="Remote SSH port (default: 22).")
    parser.add_argument("--user", default="root", help="Remote SSH username (default: root).")
    parser.add_argument(
        "--ssh-password",
        default="",
        help="Remote SSH password. If omitted, REMOTE_DEPLOY_SSH_PASSWORD is used.",
    )
    parser.add_argument("--ssh-key", default="", help="Path to SSH private key file.")
    parser.add_argument("--ssh-key-passphrase", default="", help="Passphrase for SSH private key, if required.")
    parser.add_argument(
        "--remote-root",
        default="/root/ai-honeypot-fullstack",
        help="Remote deployment directory containing docker-compose.yml.",
    )
    parser.add_argument("--base-url", required=True, help="Public URL (for example: https://cybersentil.online).")
    parser.add_argument("--insecure", action="store_true", help="Disable TLS certificate verification for HTTP checks.")
    parser.add_argument("--skip-smoke", action="store_true", help="Skip login/ingest smoke checks.")
    parser.add_argument("--smoke-user", default="", help="Username for API smoke checks (required unless --skip-smoke).")
    parser.add_argument(
        "--smoke-password",
        default="",
        help="Password for API smoke checks. If omitted, REMOTE_DEPLOY_SMOKE_PASSWORD is used.",
    )
    parser.add_argument("--site-name", default="smoke-site", help="Site name used for smoke create/rotate.")
    parser.add_argument("--site-domain", default="smoke.example.com", help="Site domain used for smoke create/rotate.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.ssh_password:
        args.ssh_password = os.getenv("REMOTE_DEPLOY_SSH_PASSWORD", "").strip()
    if not args.smoke_password:
        args.smoke_password = os.getenv("REMOTE_DEPLOY_SMOKE_PASSWORD", "").strip()

    if not args.ssh_key and not args.ssh_password:
        raise SystemExit("Provide either --ssh-key or --ssh-password for SSH authentication.")
    if not args.skip_smoke and (not args.smoke_user or not args.smoke_password):
        raise SystemExit("For smoke checks, provide --smoke-user and --smoke-password (or use --skip-smoke).")

    script_path = Path(__file__).resolve()
    project_root = script_path.parents[2]
    api_base = normalize_api_base(args.base_url)
    parsed_base = urlparse(api_base)
    if not parsed_base.scheme or not parsed_base.netloc:
        raise SystemExit(f"Invalid --base-url: {args.base_url}")

    print("[local] Building deployment archive from tracked git files")
    archive_path = create_git_bundle(project_root=project_root)
    print(f"[local] Archive ready: {archive_path}")

    client = None
    try:
        print(f"[ssh] Connecting to {args.user}@{args.host}:{args.port}")
        client = ssh_connect(
            host=args.host,
            port=args.port,
            user=args.user,
            password=args.ssh_password,
            key_path=args.ssh_key,
            key_passphrase=args.ssh_key_passphrase,
        )

        deploy_bundle(client=client, local_archive=archive_path, remote_root=args.remote_root)
        restart_services(client=client, remote_root=args.remote_root)

    finally:
        try:
            if client is not None:
                client.close()
        finally:
            if archive_path.exists():
                archive_path.unlink(missing_ok=True)
            temp_parent = archive_path.parent
            if temp_parent.exists():
                try:
                    temp_parent.rmdir()
                except OSError:
                    pass

    health_check(api_base=api_base, insecure=args.insecure)
    if not args.skip_smoke:
        run_smoke(
            api_base=api_base,
            username=args.smoke_user,
            password=args.smoke_password,
            insecure=args.insecure,
            site_name=args.site_name,
            site_domain=args.site_domain,
        )
    print("[done] Remote redeploy completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
