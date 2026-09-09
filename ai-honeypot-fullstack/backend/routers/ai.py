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


def _compose_grounded(query: str, persona: str, snapshot: Optional[dict[str, Any]]) -> str:
    q = query.lower()
    persona = (persona or "").upper()
    brief, event_count = _snapshot_brief(snapshot)
    surfaces = _surface_lines(snapshot)
    recomendations = _recommendations(snapshot)

    header = {
        "GENERAL_SENTINEL": "General sentinel briefing",
        "FORENSICS": "Forensic view",
        "ARCHITECT": "Architecture view",
        "INTEL": "Threat intelligence view",
    }.get(persona, "Security advisor view")

    answers: list[str] = [f"{header} — {brief[0]}"]

    def want(*keywords: str) -> bool:
        return any(word in q for word in keywords)

    if want("status", "health", "snapshot", "ready", "overview"):
        if event_count == 0:
            answers.append("No telemetry in this operator view yet; run traffic or arm a canary to get a live baseline.")
        else:
            severity = snapshot.get("severity") or {}
            answers.append(
                "Live posture: "
                + ", ".join(
                    f"{int(severity.get(k, 0))} {k}"
                    for k in ("high", "medium", "low")
                    if severity.get(k)
                )
                + f" events across {snapshot.get('site_count', 0)} site(s)."
            )
            if surfaces:
                answers.extend(surfaces)
    elif want("ip", "reputation", "attacker", "source", "geo", "who", "campaign"):
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
    elif want("decoy", "token", "canary", "trap", "honeypot", "lure", "qr"):
        total = int(snapshot.get("canaries_total") or 0) if snapshot else 0
        if total == 0:
            answers.append("No canary tokens in this operator view yet. Generate one (Deception > Canary Tokens) and place it where an attacker would look; each token prints a QR you can distribute.")
        else:
            answers.append(
                f"Canary layer: {total} token(s), {snapshot['canaries_triggered']} triggered"
                + (f" (last trigger {snapshot['last_canary_trigger']})." if snapshot.get("last_canary_trigger") else ".")
            )
            answers.append("Each canary signals a first touch with IP, User-Agent, and channel (URL or QR); triggered tokens stay visibly flagged for follow-up.")
    elif want("mitre", "tactic", "technique", "ttp", "att&ck", "mapping"):
        tactics = snapshot.get("tactics") or []
        if not tactics:
            answers.append("No MITRE mapping observed in this operator view yet; run the Attack Simulator to populate tactics.")
        else:
            answers.append("Observed MITRE tactics in your telemetry:")
            for item in tactics:
                answers.append(f"- {item['tactic']} ({item['count']} event(s))")
    elif want("block", "blacklist", "defend", "stop", "mitigate", "action"):
        blocked = snapshot.get("blocked_ips") or []
        if not blocked:
            answers.append("No manually blocked sources in this view. Consistent triage and block actions strengthen the audit trail.")
        else:
            answers.append("Already blocked in your view: " + ", ".join(blocked[:5]) + ".")
        answers.append("Recommended next action: base blocks on correlated campaigns and re-check whether the source is still active before clearing.")
    elif want("url", "route", "path", "scan", "surface", "login", "admin"):
        surfaces = snapshot.get("top_paths") or []
        if not surfaces:
            answers.append("No route-level touches captured yet; the platform logs url_path per event as soon as traffic lands.")
        else:
            answers.extend(
                f"- {item['path']} ({item['count']})" for item in surfaces[:5]
            )
    elif want("architect", "design", "segment", "network", "deploy", "coverage", "exposure"):
        answers.append("Coverage today: " + _event_window_line(snapshot) if event_count else "Coverage today: no captured events yet.")
        if surfaces:
            answers.extend(surfaces)
        answers.append("Conceptual boundary: decoys mirror production appearance but sit in an isolated segment with no real credentials, and every interaction stays inside the honeypot mesh.")
    elif want("priority", "recommend", "top", "focus", "next", "prevent", "improve"):
        if recomendations:
            answers.append("Recommended priorities:")
            for idx, action in enumerate(recomendations, 1):
                answers.append(f"{idx}. {action}")
        else:
            answers.append("No telemetry yet — arm decoys and generate traffic to get actionable priorities.")
    else:
        # General / unrelated question: answer honestly against the tenant view.
        answers.append("I answer from your live operator view, not a generic corpus. Right now that view shows:")
        if event_count:
            answers.append(_event_window_line(snapshot))
            if surfaces:
                answers.extend(surfaces[:2])
            answers.append("For a review of the riskiest sources, ask: \"top attacker IPs\" — or \"recommended priorities\" for next steps.")
        else:
            answers.append("no captured events yet. Once touches flow in, I can answer about attackers, surfaces, canaries, tactics, and priorities with your data.")

    return "\n".join(answers)


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

    response_text = _compose_grounded(payload.query, payload.persona, snapshot)
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
        "grounding": "live telemetry snapshot (events, sources, surfaces, canaries, campaigns)",
        "cost_tracking": {
            "monthly_cost": round(_monthly_cost, 2),
            "monthly_requests": _monthly_requests,
            "budget_limit": AI_API_COST_BUDGET_MONTHLY,
            "budget_alert_threshold": AI_API_COST_ALERT_THRESHOLD,
            "budget_warning": _monthly_cost >= AI_API_COST_BUDGET_MONTHLY * AI_API_COST_ALERT_THRESHOLD,
        },
    }