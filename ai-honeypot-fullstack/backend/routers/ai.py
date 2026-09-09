"""
AI Router - Expert Advisor Endpoint
Provides AI-powered security analysis and incident response assistance.

The advisor is grounded in the tenant's live telemetry:
  - When a real LLM (OpenAI/Anthropic) is configured, that model answers with a
    context block that includes the tenant's current telemetry snapshot.
  - Otherwise a local grounded composer synthesizes the same snapshot into a
    personality-flavored, data-specific answer.
No answer is ever a hard-coded echo of the user's query.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Any, List, Optional
from core.config import (
    AI_ADVISOR_RATE_LIMIT_MAX_ATTEMPTS,
    AI_ADVISOR_RATE_LIMIT_WINDOW_SECONDS,
    AI_LLM_ENABLED,
    AI_LLM_PROVIDER,
    AI_LLM_MODEL,
    AI_LLM_API_KEY,
    AI_LLM_MAX_TOKENS,
    AI_LLM_TEMPERATURE,
    AI_API_COST_BUDGET_MONTHLY,
    AI_API_COST_ALERT_THRESHOLD,
    is_placeholder_secret,
)
from core.database import db
from core.cache import cache_result
from core.request_security import build_rate_limit_dependency
from routers.telemetry import (
    current_user,
    _site_ids_for_user,
    _scoped_event_rows,
    _correlate_campaigns,
)
import httpx
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
ai_rate_limit = build_rate_limit_dependency(
    "ai-advisor", AI_ADVISOR_RATE_LIMIT_MAX_ATTEMPTS, AI_ADVISOR_RATE_LIMIT_WINDOW_SECONDS
)

# AI API cost tracking (estimated costs per 1K tokens)
AI_COST_PER_1K_TOKENS = {
    "openai": {"gpt-4": 0.03, "gpt-3.5-turbo": 0.002},
    "anthropic": {"claude-3-opus": 0.015, "claude-3-sonnet": 0.003},
}

# Monthly cost tracking (in-memory, reset on restart)
_monthly_cost = 0.0
_monthly_requests = 0


class AIQueryRequest(BaseModel):
    query: str
    persona: str
    history: List[dict[str, Any]] = Field(default_factory=list)


class AIResponse(BaseModel):
    response: str
    persona_active: str
    response_source: str


# ---------------------------------------------------------------------------
# Live-telemetry grounding
# ---------------------------------------------------------------------------

def _tenant_telemetry_snapshot(conn, user_id: int) -> dict[str, Any]:
    """Build a compact, real snapshot of the tenant's telemetry for one answer."""
    site_ids = _site_ids_for_user(conn, user_id)
    rows = _scoped_event_rows(conn, site_ids, limit=800, allow_demo_fallback=False)
    campaigns = _correlate_campaigns(rows, limit=3)

    by_ip: dict[str, dict[str, Any]] = {}
    top_paths: dict[str, int] = {}
    severity: dict[str, int] = {"high": 0, "medium": 0, "low": 0}
    tactics: dict[str, int] = {}
    credential_attempts = 0
    window_first = ""
    window_last = ""
    for row in rows:
        created = str(row.get("created_at") or "")[:19]
        if created:
            window_last = max(window_last, created)
            window_first = min(window_first, created) if window_first else created
        sev = str(row.get("severity") or "low").lower()
        severity[sev] = severity.get(sev, 0) + 1
        if str(row.get("event_type") or "") == "credential_attempt":
            credential_attempts += 1
        path = str(row.get("url_path") or row.get("event_type") or "").strip()[:80]
        if path:
            top_paths[path] = top_paths.get(path, 0) + 1
        tactic = str(row.get("mitre_tactic") or "").strip()
        if tactic:
            tactics[tactic] = tactics.get(tactic, 0) + 1
        ip = str(row.get("ip") or "").strip()
        if ip and ip not in ("unknown", "0.0.0.0"):
            info = by_ip.setdefault(
                ip,
                {
                    "ip": ip,
                    "count": 0,
                    "geo": "global",
                    "last_seen": "",
                    "max_score": 0.0,
                    "high": 0,
                },
            )
            info["count"] += 1
            info["geo"] = row.get("geo") or info["geo"]
            info["last_seen"] = created or info["last_seen"]
            info["max_score"] = max(info["max_score"], float(row.get("score") or 0))
            if sev == "high" or float(row.get("score") or 0) >= 80:
                info["high"] += 1

    top_ips = sorted(by_ip.values(), key=lambda item: item["count"], reverse=True)[:5]
    top_paths_list = [
        {"path": path, "count": count}
        for path, count in sorted(top_paths.items(), key=lambda item: item[1], reverse=True)[:6]
    ]
    tactics_list = [
        {"tactic": tactic, "count": count}
        for tactic, count in sorted(tactics.items(), key=lambda item: item[1], reverse=True)[:4]
    ]

    blocked_ips: list[str] = []
    if site_ids:
        blocked_ips = [
            str(row["ip"]) for row in conn.execute(
                "select ip from blocked_ips where user_id = ? limit 5", (user_id,)
            ).fetchall()
        ]

    canaries_total = 0
    canaries_triggered = 0
    last_canary_trigger = ""
    try:
        canary_row = conn.execute(
            "select count(*) as total, "
            "coalesce(sum(case when triggered > 0 then 1 else 0 end), 0) as triggered "
            "from canary_tokens where user_id = ?",
            (user_id,),
        ).fetchone()
        canaries_total = int(canary_row["total"] or 0)
        canaries_triggered = int(canary_row["triggered"] or 0)
        trigger_row = conn.execute(
            "select triggered_at from canary_tokens "
            "where user_id = ? and triggered > 0 and triggered_at is not null "
            "order by triggered_at desc limit 1",
            (user_id,),
        ).fetchone()
        if trigger_row is not None and trigger_row["triggered_at"]:
            last_canary_trigger = str(trigger_row["triggered_at"])[:19]
    except Exception:
        pass

    return {
        "site_count": len(site_ids),
        "event_count": len(rows),
        "window_first": window_first,
        "window_last": window_last,
        "severity": severity,
        "high_risk": severity.get("high", 0),
        "credential_attempts": credential_attempts,
        "top_ips": top_ips,
        "top_paths": top_paths_list,
        "tactics": tactics_list,
        "blocked_ips": blocked_ips,
        "canaries_total": canaries_total,
        "canaries_triggered": canaries_triggered,
        "last_canary_trigger": last_canary_trigger,
        "campaigns": campaigns,
    }


def _snapshot_brief(snapshot: Optional[dict[str, Any]]) -> tuple[list[str], int]:
    """Return (brief_lines, event_count) used by every grounded answer."""
    if not snapshot:
        return ["I could not reach the telemetry store, so this answer is not grounded."], 0
    event_count = int(snapshot.get("event_count") or 0)
    brief: list[str] = []
    if event_count == 0:
        brief.append(
            "I have no captured events in your operator view yet. "
            "Once the platform records touches (or you run the Attack Simulator / trigger a canary), "
            "every answer is grounded in that data."
        )
        return brief, event_count
    window = snapshot.get("window_last") or "recent"
    brief.append(
        f"Grounded in your live telemetry: {event_count} events "
        f"(last activity {window}{('; window starts ' + str(snapshot['window_first'])) if snapshot.get('window_first') else ''})."
    )
    severity = snapshot.get("severity") or {}
    brief.append(
        "Severity mix: "
        + ", ".join(
            f"{int(severity.get(k, 0))} {k}" for k in ("high", "medium", "low") if severity.get(k)
        )
        + "."
    )
    top_ips = snapshot.get("top_ips") or []
    if top_ips:
        parts = [
            f"{item['ip']}{' (' + str(item['geo']) + ')' if item.get('geo') else ''} x{item['count']}"
            for item in top_ips[:3]
        ]
        brief.append("Most active sources: " + ", ".join(parts) + ".")
    return brief, event_count


def _surface_lines(snapshot: Optional[dict[str, Any]]) -> list[str]:
    lines: list[str] = []
    if not snapshot:
        return lines
    top_paths = snapshot.get("top_paths") or []
    if top_paths:
        lines.append(
            "Most-hit surfaces: "
            + ", ".join(f"{item['path']} ({item['count']})" for item in top_paths[:4])
            + "."
        )
    canaries_total = int(snapshot.get("canaries_total") or 0)
    canaries_triggered = int(snapshot.get("canaries_triggered") or 0)
    if canaries_total:
        lines.append(
            f"Canary coverage: {canaries_total} token(s), {canaries_triggered} triggered"
            + (f" (last trigger {snapshot['last_canary_trigger']})." if snapshot.get("last_canary_trigger") else ".")
        )
    blocked = snapshot.get("blocked_ips") or []
    if blocked:
        lines.append("Blocked sources in your view: " + ", ".join(blocked[:4]) + ".")
    return lines


def _recommendations(snapshot: Optional[dict[str, Any]]) -> list[str]:
    if not snapshot or not snapshot.get("event_count"):
        return [
            "Generate traffic (Attack Simulator or canary QR) so recommendations are driven by real touches.",
            "Confirm your decoy lanes: token and canary lures, protocol and SSH honeypots, enterprise and AD deception.",
        ]
    actions: list[str] = []
    top_ips = snapshot.get("top_ips") or []
    high = int(snapshot.get("high_risk") or 0)
    if high:
        actions.append(f"Triage the {high} high-risk event(s) first; verify whether the source reached a credential or admin surface.")
    if top_ips:
        actions.append(
            "Review the most active source(s) "
            + ", ".join(item["ip"] for item in top_ips[:2])
            + " for a correlated campaign before acting block-by-block."
        )
    canaries = int(snapshot.get("canaries_total") or 0)
    if not canaries:
        actions.append("Arm at least one canary token (Deception > Canary Tokens) so first touch is signaled with IP and User-Agent.")
    if not (snapshot.get("blocked_ips") or []):
        actions.append("Block confirmed abuse sources and record the action for audit.")
    actions.append("Keep decoy surfaces apart from production: same look, separate network segment, no real credentials.")
    return actions[:5]


# ---------------------------------------------------------------------------
# AURA knowledge engine
# ---------------------------------------------------------------------------

AURA_KNOWLEDGE: list[dict[str, Any]] = [
    {
        "keys": ("honeypot", "honeynet", "deception technology", "lure", "decoy technology", "honeypot work"),
        "title": "What is a honeypot?",
        "body": (
            "A honeypot is a decoy system planted to be attacked. It looks like a real target "
            "(a server, a login page, a file, a network service) but has no production value, so "
            "any interaction with it is suspicious by definition.\n\n"
            "Why it works: legitimate users never touch it, so every probe, login attempt, or file read "
            "is an attacker signal you did not have to pay for with real endpoints. In CyberSentil the "
            "same idea is applied across four deception lanes: web / protocol / network (SSH) decoys, "
            "canary tokens (URL, file, DNS, QR), decoy forms, and adaptive behavior based on who visits them.\n\n"
            "Key rule: decoys must mirror production appearance but sit in an isolated segment with "
            "no real credentials, so nothing an attacker does there can hurt production."
        ),
        "followups": [
            "How do I set up my first canary token?",
            "What attack do decoys typically catch first?",
            "Recommended priorities for my workspace",
        ],
    },
    {
        "keys": ("canary token", "canary tokens", "canary bait", "print canary"),
        "title": "What is a canary token?",
        "body": (
            "A canary token is a small, uniquely-identifiable 'tripwire' placed where an attacker is "
            "likely to look. When it is read, fetched, scanned, or opened, the platform immediately records "
            "the event with the IP address and User-Agent that touched it.\n\n"
            "CyberSentil supports URL canaries (visiting a link), QR prints (printing a code and waiting — "
            "great for tracking physical distribution), and file/DNS style lures. A triggered canary is "
            "proof-of-first-touch: it shows someone accessed a thing only insiders and attackers should know "
            "about, which is far more actionable than a generic port scan.\n\n"
            "Generate them under Deception > Canary Tokens. Each token can also be exported as a QR code "
            "so you can seed it across attachments, docs, or even physical posters."
        ),
        "followups": [
            "Which canary tokens are triggered in my workspace?",
            "How do I set up my first canary token?",
        ],
    },
    {
        "keys": ("phish", "spearphish", "vish", "smish", "phishing"),
        "title": "Phishing explained",
        "body": (
            "Phishing is a social-engineering attack that tricks someone into revealing credentials, "
            "installing malware, or transferring money by impersonating a trusted sender (email, SMS, "
            "voice, or messaging app).\n\n"
            "How to defend:\n"
            "1. Train eyes: check the sender domain, urgency, and mismatched links before reacting.\n"
            "2. Add friction: MFA, out-of-band confirmation for payment changes.\n"
            "3. Detect early: deploy a decoy inbox or lure so phishers waste time on fake credentials.\n"
            "4. Triage fast: treat the first malicious touch as an incident, not a false alarm."
        ),
        "followups": [
            "What is social engineering?",
            "Recommended priorities for my workspace",
        ],
    },
    {
        "keys": ("ransomware",),
        "title": "Ransomware",
        "body": (
            "Ransomware encrypts a victim's files and demands payment. Modern strains also exfiltrate "
            "data first ('double extortion'), so restoring from backup is not enough — secrets often leak.\n\n"
            "Strong defenses: tested offline backups, endpoint detection, least privilege, egress filtering, "
            "and phishing-resistant MFA (most ransomware starts with one phished credential). During an "
            "outbreak, isolate the affected segment, preserve memory and logs for forensics, and only then "
            "start recovery planning."
        ),
        "followups": [
            "What is incident response?",
            "How do I stop credential theft?",
        ],
    },
    {
        "keys": ("malware", "trojan", "worm", "rat", "backdoor", "botnet", "keylogger", "spyware"),
        "title": "Malware families",
        "body": (
            "Malware is software built to damage or compromise systems. Common families: trojans (disguised "
            "as legit software), worms (self-spreading), RATs (remote control), keyloggers, and botnets "
            "(compromised machines used at scale).\n\n"
            "Indicators are rarely one artifact — look for the chain: a delivery channel (email/lure), an "
            "execution point, persistence, and beaconing out. Decoys expose the chain early because "
            "attacker tooling touches fake systems before real ones."
        ),
        "followups": [
            "What is a honeypot?",
            "What is social engineering?",
        ],
    },
    {
        "keys": ("sql injection", "sqli"),
        "title": "SQL injection (SQLi)",
        "body": (
            "SQL injection happens when attacker input is concatenated into a database query, letting the "
            "attacker alter its meaning — reading, changing, or deleting data. Classic example: "
            "a login form where ' OR 1=1 -- tricks the query into accepting any credentials.\n\n"
            "Fixes, in order: parameterized queries / prepared statements (never string-build SQL), "
            "input validation and least-privilege DB accounts, and a WAF for second layer. In telemetry, "
            "repeated quote-and-comment payloads in one session are a strong SQLi scan signal."
        ),
        "followups": [
            "What is XSS?",
            "What is OWASP Top 10?",
        ],
    },
    {
        "keys": ("xss", "cross-site scripting", "cross site scripting"),
        "title": "Cross-site scripting (XSS)",
        "body": (
            "XSS injects script into a page that other users then run in their browsers — classic cases "
            "are stored comments, reflected search boxes, and broken sanitizers. Impact ranges from session "
            "theft to full account takeover.\n\n"
            "Defenses: context-aware output encoding, CSP headers as a safety net, sanitizing rich input "
            "allowlists, and encoding user content at every reflection point. Never trust browser-supplied "
            "values as safe."
        ),
        "followups": [
            "What is SQL injection?",
            "What is CSRF?",
        ],
    },
    {
        "keys": ("csrf", "cross-site request forgery", "cross site request forgery"),
        "title": "CSRF",
        "body": (
            "CSRF (cross-site request forgery) tricks an already-authenticated browser into performing a "
            "state-changing action on another site (e.g., transferring money, changing a password) without "
            "the user's consent.\n\n"
            "Standard defenses: synchronizer tokens embedded in forms/headers, SameSite cookies, and "
            "double-submit or origin-checking for state-changing requests."
        ),
        "followups": [
            "What is XSS?",
            "What is OWASP Top 10?",
        ],
    },
    {
        "keys": ("ssrf", "server-side request forgery", "server side request forgery"),
        "title": "SSRF",
        "body": (
            "SSRF lets an attacker make the *server* fetch attacker-chosen URLs — often reaching internal "
            "services, cloud metadata (169.254.169.254), or local files that should never be internet-facing.\n\n"
            "Mitigations: validate and allowlist outbound targets, deny private/internal ranges, disable "
            "redirect following, and use a dedicated egress proxy for any service that fetches URLs."
        ),
        "followups": [
            "What is SQL injection?",
            "What is XSS?",
        ],
    },
    {
        "keys": ("command injection", "code injection", "rce", "remote code execution"),
        "title": "Command injection / RCE",
        "body": (
            "Command injection occurs when user input is run in a shell or interpreter. Attackers chain "
            "operators like ; | && ` ` to sneak in their own commands. A secure design uses typed APIs "
            "and parameterized arguments instead of building command strings, plus strict allowlists.\n\n"
            "Detect it in telemetry the same way you find SQLi: non-typical shell characters and encoded "
            "payloads on otherwise-normal endpoints."
        ),
        "followups": [
            "What is SQL injection?",
            "What is OWASP Top 10?",
        ],
    },
    {
        "keys": ("ddos", "denial of service", "dos attack", "amplification"),
        "title": "DDoS",
        "body": (
            "DDoS floods a service with traffic (volumetric, protocol, or application-layer) to make it "
            "unavailable to real users.\n\n"
            "Practical defenses: cloud scrubbing/CDN capacity, rate limiting, load-balanced stateless layers, "
            "and SRE-style autoscaling. In application-layer attacks, block the *pattern* (slow loris, "
            "cache-busting) rather than the IP — IPs rotate constantly."
        ),
        "followups": [
            "What is a botnet?",
            "How do I stop credential theft?",
        ],
    },
    {
        "keys": ("brute force", "credential stuffing", "password spraying", "bruteforce"),
        "title": "Credential attacks",
        "body": (
            "Brute force tries every password against one account. Credential stuffing replays usernames+"
            "passwords stolen elsewhere (people reuse passwords). Password spraying tries a few common "
            "passwords across many accounts to dodge lockout policies.\n\n"
            "Stop them with: phishing-resistant MFA, ban lists for common passwords, adaptive rate limiting "
            "per IP and per account, and monitoring for mass-login spikes. Remember: attackers measure your "
            "defense by your lockouts and alerts, not your password complexity rule."
        ),
        "followups": [
            "What is a honeypot?",
            "How do I stop social engineering?",
        ],
    },
    {
        "keys": ("mitre", "att&ck", "ttps", "ttp", "kill chain"),
        "title": "MITRE ATT&CK",
        "body": (
            "MITRE ATT&CK is a knowledge base of real-world adversary tactics and techniques used during "
            "attacks — from initial access to exfiltration. It gives both sides a common language, e.g. "
            "T1082 system info discovery, T1566 phishing.\n\n"
            "In CyberSentil each captured event is mapped to a tactic/technique, so your telemetry can be "
            "read as a kill-chain story: a probe, then discovery, then credential attempt, then lateral. "
            "That mapping is exactly what the Attack Simulator generates and the forensics view tracks."
        ),
        "followups": [
            "Which MITRE tactics are in my telemetry?",
            "Recommended priorities for my workspace",
        ],
    },
    {
        "keys": ("zero-day", "zero day", "0-day", "exploit", "patch", "cve"),
        "title": "Zero-days, exploits & patching",
        "body": (
            "A zero-day is a vulnerability the vendor has zero days to fix because it is already exploited "
            "before a patch exists. Once published, the CVE gets a severity score and (usually) quick "
            "exploitation.\n\n"
            "Practical stance: patch fast on anything internet-facing, keep an asset inventory so you know "
            "what is exposed, and assume an exploit can arrive through your lure before your perimeter. "
            "Decoys give defenders an early fingerprint of exploit tooling without risking a real host."
        ),
        "followups": [
            "What is a honeypot?",
            "Recommended priorities for my workspace",
        ],
    },
    {
        "keys": ("password", "passwords", "hashing", "hash", "bcrypt", "argon2", "salt"),
        "title": "Storing passwords safely",
        "body": (
            "Never store plaintext or reversible password hashes (MD5/SHA1). Use a slow, salted password "
            "hash like Argon2id or bcrypt, per-user random salt included, and add a pepper stored outside "
            "the DB for good measure.\n\n"
            "On top of storage: enforce MFA for anything sensitive, check new passwords against 'have I "
            "been pwned' lists, and rate-limit login endpoints. This platform itself stores your operator "
            "credentials with a tuned Argon2id hash."
        ),
        "followups": [
            "What is credential stuffing?",
            "What is MFA?",
        ],
    },
    {
        "keys": ("mfa", "2fa", "multi-factor", "otp", "one-time password", "authenticator"),
        "title": "MFA",
        "body": (
            "Multi-factor authentication requires more than a password (something you know) — typically a "
            "second factor like an app-based one-time code, hardware key, or biometric. It stops most "
            "phished-credential attacks because a stolen password alone is not enough.\n\n"
            "Prefer phishing-resistant factors (WebAuthn / passkeys / hardware keys) over SMS codes, and "
            "enroll it on the accounts that can pivot to the most damage."
        ),
        "followups": [
            "What is credential stuffing?",
            "Storing passwords safely",
        ],
    },
    {
        "keys": ("tls", "ssl", "https", "certificate", "cipher"),
        "title": "TLS / HTTPS",
        "body": (
            "TLS encrypts data in transit between client and server. Modern guidance: TLS 1.2+ only, "
            "strong cipher suites, HSTS so browsers refuse plaintext, and valid certificates from a public "
            "CA for anything users type into.\n\n"
            "In this platform, sensitive endpoints enforce HTTPS with security headers, HSTS, and CSP by "
            "default — the same posture you should apply to any production app."
        ),
        "followups": [
            "What are security headers?",
            "What is OWASP Top 10?",
        ],
    },
    {
        "keys": ("incident response", "ir plan", "soc", "playbook", "triage", "forensics", "dfir"),
        "title": "Incident response",
        "body": (
            "Incident response is a structured process: prepare, detect, contain, eradicate, recover, and "
            "learn. In the moment, the priorities are (1) preserve evidence, (2) contain the blast radius, "
            "(3) communicate without guessing, (4) recover from verified backups, and (5) write up what "
            "allowed the entry.\n\n"
            "CyberSentil supports this with time-lined telemetry, transcript reconstruction (forensics), "
            "audit trails for every operator action, and campaign correlation that groups events into "
            "attacker stories instead of raw log lines."
        ),
        "followups": [
            "Which campaigns are in my telemetry?",
            "Recommended priorities for my workspace",
        ],
    },
    {
        "keys": ("social engineering", "pretexting", "baiting", "tailgating", "piggyback"),
        "title": "Social engineering",
        "body": (
            "Social engineering targets people instead of systems: a caller posing as IT, a USB drive left "
            "in the parking lot, a fake urgent email. It bypasses technical controls because humans are the "
            "perimeter.\n\n"
            "Defenses: verification rituals for anything sensitive (call back a known number), no-tailgating "
            "culture, phishing simulation with real feedback, and making 'suspicious' a reportable action "
            "instead of an embarrassing one."
        ),
        "followups": [
            "What is phishing?",
            "What is OSINT?",
        ],
    },
    {
        "keys": ("osint", "open source intelligence", "footprinting", "recon"),
        "title": "OSINT & footprinting",
        "body": (
            "OSINT is intelligence gathered from public sources — DNS records, certificate transparency, "
            "job postings, breach dumps, social media. Attackers use it to map your perimeter before they "
            "ever scan you.\n\n"
            "You can do the same defensively: find your own exposed surface (subdomains, leaked creds, "
            "employee mentions), then reduce it. Public-facing decoys also confuse this step — attackers "
            "waste their closest recons on your lures."
        ),
        "followups": [
            "What is a honeypot?",
            "What is social engineering?",
        ],
    },
    {
        "keys": ("owasp", "top 10", "secure coding", "input validation", "output encoding"),
        "title": "OWASP Top 10 & secure coding",
        "body": (
            "The OWASP Top 10 is the widely-used ranking of the most critical web application risks — "
            "injection, broken auth, sensitive data exposure, XXE, broken access control, SSRF, insecure "
            "design, and more.\n\n"
            "Core secure-coding habits: never build queries/shells from strings, encode output per context, "
            "bound every access-control check server-side, and patch dependencies on a cadence. Most of the "
            "Top 10 is prevented with these four habits plus automated scanning."
        ),
        "followups": [
            "What is SQL injection?",
            "What is XSS?",
        ],
    },
    {
        "keys": ("segmentation", "dmz", "network design", "firewall", "vlan", "zero trust", "zero-trust"),
        "title": "Segmentation & zero trust",
        "body": (
            "Network segmentation splits a network into trust zones so one compromised host cannot walk "
            "sideways to everything else. A DMZ holds internet-facing services, internal zones hold "
            "databases, and only explicit rules connect them.\n\n"
            "Zero trust goes further: no implicit trust by network location, every request authenticated "
            "and authorized, least privilege everywhere, and continuous verification. In a deception "
            "deployment, the decoy mesh is its own segment: same look, isolated path, no real credentials."
        ),
        "followups": [
            "How do I design my decoy coverage?",
            "What is a honeypot?",
        ],
    },
    {
        "keys": ("log analysis", "siem", "logging", "observability", "why logs"),
        "title": "Logs, SIEM & signal",
        "body": (
            "Logs become useful when they answer questions: who did what, from where, when, and with what "
            "outcome. A SIEM centralizes and correlates them. The failure mode is noise — too many alerts "
            "with no story.\n\n"
            "Better signal: keep a few high-quality sources (auth logs, WAF, IdP, decoys) and correlate "
            "them into campaign-level stories. That is why CyberSentil groups your events into correlated "
            "campaigns instead of dumping one alert per hit."
        ),
        "followups": [
            "Which campaigns are in my telemetry?",
            "Recommended priorities for my workspace",
        ],
    },
    {
        "keys": ("api key", "api token", "secret management", "violation"),
        "title": "API keys & secrets",
        "body": (
            "API keys are credentials for machines; treat them like passwords. Store them in a secret "
            "manager or env, never in code, and rotate them on a schedule and after any exposure. "
            "Scope keys to least privilege and add per-key rate limits so one leak can't cost everything.\n\n"
            "This platform hashes site API keys at rest and rotates them on demand — the same habit "
            "your own applications should follow."
        ),
        "followups": [
            "What is TLS?",
            "Recommended priorities for my workspace",
        ],
    },
    {
        "keys": ("attack simulator", "simulate attack", "simulation", "lab traffic", "generate traffic"),
        "title": "Attack Simulator",
        "body": (
            "The Attack Simulator produces realistic attacker traffic against your decoy surfaces — probes, "
            "scans, credential attempts — so you can validate that detection, correlation, and alerting all "
            "work end-to-end without waiting for a real attacker.\n\n"
            "It populates the same telemetry pipeline a real campaign uses: values feed scores, MITRE "
            "tactics, campaigns, and the AI companion's live view. It is the fastest way to get a "
            "meaningful baseline for a fresh workspace."
        ),
        "followups": [
            "Which MITRE tactics are in my telemetry?",
            "Recommended priorities for my workspace",
        ],
    },
    {
        "keys": ("adaptive decoy", "auto mode", "automation", "auto respond", "active defense"),
        "title": "Adaptive decoys & auto-mode",
        "body": (
            "Adaptive decoys change behavior based on who is probing them — a low-confidence scanner gets a "
            "benign surface, while a high-confidence attacker gets lures that pull out more of their "
            "tooling (login lures, admin portals, credential bait).\n\n"
            "Auto-mode takes graded action automatically: it shuts down high-confidence campaigns by "
            "blocking the source, while lower-confidence ones are recommended, not acted on — so the "
            "platform never overreacts to noise."
        ),
        "followups": [
            "Which campaigns are in my telemetry?",
            "How do I block an attacker?",
        ],
    },
    {
        "keys": ("terminal sandbox", "sandbox terminal", "command execution", "attacker terminal"),
        "title": "Terminal sandbox",
        "body": (
            "The protocol/terminal decoy presents an unauthenticated-looking network shell that records "
            "everything an attacker types. Commands are executed inside an isolated sandbox so payloads "
            "cannot touch production, and sessions can be replayed in the forensics view.\n\n"
            "This is where attacker intent gets loud: a real intruder will run discovery commands, probe "
            "for credentials, or try persistence — all of it captured safely."
        ),
        "followups": [
            "What is incident response?",
            "Recommended priorities for my workspace",
        ],
    },
    {
        "keys": ("set up my first site", "create a site", "add a site", "get started", "getting started", "how do i start"),
        "title": "Getting started in CyberSentil",
        "body": (
            "1. Create your workspace site (the domain 'scope' that traffic will be attributed to).\n"
            "2. Run the Attack Simulator once so the platform has baseline telemetry.\n"
            "3. Arm at least one canary token (Deception > Canary Tokens) and place it where an attacker "
            "would look; print the QR if you want to seed physical copies.\n"
            "4. Review the live feed and SOC views, then turn on auto-mode for graded response.\n\n"
            "Ask me 'Recommended priorities for my workspace' and I will read your live view and tell "
            "you the next best step."
        ),
        "followups": [
            "Recommended priorities for my workspace",
            "How do I set up my first canary token?",
        ],
    },
    {
        "keys": ("lead capture", "decoy form", "contact form", "form lure", "honeypot autofill"),
        "title": "Decoy forms & lead capture",
        "body": (
            "Decoy contact/lead forms capture attacker intent the moment it exists — they identify bots and "
            "automated scanners that fill forms, including honeypot-field traps (fields only bots touch). "
            "Legitimate leads are routed to the team, while the noise is flagged as attacker behavior.\n\n"
            "This turns your public marketing forms into early-warning sensors instead of dead weight."
        ),
        "followups": [
            "What is a honeypot?",
            "Recommended priorities for my workspace",
        ],
    },
    {
        "keys": ("ssh honeypot", "protocol honeypot", "ssh trap", "network decoy", "ssh decoy"),
        "title": "Protocol / SSH decoy",
        "body": (
            "A protocol decoy emulates a real service (here, an SSH-like shell) on a non-production port. "
            "Attackers who find it believe they found a weak entry point and proceed to interact — and "
            "everything they type is captured and replayed.\n\n"
            "It is one of the highest-signal deception layers because a real attacker on a real shell will "
            "do things a legitimate user never would (discovery, credential hunting, persistence attempts)."
        ),
        "followups": [
            "What is a terminal sandbox?",
            "What is a honeypot?",
        ],
    },
    {
        "keys": ("what does cybersentil do", "what is cybersentil", "what does this platform", "core features"),
        "title": "What CyberSentil does",
        "body": (
            "CyberSentil is deception-first threat detection: it plants believable decoy surfaces "
            "(web lures, protocol/SSH terminals, canary tokens incl. QR, decoy forms) across your "
            "perimeter so attackers reveal themselves by touching things only attackers should find.\n\n"
            "Every interaction is captured, scored, mapped to MITRE tactics, and correlated into campaigns "
            "— visible in live-feed, SOC, forensics, analytics, and the AURA AI companion. Auto-mode then "
            "responds with graded, auditable actions (recommend vs. block) instead of endless alert noise."
        ),
        "followups": [
            "What is a honeypot?",
            "Recommended priorities for my workspace",
        ],
    },
]


def _best_knowledge_match(query: str) -> Optional[dict[str, Any]]:
    best: Optional[dict[str, Any]] = None
    best_score = 0
    for entry in AURA_KNOWLEDGE:
        hits = sum(1 for key in entry["keys"] if key in query)
        if hits > best_score:
            best = entry
            best_score = hits
    return best


# ---------------------------------------------------------------------------
# Answer composition
# ---------------------------------------------------------------------------

def _telemetry_intent(query: str) -> bool:
    """Route to a live-telemetry answer (not a definition/how-to)."""
    q = query
    if any(w in q for w in ("status", "health", "snapshot", "readout", "overview", "ready")):
        return True
    if any(w in q for w in ("top attacker", "attacker ip", "attacker ips", "source ip", "reputation",
                            "campaign", "who is hitting", "active ip")):
        return True
    if "ip" in q and any(w in q for w in ("most", "top", "blocked", "active", "list")):
        return True
    if "canary" in q and any(w in q for w in ("status", "trigger", "only")):
        return True
    if any(w in q for w in ("mitre", "tactic", "att&ck")) and any(w in q for w in ("telemetry", "seen", "observed", "my", "workspace", "events")):
        return True
    if any(w in q for w in ("block", "blacklist", "mitigate", "defend")) and any(w in q for w in ("ip", "source", "attacker", "campaign")):
        return True
    if any(w in q for w in ("surfaces", "most-hit", "paths hit", "route", "top path")):
        return True
    if any(w in q for w in ("priority", "priorities", "top focus", "next step", "improve", "prevent")):
        return True
    if any(w in q for w in ("architect", "design", "coverage", "exposure", "segment")) and any(
        w in q for w in ("decoy", "coverage", "segment", "network", "deploy")
    ):
        return True
    return False


TELEMETRY_SUGGESTIONS = [
    "Which attacker IPs are most active?",
    "Recommended priorities",
    "What canary tokens were triggered?",
    "Which MITRE tactics are in my telemetry?",
]

FALLBACK_SUGGESTIONS = [
    "What is a honeypot?",
    "How do I set up my first canary token?",
    "Which attacker IPs are most active?",
    "Recommended priorities",
]


def _compose_answer(query: str, persona: str, snapshot: Optional[dict[str, Any]]) -> list[str]:
    """Return answer lines plus a final marker line of suggested follow-ups."""
    q = query.lower().strip()
    persona = (persona or "").upper()
    brief, event_count = _snapshot_brief(snapshot)

    header = {
        "GENERAL_SENTINEL": "General sentinel briefing",
        "FORENSICS": "Forensic view",
        "ARCHITECT": "Architecture view",
        "INTEL": "Threat intelligence view",
    }.get(persona, "Security advisor view")

    answers: list[str] = [f"{header} — {brief[0]}"]
    surfaces = _surface_lines(snapshot)
    recomendations = _recommendations(snapshot)

    if _telemetry_intent(q):
        if "status" in q or "snapshot" in q or "readout" in q or "ready" in q:
            if event_count == 0:
                answers.append("No telemetry in this operator view yet; run the Attack Simulator or arm a canary to get a live baseline.")
            else:
                severity = snapshot.get("severity") or {}
                answers.append(
                    "Live posture: "
                    + ", ".join(f"{int(severity.get(k, 0))} {k}" for k in ("high", "medium", "low") if severity.get(k))
                    + f" events across {snapshot.get('site_count', 0)} site(s)."
                )
                if surfaces:
                    answers.extend(surfaces)
        elif any(w in q for w in ("top attacker", "attacker ip", "attacker ips", "source ip", "reputation", "who is hitting", "active ip")) or (
            "ip" in q and any(w in q for w in ("most", "top", "blocked", "active", "list"))
        ):
            top_ips = snapshot.get("top_ips") or []
            if not top_ips:
                answers.append("No source IPs captured in your operator view yet.")
            else:
                for item in top_ips[:3]:
                    answers.append(
                        f"- {item['ip']} (geo {str(item.get('geo') or 'global')}): {item['count']} event(s), "
                        f"max score {item.get('max_score', 0):.0f}, {item.get('high', 0)} high-risk."
                    )
            campaigns = snapshot.get("campaigns") or []
            if campaigns:
                answers.append("Correlated campaign(s):")
                for camp in campaigns[:3]:
                    label = str(camp.get("label") or camp.get("campaign_type") or "activity")
                    answers.append(
                        f"- {label}: confidence {camp.get('confidence', 0)}, "
                        f"{camp.get('surface_count', 0)} surface(s), "
                        f"{camp.get('credential_attempts', 0)} credential attempt(s) — recommendation: {camp.get('recommended_action') or 'monitor'}."
                    )
        elif "canary" in q and any(w in q for w in ("status", "trigger")):
            total = int(snapshot.get("canaries_total") or 0) if snapshot else 0
            if total == 0:
                answers.append("No canary tokens in this operator view yet. Generate one (Deception > Canary Tokens) and place it where an attacker would look; each token prints a QR you can distribute.")
            else:
                answers.append(
                    f"Canary layer: {total} token(s), {snapshot['canaries_triggered']} triggered"
                    + (f" (last trigger {snapshot['last_canary_trigger']})." if snapshot.get("last_canary_trigger") else ".")
                )
                answers.append("Each canary signals a first touch with IP, User-Agent, and channel (URL or QR); triggered tokens stay visibly flagged for follow-up.")
        elif "mitre" in q or "tactic" in q or "att&ck" in q:
            tactics = snapshot.get("tactics") or []
            if not tactics:
                answers.append("No MITRE mapping observed in this operator view yet; run the Attack Simulator to populate tactics.")
            else:
                answers.append("Observed MITRE tactics in your telemetry:")
                for item in tactics:
                    answers.append(f"- {item['tactic']} ({item['count']} event(s))")
        elif any(w in q for w in ("block", "blacklist", "mitigate", "defend")):
            blocked = snapshot.get("blocked_ips") or []
            if not blocked:
                answers.append("No manually blocked sources in this view. Consistent triage and block actions strengthen the audit trail.")
            else:
                answers.append("Already blocked in your view: " + ", ".join(blocked[:5]) + ".")
            answers.append("Recommended next action: base blocks on correlated campaigns and re-check whether the source is still active before clearing.")
        elif any(w in q for w in ("surfaces", "most-hit", "paths hit", "route", "top path")):
            top_paths = snapshot.get("top_paths") or []
            if not top_paths:
                answers.append("No route-level touches captured yet; the platform logs url_path per event as soon as traffic lands.")
            else:
                answers.append("Most-hit surfaces:")
                answers.extend(f"- {item['path']} ({item['count']})" for item in top_paths[:5])
        elif any(w in q for w in ("architect", "design", "coverage", "exposure", "segment")):
            answers.append("Coverage today: " + _event_window_line(snapshot) if event_count else "Coverage today: no captured events yet.")
            if surfaces:
                answers.extend(surfaces)
            answers.append("Conceptual boundary: decoys mirror production appearance but sit in an isolated segment with no real credentials, and every interaction stays inside the honeypot mesh.")
        else:  # priorities / prevent / improve / next
            if recomendations:
                answers.append("Recommended priorities:")
                for idx, action in enumerate(recomendations, 1):
                    answers.append(f"{idx}. {action}")
            else:
                answers.append("No telemetry yet — arm decoys and generate traffic to get actionable priorities.")
        suggestions = TELEMETRY_SUGGESTIONS
    else:
        entry = _best_knowledge_match(q)
        if entry is not None:
            answers = [f"{entry['title']}\n\n{entry['body']}"]
            if event_count:
                answers.append("")
                answers.append("Your live view: " + _event_window_line(snapshot))
                if surfaces:
                    answers.append(surfaces[0])
            answers.append("")
            suggestions = list((entry.get("followups") or [])[:3])
        else:
            answers = [
                f"{header} — AURA here, your on-platform security companion.",
                "",
                "I can help two ways:",
                "1. Read your live workspace — try 'Which attacker IPs are most active?' or 'Recommended priorities'.",
                "2. Explain or coach on security topics — try 'What is a honeypot?', 'How do I stop SQL injection?', or 'How do I set up my first canary token?'.",
                "",
                "Note: without a configured LLM API key I answer from AURA's built-in knowledge plus your live telemetry, so I stay fast, private, and free of external calls.",
            ]
            suggestions = FALLBACK_SUGGESTIONS

    return answers + ["", "Try next: " + " | ".join(suggestions)]


def _event_window_line(snapshot: Optional[dict[str, Any]]) -> str:
    if not snapshot or not snapshot.get("event_count"):
        return "no captured events in this operator view yet."
    return (
        f"{snapshot['event_count']} total event(s), "
        f"last activity {snapshot.get('window_last', 'recent')}"
        + (f", {snapshot.get('high_risk', 0)} high-risk" if snapshot.get("high_risk") else "")
        + "."
    )


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/ai/expert-advisor")
async def expert_advisor(
    payload: AIQueryRequest,
    request: Request,
    user: dict[str, Any] = Depends(current_user),
    _: None = Depends(ai_rate_limit),
) -> dict[str, Any]:
    """AI Expert Advisor: real LLM when configured, otherwise grounded local synthesis."""

    snapshot: Optional[dict[str, Any]] = None
    try:
        with db() as conn:
            snapshot = _tenant_telemetry_snapshot(conn, int(user["id"]))
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("expert-advisor snapshot failed: %s", exc)
        snapshot = None

    llm_configured = AI_LLM_ENABLED and bool(AI_LLM_API_KEY and not is_placeholder_secret(AI_LLM_API_KEY))

    if llm_configured:
        try:
            response_text = _generate_llm_response(payload.query, payload.persona, payload.history, snapshot)
            return {
                "response": response_text,
                "persona_active": payload.persona,
                "response_source": "llm",
            }
        except Exception as exc:
            logger.warning("expert-advisor LLM path failed, falling back to grounded: %s", exc)

    response_text = "\n".join(_compose_answer(payload.query, payload.persona, snapshot))
    return {
        "response": response_text,
        "persona_active": payload.persona,
        "response_source": "grounded_telemetry",
    }


def _generate_llm_response(query: str, persona: str, history: List[dict],
                           snapshot: Optional[dict[str, Any]]) -> str:
    """Call the configured LLM with the tenant snapshot embedded as context."""
    if not AI_LLM_API_KEY or is_placeholder_secret(AI_LLM_API_KEY):
        raise ValueError("AI_LLM_API_KEY is not configured")

    persona_prompts = {
        "GENERAL_SENTINEL": "You are a general security sentinel for one operator, grounded in their live deception telemetry. Give concise, actionable, honest advice.",
        "FORENSICS": "You are a forensic analyst working from the operator's live captured telemetry. Focus on evidence, timelines, and surfaces.",
        "ARCHITECT": "You are a security architect. Focus on decoy coverage, segmentation, and honest guidance about what the telemetry does and does not show.",
        "INTEL": "You are a threat intelligence analyst. Focus on attribution, TTPs, and what the operator's own observations can justify.",
    }

    system_prompt = persona_prompts.get(persona, persona_prompts["GENERAL_SENTINEL"])
    if snapshot is not None:
        import json
        system_prompt += (
            "\n\nLive telemetry snapshot for this operator (use it; do not invent other data):\n"
            + json.dumps(snapshot, default=str)
        )

    messages: List[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for msg in history[-5:]:
        role = "assistant" if msg.get("role") == "assistant" else "user"
        messages.append({"role": role, "content": str(msg.get("content", ""))})
    messages.append({"role": "user", "content": query})

    if AI_LLM_PROVIDER == "openai":
        return _call_openai_api(messages)
    if AI_LLM_PROVIDER == "anthropic":
        return _call_anthropic_api(messages)
    raise ValueError(f"Unsupported LLM provider: {AI_LLM_PROVIDER}")


def _call_openai_api(messages: List[dict]) -> str:
    """Call OpenAI API for chat completion."""
    global _monthly_cost, _monthly_requests

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {AI_LLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": AI_LLM_MODEL,
                    "messages": messages,
                    "max_tokens": AI_LLM_MAX_TOKENS,
                    "temperature": AI_LLM_TEMPERATURE,
                },
            )
            response.raise_for_status()
            data = response.json()

            if "usage" in data:
                prompt_tokens = data["usage"].get("prompt_tokens", 0)
                completion_tokens = data["usage"].get("completion_tokens", 0)
                total_tokens = prompt_tokens + completion_tokens
                cost_per_1k = AI_COST_PER_1K_TOKENS.get("openai", {}).get(AI_LLM_MODEL, 0.03)
                estimated_cost = (total_tokens / 1000) * cost_per_1k
                _monthly_cost += estimated_cost
                _monthly_requests += 1

                if _monthly_cost >= AI_API_COST_BUDGET_MONTHLY * AI_API_COST_ALERT_THRESHOLD:
                    logger.warning(f"AI API cost approaching budget: ${_monthly_cost:.2f} / ${AI_API_COST_BUDGET_MONTHLY:.2f}")

            return data["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"OpenAI API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to call OpenAI API: {str(e)}")


def _call_anthropic_api(messages: List[dict]) -> str:
    """Call Anthropic API for chat completion."""
    try:
        system_message = ""
        user_message = ""
        for msg in messages:
            if msg["role"] == "system":
                system_message = msg["content"]
            elif msg["role"] == "user":
                user_message = msg["content"]

        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": AI_LLM_API_KEY,
                    "Content-Type": "application/json",
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": AI_LLM_MODEL,
                    "max_tokens": AI_LLM_MAX_TOKENS,
                    "system": system_message,
                    "messages": [{"role": "user", "content": user_message}],
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["content"][0]["text"]
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Anthropic API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to call Anthropic API: {str(e)}")


@router.get("/ai/status")
@cache_result(ttl=60, key_prefix="ai_status")
def ai_status(
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    """Check AI service status and configuration."""
    llm_configured = bool(AI_LLM_API_KEY and not is_placeholder_secret(AI_LLM_API_KEY))
    return {
        "status": "operational",
        "llm_enabled": AI_LLM_ENABLED,
        "llm_provider": AI_LLM_PROVIDER,
        "llm_model": AI_LLM_MODEL,
        "llm_configured": llm_configured,
        "available_personas": ["GENERAL_SENTINEL", "FORENSICS", "ARCHITECT", "INTEL"],
        "response_mode": "llm" if (AI_LLM_ENABLED and llm_configured) else "grounded_telemetry",
        "engine": "aura",
        "grounding": "AURA tunes answers with a live telemetry snapshot (events, sources, surfaces, canaries, campaigns) and a local cybersecurity knowledge base",
        "cost_tracking": {
            "monthly_cost": round(_monthly_cost, 2),
            "monthly_requests": _monthly_requests,
            "budget_limit": AI_API_COST_BUDGET_MONTHLY,
            "budget_alert_threshold": AI_API_COST_ALERT_THRESHOLD,
            "budget_warning": _monthly_cost >= AI_API_COST_BUDGET_MONTHLY * AI_API_COST_ALERT_THRESHOLD,
        },
    }