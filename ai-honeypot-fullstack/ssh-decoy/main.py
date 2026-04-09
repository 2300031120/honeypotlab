import asyncio
import json
import os
import posixpath
import shlex
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import asyncssh
from fastapi import FastAPI


app = FastAPI(title="CyberSentil SSH Decoy")

BACKEND_INTERNAL_URL = os.getenv("BACKEND_INTERNAL_URL", "http://backend:5000").strip().rstrip("/")
TERMINAL_SANDBOX_URL = os.getenv("TERMINAL_SANDBOX_URL", "http://terminal-sandbox:5100").strip().rstrip("/")
PROTOCOL_SHARED_SECRET = os.getenv("PROTOCOL_SHARED_SECRET", "").strip()
SSH_DECOY_LISTEN_HOST = os.getenv("SSH_DECOY_LISTEN_HOST", "0.0.0.0").strip() or "0.0.0.0"
SSH_DECOY_PORT = int(os.getenv("SSH_DECOY_PORT", "2222"))
SSH_DECOY_HOST_KEY_PATH = Path(os.getenv("SSH_DECOY_HOST_KEY_PATH", "/data/ssh_host_ed25519_key")).resolve()
SSH_DECOY_ACCEPT_ANY_PASSWORD = os.getenv("SSH_DECOY_ACCEPT_ANY_PASSWORD", "false").strip().lower() in {"1", "true", "yes", "on"}
PROTOCOL_SSH_AUTH_TRAP_ENABLED = os.getenv("PROTOCOL_SSH_AUTH_TRAP_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
PROTOCOL_SSH_TRAP_CREDENTIALS = os.getenv("PROTOCOL_SSH_TRAP_CREDENTIALS", "").strip()
SSH_DECOY_SITE_ID = int(os.getenv("SSH_DECOY_SITE_ID", "0").strip() or "0") or None
HTTP_TIMEOUT_SEC = max(1, int(os.getenv("SSH_DECOY_HTTP_TIMEOUT_SEC", "4")))
SSH_SERVER_VERSION = os.getenv("SSH_DECOY_SERVER_VERSION", "OpenSSH_8.9p1 Ubuntu-3ubuntu0.6").strip()
STARTED_AT = datetime.now(timezone.utc).isoformat()

DEFAULT_HOSTS = ["web-ops-01", "crm-edge-02", "finance-gateway-01", "db-admin-03"]
DEFAULT_FILES = {
    "/etc/hostname": "web-ops-01\n",
    "/etc/os-release": 'NAME="Ubuntu"\nVERSION="22.04.3 LTS (Jammy Jellyfish)"\nID=ubuntu\n',
    "/etc/passwd": "root:x:0:0:root:/root:/bin/bash\nadmin:x:1000:1000:admin:/home/admin:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\n",
    "/var/www/html/.env": "APP_ENV=production\nDB_HOST=10.0.4.12\nDB_USER=svc_portal\nDB_PASSWORD=H0neyStack#2026\n",
    "/var/www/html/index.php": "<?php\n$portal = 'Secure Operations Portal';\necho $portal;\n",
}
DEFAULT_DIRECTORIES = {
    "/",
    "/etc",
    "/home",
    "/home/admin",
    "/home/admin/.ssh",
    "/tmp",
    "/var",
    "/var/log",
    "/var/www",
    "/var/www/html",
}
EXIT_COMMANDS = {"exit", "logout", "quit"}
ACTIVE_SESSIONS: dict[str, dict[str, Any]] = {}
LAST_ERROR: str | None = None


def _hostname_for_session(session_id: str) -> str:
    index = int(uuid.uuid5(uuid.NAMESPACE_DNS, session_id).hex[:2], 16) % len(DEFAULT_HOSTS)
    return DEFAULT_HOSTS[index]


def _prompt(username: str, hostname: str, cwd: str) -> str:
    home = "/home/admin"
    display = "~" if cwd == home else cwd.replace(f"{home}/", "~/", 1) if cwd.startswith(f"{home}/") else cwd
    return f"{username}@{hostname}:{display}$"


def _wire_text(value: str) -> str:
    return value.replace("\r\n", "\n").replace("\n", "\r\n")


def _trap_credentials() -> dict[str, set[str]]:
    parsed: dict[str, set[str]] = {}
    raw = PROTOCOL_SSH_TRAP_CREDENTIALS or "admin:Winter2026!,deploy:Deploy@2026!,reporting:Report#2026"
    for item in raw.split(","):
        if ":" not in item:
            continue
        username, password = item.split(":", 1)
        username = username.strip()
        password = password.strip()
        if not username or not password:
            continue
        parsed.setdefault(username, set()).add(password)
    return parsed


TRAP_CREDENTIALS = _trap_credentials()


def _ensure_host_key() -> str:
    SSH_DECOY_HOST_KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
    if SSH_DECOY_HOST_KEY_PATH.exists():
        return str(SSH_DECOY_HOST_KEY_PATH)
    key = asyncssh.generate_private_key("ssh-ed25519")
    key.write_private_key(str(SSH_DECOY_HOST_KEY_PATH))
    try:
        os.chmod(SSH_DECOY_HOST_KEY_PATH, 0o600)
    except OSError:
        pass
    return str(SSH_DECOY_HOST_KEY_PATH)


def _accept_credentials(username: str, password: str) -> bool:
    if SSH_DECOY_ACCEPT_ANY_PASSWORD:
        return True
    return password in TRAP_CREDENTIALS.get(username, set())


def _post_json(url: str, payload: dict[str, Any], headers: dict[str, str]) -> dict[str, Any] | None:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SEC) as response:
        return json.loads(response.read().decode("utf-8"))


async def _emit_protocol_event(payload: dict[str, Any]) -> None:
    global LAST_ERROR
    if not BACKEND_INTERNAL_URL or not PROTOCOL_SHARED_SECRET:
        return
    try:
        await asyncio.to_thread(
            _post_json,
            f"{BACKEND_INTERNAL_URL}/internal/protocols/event",
            payload,
            {"X-Protocol-Secret": PROTOCOL_SHARED_SECRET},
        )
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError, json.JSONDecodeError) as exc:
        LAST_ERROR = f"backend ingest failed: {exc}"


def _normalize_path(cwd: str, raw_path: str | None) -> str:
    candidate = (raw_path or "").strip() or cwd
    if candidate == "~":
        candidate = "/home/admin"
    elif candidate.startswith("~/"):
        candidate = posixpath.join("/home/admin", candidate[2:])
    elif not candidate.startswith("/"):
        candidate = posixpath.join(cwd, candidate)
    normalized = posixpath.normpath(candidate)
    return normalized if normalized.startswith("/") else f"/{normalized}"


def _directory_entries(path: str) -> list[str]:
    prefix = "/" if path == "/" else f"{path.rstrip('/')}/"
    items: set[str] = set()
    for directory in DEFAULT_DIRECTORIES:
        if directory == path or not directory.startswith(prefix):
            continue
        child = directory[len(prefix) :].split("/", 1)[0]
        if child:
            items.add(child)
    for file_path in DEFAULT_FILES:
        if not file_path.startswith(prefix):
            continue
        child = file_path[len(prefix) :].split("/", 1)[0]
        if child:
            items.add(child)
    return sorted(items)


def _fallback_exec(session: dict[str, Any], cmd: str) -> dict[str, Any]:
    stripped = cmd.strip()
    username = str(session["username"])
    hostname = str(session["hostname"])
    cwd = str(session.get("cwd") or "/home/admin")
    if not stripped:
        return {"output": "", "status": "ok", "cwd": cwd, "prompt": _prompt(username, hostname, cwd), "execution_mode": "emulated"}
    if stripped in EXIT_COMMANDS:
        return {"output": "logout", "status": "ok", "cwd": cwd, "prompt": _prompt(username, hostname, cwd), "execution_mode": "emulated"}
    try:
        parts = shlex.split(stripped)
    except ValueError:
        return {"output": "bash: syntax error near unexpected token", "status": "error", "cwd": cwd, "prompt": _prompt(username, hostname, cwd), "execution_mode": "emulated"}
    binary = parts[0]
    args = parts[1:]
    if binary == "pwd":
        output = cwd
    elif binary == "whoami":
        output = username
    elif binary == "hostname":
        output = hostname
    elif binary == "id":
        output = "uid=1000(admin) gid=1000(admin) groups=1000(admin),27(sudo),33(www-data)"
    elif binary == "uname":
        output = f"Linux {hostname} 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux" if "-a" in args else "Linux"
    elif binary == "cd":
        target = _normalize_path(cwd, args[0] if args else "/home/admin")
        if target not in DEFAULT_DIRECTORIES:
            return {
                "output": f"bash: cd: {args[0] if args else target}: No such file or directory",
                "status": "error",
                "cwd": cwd,
                "prompt": _prompt(username, hostname, cwd),
                "execution_mode": "emulated",
            }
        session["cwd"] = target
        cwd = target
        output = ""
    elif binary == "ls":
        target = _normalize_path(cwd, next((item for item in args if not item.startswith("-")), cwd))
        if target in DEFAULT_FILES:
            output = posixpath.basename(target)
        elif target in DEFAULT_DIRECTORIES:
            output = "\n".join(_directory_entries(target))
        else:
            return {
                "output": f"ls: cannot access '{target}': No such file or directory",
                "status": "error",
                "cwd": cwd,
                "prompt": _prompt(username, hostname, cwd),
                "execution_mode": "emulated",
            }
    elif binary == "cat":
        if not args:
            return {"output": "cat: missing operand", "status": "error", "cwd": cwd, "prompt": _prompt(username, hostname, cwd), "execution_mode": "emulated"}
        target = _normalize_path(cwd, args[0])
        if target not in DEFAULT_FILES:
            return {
                "output": f"cat: {args[0]}: No such file or directory",
                "status": "error",
                "cwd": cwd,
                "prompt": _prompt(username, hostname, cwd),
                "execution_mode": "emulated",
            }
        output = DEFAULT_FILES[target].rstrip("\n")
    elif binary == "history":
        output = "\n".join(f"{index + 1:>4}  {entry}" for index, entry in enumerate(session.get("history", [])))
    elif binary == "curl":
        output = "<html><title>Secure Operations Portal</title><body>login-required=true</body></html>"
    elif binary == "mysql":
        return {
            "output": "ERROR 1045 (28000): Access denied for user 'reporting'@'localhost' (using password: YES)",
            "status": "blocked",
            "cwd": cwd,
            "prompt": _prompt(username, hostname, cwd),
            "execution_mode": "emulated",
        }
    else:
        return {
            "output": f"bash: {binary}: command not found",
            "status": "error",
            "cwd": cwd,
            "prompt": _prompt(username, hostname, cwd),
            "execution_mode": "emulated",
        }
    return {"output": output, "status": "ok", "cwd": cwd, "prompt": _prompt(username, hostname, cwd), "execution_mode": "emulated"}


async def _sandbox_exec(session: dict[str, Any], cmd: str) -> dict[str, Any] | None:
    if not TERMINAL_SANDBOX_URL:
        return None
    payload = {"session_id": session["session_id"], "cmd": cmd}
    try:
        result = await asyncio.to_thread(_post_json, f"{TERMINAL_SANDBOX_URL}/exec", payload, {})
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError, json.JSONDecodeError):
        return None
    if not isinstance(result, dict):
        return None
    return {
        "output": str(result.get("output") or ""),
        "status": str(result.get("status") or "ok"),
        "cwd": str(result.get("cwd") or session.get("cwd") or "/home/admin"),
        "prompt": str(result.get("prompt") or _prompt(str(session["username"]), str(session["hostname"]), str(session.get("cwd") or "/home/admin"))),
        "execution_mode": str(result.get("execution_mode") or "real"),
    }


async def _execute_command(session: dict[str, Any], cmd: str) -> dict[str, Any]:
    result = await _sandbox_exec(session, cmd)
    if result is None:
        result = _fallback_exec(session, cmd)
    session["cwd"] = result["cwd"]
    session["last_seen"] = datetime.now(timezone.utc).isoformat()
    if cmd:
        history = list(session.get("history") or [])
        history.append(cmd)
        session["history"] = history[-60:]
    return result


async def _write_output(stream, text: str) -> None:
    if not text:
        return
    stream.write(_wire_text(text))
    drain = getattr(stream, "drain", None)
    if callable(drain):
        await drain()


async def _emit_shell_event(session: dict[str, Any], cmd: str, result: dict[str, Any]) -> None:
    await _emit_protocol_event(
        {
            "protocol": "ssh",
            "site_id": SSH_DECOY_SITE_ID,
            "session_id": session["session_id"],
            "event_type": "ssh_command",
            "phase": "interaction",
            "ip": session["ip"],
            "geo": "SSH Decoy",
            "username": session["username"],
            "cmd": cmd,
            "output": result["output"],
            "prompt": result["prompt"],
            "cwd": result["cwd"],
            "status": result["status"],
            "execution_mode": result["execution_mode"],
        }
    )


async def _emit_session_open(session: dict[str, Any]) -> None:
    if session.get("open_emitted"):
        return
    session["open_emitted"] = True
    await _emit_protocol_event(
        {
            "protocol": "ssh",
            "site_id": SSH_DECOY_SITE_ID,
            "session_id": session["session_id"],
            "event_type": "ssh_session_open",
            "phase": "connect",
            "ip": session["ip"],
            "geo": "SSH Decoy",
            "username": session["username"],
            "status": "connected",
            "accepted": True,
        }
    )


def _schedule_session_close(session_id: str) -> None:
    session = ACTIVE_SESSIONS.pop(session_id, None)
    if not session:
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(
        _emit_protocol_event(
            {
                "protocol": "ssh",
                "site_id": SSH_DECOY_SITE_ID,
                "session_id": session["session_id"],
                "event_type": "ssh_session_close",
                "phase": "disconnect",
                "ip": session["ip"],
                "geo": "SSH Decoy",
                "username": session["username"],
                "status": "closed",
                "accepted": True,
            }
        )
    )


async def _handle_client_process(process: asyncssh.SSHServerProcess) -> None:
    session_id = str(process.get_extra_info("session_id") or f"ssh-{uuid.uuid4().hex[:12]}")
    session = ACTIVE_SESSIONS.get(session_id)
    if session is None:
        peername = process.get_extra_info("peername")
        ip = peername[0] if isinstance(peername, tuple) and peername else "unknown"
        session = {
            "session_id": session_id,
            "username": str(process.get_extra_info("username") or "admin"),
            "ip": ip,
            "hostname": _hostname_for_session(session_id),
            "cwd": "/home/admin",
            "history": [],
            "open_emitted": False,
            "last_seen": datetime.now(timezone.utc).isoformat(),
        }
        ACTIVE_SESSIONS[session_id] = session

    await _emit_session_open(session)
    command = str(process.command or "").strip()
    if command:
        result = await _execute_command(session, command)
        await _emit_shell_event(session, command, result)
        if result["output"]:
            await _write_output(process.stdout, f"{result['output']}\n")
        process.exit(0 if result["status"] == "ok" else 1)
        return

    banner = [
        "Ubuntu 22.04.3 LTS",
        f"Last login: Sat Mar 28 09:14:22 2026 from {session['ip']}",
        "",
    ]
    await _write_output(process.stdout, "\n".join(banner) + "\n")
    await _write_output(process.stdout, f"{_prompt(str(session['username']), str(session['hostname']), str(session['cwd']))} ")

    while True:
        line = await process.stdin.readline()
        if line == "":
            break
        cmd = line.rstrip("\r\n")
        result = await _execute_command(session, cmd)
        if cmd:
            await _emit_shell_event(session, cmd, result)
        if result["output"]:
            await _write_output(process.stdout, f"{result['output']}\n")
        if cmd.strip().lower() in EXIT_COMMANDS:
            process.exit(0)
            return
        await _write_output(process.stdout, f"{result['prompt']} ")


class SSHTrapServer(asyncssh.SSHServer):
    def __init__(self) -> None:
        self._conn: asyncssh.SSHServerConnection | None = None
        self._session_id = f"ssh-{uuid.uuid4().hex[:12]}"
        self._peer_ip = "unknown"

    def connection_made(self, conn: asyncssh.SSHServerConnection) -> None:
        self._conn = conn
        peername = conn.get_extra_info("peername")
        if isinstance(peername, tuple) and peername:
            self._peer_ip = str(peername[0])
        conn.set_extra_info(session_id=self._session_id, peer_ip=self._peer_ip)

    def connection_lost(self, exc: Exception | None) -> None:
        _schedule_session_close(self._session_id)

    def begin_auth(self, username: str) -> bool:
        return True

    def password_auth_supported(self) -> bool:
        return True

    async def validate_password(self, username: str, password: str) -> bool:
        accepted = _accept_credentials(username, password)
        await _emit_protocol_event(
            {
                "protocol": "ssh",
                "site_id": SSH_DECOY_SITE_ID,
                "session_id": self._session_id,
                "event_type": "ssh_auth",
                "phase": "auth",
                "ip": self._peer_ip,
                "geo": "SSH Decoy",
                "username": username,
                "password": password,
                "accepted": accepted,
                "status": "accepted" if accepted else "rejected",
            }
        )
        if accepted:
            ACTIVE_SESSIONS[self._session_id] = {
                "session_id": self._session_id,
                "username": username,
                "ip": self._peer_ip,
                "hostname": _hostname_for_session(self._session_id),
                "cwd": "/home/admin",
                "history": [],
                "open_emitted": False,
                "last_seen": datetime.now(timezone.utc).isoformat(),
            }
            if self._conn is not None:
                self._conn.set_extra_info(session_id=self._session_id, peer_ip=self._peer_ip, username=username)
        return accepted


@app.on_event("startup")
async def startup() -> None:
    global LAST_ERROR
    if not PROTOCOL_SSH_AUTH_TRAP_ENABLED:
        return
    try:
        host_key = _ensure_host_key()
        app.state.ssh_server = await asyncssh.create_server(
            SSHTrapServer,
            SSH_DECOY_LISTEN_HOST,
            SSH_DECOY_PORT,
            server_host_keys=[host_key],
            process_factory=_handle_client_process,
            encoding="utf-8",
            line_editor=True,
            server_version=SSH_SERVER_VERSION,
        )
    except Exception as exc:
        LAST_ERROR = str(exc)
        app.state.ssh_server = None


@app.on_event("shutdown")
async def shutdown() -> None:
    server = getattr(app.state, "ssh_server", None)
    if server is not None:
        server.close()
        await server.wait_closed()


@app.get("/health")
async def health() -> dict[str, Any]:
    server = getattr(app.state, "ssh_server", None)
    enabled = PROTOCOL_SSH_AUTH_TRAP_ENABLED
    healthy = bool(server is not None) if enabled else False
    status = "disabled" if not enabled else "healthy" if healthy else "degraded"
    return {
        "status": status,
        "enabled": enabled,
        "healthy": healthy,
        "reachable": healthy,
        "engine": "asyncssh",
        "host": SSH_DECOY_LISTEN_HOST,
        "port": SSH_DECOY_PORT,
        "site_id": SSH_DECOY_SITE_ID,
        "active_sessions": len(ACTIVE_SESSIONS),
        "backend_configured": bool(BACKEND_INTERNAL_URL and PROTOCOL_SHARED_SECRET),
        "sandbox_configured": bool(TERMINAL_SANDBOX_URL),
        "credentials_loaded": sum(len(passwords) for passwords in TRAP_CREDENTIALS.values()),
        "started_at": STARTED_AT,
        "last_error": LAST_ERROR,
    }
