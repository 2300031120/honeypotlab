import hashlib
import json
import os
import re
import shlex
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


app = FastAPI(title="CyberSentinel Terminal Sandbox")

BASE_DIR = Path(os.getenv("SANDBOX_BASE_DIR", "/sandbox-data")).resolve()
EXEC_TIMEOUT_SEC = max(1, int(os.getenv("SANDBOX_EXEC_TIMEOUT_SEC", "8")))
MAX_OUTPUT_CHARS = max(1024, int(os.getenv("SANDBOX_MAX_OUTPUT_CHARS", "12000")))
SESSION_TTL_SECONDS = max(300, int(os.getenv("SANDBOX_SESSION_TTL_SECONDS", "7200")))
PROOT_BIN = shutil.which("proot")
DEFAULT_TERMINAL_HOSTS = ["web-ops-01", "crm-edge-02", "finance-gateway-01", "db-admin-03"]
DEFAULT_DIRECTORIES = [
    "/",
    "/etc",
    "/dev",
    "/home",
    "/home/admin",
    "/home/admin/.ssh",
    "/opt",
    "/opt/ops",
    "/proc",
    "/srv",
    "/srv/backups",
    "/tmp",
    "/var",
    "/var/log",
    "/var/www",
    "/var/www/html",
]
DEFAULT_FILES = {
    "/etc/os-release": 'NAME="Ubuntu"\nVERSION="22.04.3 LTS (Jammy Jellyfish)"\nID=ubuntu\n',
    "/etc/passwd": "root:x:0:0:root:/root:/bin/bash\nadmin:x:1000:1000:admin:/home/admin:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\n",
    "/home/admin/.bash_history": "sudo systemctl restart nginx\ncat /var/www/html/.env\nmysql -u reporting -p\n",
    "/home/admin/.ssh/known_hosts": "10.0.4.12 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBaiteddecoykeymaterial\n",
    "/home/admin/notes.txt": "1. Rotate service credentials after payroll import.\n2. Audit exposed admin paths before quarter close.\n",
    "/opt/ops/deploy.sh": "#!/bin/bash\nexport APP_ENV=production\nsystemctl restart honeypot-http\n",
    "/srv/backups/payroll_2024.csv": "employee_id,name,bank_ref\n1042,Anika Rao,masked-8472\n1198,Rahul Iyer,masked-2891\n",
    "/var/log/auth.log": "Mar 28 09:14:22 web-ops-01 sshd[1842]: Failed password for invalid user deploy from 203.0.113.14 port 60211 ssh2\n",
    "/var/www/html/.env": "APP_ENV=production\nDB_HOST=10.0.4.12\nDB_USER=svc_portal\nDB_PASSWORD=H0neyStack#2026\nJWT_SECRET=redacted-placeholder\n",
    "/var/www/html/index.php": "<?php\n$portal = 'Secure Operations Portal';\necho $portal;\n",
}
SPECIAL_OUTPUTS = {
    "ps": "\n".join(
        [
            "USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND",
            "root         1  0.0  0.2 169812 11024 ?        Ss   08:10   0:02 /sbin/init",
            "root       842  0.1  0.4 229484 19020 ?        Ssl  08:11   0:04 /usr/sbin/sshd -D",
            "www-data  1324  0.0  0.6 286112 25240 ?        S    08:12   0:01 php-fpm: pool www",
            "mysql     1450  0.4  4.1 1547292 167800 ?      Ssl  08:12   0:18 /usr/sbin/mysqld",
            "admin     2258  0.0  0.1  13284  4820 pts/0    Ss   09:02   0:00 -bash",
        ]
    ),
    "ss": "\n".join(
        [
            "Netid State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process",
            "tcp   LISTEN 0      128    0.0.0.0:22       0.0.0.0:*       users:(('sshd',pid=842,fd=3))",
            "tcp   LISTEN 0      256    0.0.0.0:80       0.0.0.0:*       users:(('nginx',pid=1192,fd=6))",
            "tcp   LISTEN 0      128    127.0.0.1:3306   0.0.0.0:*       users:(('mysqld',pid=1450,fd=21))",
        ]
    ),
}
SPECIAL_OUTPUTS["netstat"] = SPECIAL_OUTPUTS["ss"]
BLOCKED_BINARIES = {
    "apt",
    "apt-get",
    "apk",
    "bash",
    "crontab",
    "dd",
    "dnf",
    "docker",
    "ftp",
    "halt",
    "kill",
    "killall",
    "mount",
    "nc",
    "ncat",
    "netcat",
    "nmap",
    "nohup",
    "passwd",
    "perl",
    "php",
    "ping",
    "pkill",
    "poweroff",
    "proot",
    "python",
    "python3",
    "reboot",
    "ruby",
    "scp",
    "service",
    "sftp",
    "shutdown",
    "ssh",
    "su",
    "sudo",
    "systemctl",
    "telnet",
    "traceroute",
    "umount",
    "useradd",
    "wget",
    "yum",
}
BACKGROUND_PATTERN = re.compile(r"(^|[^&])&([^&]|$)")


class ExecRequest(BaseModel):
    session_id: str
    cmd: str


def _safe_session_id(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "", value or "")
    return cleaned[:48] or f"term-{hashlib.sha256((value or 'sandbox').encode('utf-8')).hexdigest()[:10]}"


def _session_paths(session_id: str) -> tuple[Path, Path, Path]:
    safe_id = _safe_session_id(session_id)
    session_dir = BASE_DIR / "sessions" / safe_id
    rootfs_dir = session_dir / "rootfs"
    state_file = session_dir / "state.json"
    return session_dir, rootfs_dir, state_file


def _hostname_for_session(session_id: str) -> str:
    index = int(hashlib.sha256(session_id.encode("utf-8")).hexdigest()[:2], 16) % len(DEFAULT_TERMINAL_HOSTS)
    return DEFAULT_TERMINAL_HOSTS[index]


def _prompt_for_state(state: dict[str, Any]) -> str:
    cwd = str(state.get("cwd") or "/home/admin")
    home = str(state.get("home") or "/home/admin")
    display = "~" if cwd == home else cwd.replace(f"{home}/", "~/", 1) if cwd.startswith(f"{home}/") else cwd
    return f"{state.get('username', 'admin')}@{state.get('hostname', 'honeypot')}:{display}$"


def _default_state(session_id: str) -> dict[str, Any]:
    return {
        "session_id": session_id,
        "username": "admin",
        "hostname": _hostname_for_session(session_id),
        "home": "/home/admin",
        "cwd": "/home/admin",
        "history": [],
    }


def _write_rootfs(rootfs_dir: Path, state: dict[str, Any]) -> None:
    for directory in DEFAULT_DIRECTORIES:
        rootfs_dir.joinpath(directory.lstrip("/")).mkdir(parents=True, exist_ok=True)
    files = dict(DEFAULT_FILES)
    files["/etc/hostname"] = f"{state['hostname']}\n"
    for relative_path, content in files.items():
        target = rootfs_dir / relative_path.lstrip("/")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")


def _load_state(state_file: Path, session_id: str) -> dict[str, Any]:
    if not state_file.exists():
        return _default_state(session_id)
    try:
        payload = json.loads(state_file.read_text(encoding="utf-8"))
    except Exception:
        return _default_state(session_id)
    if not isinstance(payload, dict):
        return _default_state(session_id)
    payload.setdefault("session_id", session_id)
    payload.setdefault("username", "admin")
    payload.setdefault("hostname", _hostname_for_session(session_id))
    payload.setdefault("home", "/home/admin")
    payload.setdefault("cwd", payload["home"])
    payload.setdefault("history", [])
    return payload


def _save_state(state_file: Path, state: dict[str, Any]) -> None:
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(json.dumps(state, indent=2), encoding="utf-8")


def _cleanup_sessions() -> None:
    sessions_dir = BASE_DIR / "sessions"
    if not sessions_dir.exists():
        return
    now = int(time.time())
    for child in sessions_dir.iterdir():
        state_file = child / "state.json"
        try:
            last_seen = state_file.stat().st_mtime if state_file.exists() else child.stat().st_mtime
        except OSError:
            continue
        if now - int(last_seen) > SESSION_TTL_SECONDS:
            shutil.rmtree(child, ignore_errors=True)


def _ensure_session(session_id: str) -> tuple[Path, dict[str, Any]]:
    _cleanup_sessions()
    session_dir, rootfs_dir, state_file = _session_paths(session_id)
    state = _load_state(state_file, session_id)
    if not rootfs_dir.exists():
        rootfs_dir.mkdir(parents=True, exist_ok=True)
        _write_rootfs(rootfs_dir, state)
        _save_state(state_file, state)
    return rootfs_dir, state


def _history_output(state: dict[str, Any]) -> str:
    history = list(state.get("history") or [])
    return "\n".join(f"{index + 1:>4}  {entry}" for index, entry in enumerate(history))


def _truncate_output(value: str) -> str:
    text = value[:MAX_OUTPUT_CHARS]
    return text if len(value) <= MAX_OUTPUT_CHARS else f"{text}\n...[truncated]"


def _shell_preamble(state: dict[str, Any]) -> str:
    hostname = shlex.quote(str(state["hostname"]))
    return "\n".join(
        [
            "export HOME=/home/admin USER=admin LOGNAME=admin LANG=en_US.UTF-8",
            f"export HOSTNAME={hostname}",
            "whoami() { printf '%s\\n' 'admin'; }",
            f"hostname() {{ printf '%s\\n' {hostname}; }}",
            "id() { printf '%s\\n' 'uid=1000(admin) gid=1000(admin) groups=1000(admin),27(sudo),33(www-data)'; }",
            f"uname() {{ if [ \"$1\" = '-a' ]; then printf '%s\\n' 'Linux {state['hostname']} 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux'; else command uname \"$@\"; fi; }}",
        ]
    )


def _special_case(cmd: str, state: dict[str, Any]) -> dict[str, Any] | None:
    stripped = cmd.strip()
    if not stripped:
        return {"output": "", "status": "ok"}
    if stripped == "history":
        return {"output": _history_output(state), "status": "ok"}
    if stripped == "exit":
        return {"output": "logout", "status": "ok"}
    binary = stripped.split()[0]
    if binary == "sudo":
        return {
            "output": f"Sorry, user {state['username']} may not run sudo on {state['hostname']}.",
            "status": "blocked",
        }
    if binary == "mysql":
        return {"output": "ERROR 1045 (28000): Access denied for user 'reporting'@'localhost' (using password: YES)", "status": "blocked"}
    if binary == "curl":
        target = stripped.split()[-1] if len(stripped.split()) > 1 else "http://127.0.0.1/"
        if "127.0.0.1" in target or "admin" in target:
            return {"output": "<html><title>Secure Operations Portal</title><body>login-required=true</body></html>", "status": "ok"}
        return {"output": "curl: (7) Failed to connect", "status": "error"}
    if binary in SPECIAL_OUTPUTS:
        return {"output": SPECIAL_OUTPUTS[binary], "status": "ok"}
    return None


def _blocked_reason(binary: str) -> str:
    if binary in {"ssh", "scp", "sftp", "ftp", "telnet", "ping", "traceroute", "nmap", "wget", "nc", "netcat", "ncat"}:
        return "Outbound network tooling disabled inside deception sandbox."
    return f"{binary}: command blocked by deception sandbox policy"


def _binds() -> list[str]:
    binds = []
    for path in ["/bin", "/usr/bin", "/usr/sbin", "/sbin", "/lib", "/lib64", "/usr/lib", "/usr/lib64", "/dev"]:
        if Path(path).exists():
            binds.extend(["-b", path])
    return binds


def _run_real_command(rootfs_dir: Path, state: dict[str, Any], cmd: str) -> dict[str, Any]:
    if PROOT_BIN is None:
        raise HTTPException(status_code=503, detail="proot is not installed in the terminal sandbox image.")
    if BACKGROUND_PATTERN.search(cmd):
        return {"output": "background execution disabled in deception sandbox", "status": "blocked"}
    try:
        parts = shlex.split(cmd)
    except ValueError:
        return {"output": "bash: syntax error near unexpected token", "status": "error"}
    if not parts:
        return {"output": "", "status": "ok"}
    if parts[0] in BLOCKED_BINARIES:
        return {"output": _blocked_reason(parts[0]), "status": "blocked"}

    wrapped = (
        f"{_shell_preamble(state)}\n"
        f"{cmd}\n"
        "__honey_status=$?\n"
        "printf '\\n__HONEY_CWD__:%s' \"$PWD\"\n"
        "exit $__honey_status\n"
    )
    command = [
        PROOT_BIN,
        "-R",
        str(rootfs_dir),
        *_binds(),
        "-w",
        str(state.get("cwd") or "/home/admin"),
        "/bin/bash",
        "-lc",
        wrapped,
    ]
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=EXEC_TIMEOUT_SEC,
        encoding="utf-8",
        errors="replace",
    )
    stdout = completed.stdout or ""
    stderr = completed.stderr or ""
    marker = "__HONEY_CWD__:"
    cwd = str(state.get("cwd") or "/home/admin")
    if marker in stdout:
        visible, _, cwd_value = stdout.rpartition(marker)
        stdout = visible.rstrip("\n")
        cwd = cwd_value.strip() or cwd
    state["cwd"] = cwd if cwd.startswith("/") else "/home/admin"
    output = f"{stdout}\n{stderr}".strip("\n")
    return {"output": _truncate_output(output), "status": "ok" if completed.returncode == 0 else "error"}


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "healthy" if PROOT_BIN else "degraded", "engine": "proot" if PROOT_BIN else "missing"}


@app.post("/exec")
def exec_command(payload: ExecRequest) -> dict[str, Any]:
    rootfs_dir, state = _ensure_session(payload.session_id)
    cmd = payload.cmd.strip()
    special = _special_case(cmd, state)
    result = special if special is not None else _run_real_command(rootfs_dir, state, cmd)
    if cmd and cmd != "history":
        history = list(state.get("history") or [])
        history.append(cmd)
        state["history"] = history[-60:]
    _save_state(_session_paths(payload.session_id)[2], state)
    return {
        "session_id": _safe_session_id(payload.session_id),
        "output": result["output"],
        "cwd": state["cwd"],
        "prompt": _prompt_for_state(state),
        "status": result["status"],
        "execution_mode": "real",
        "engine": "proot",
    }
