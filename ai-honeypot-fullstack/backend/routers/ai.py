"""
AI Router - Expert Advisor Endpoint
Provides AI-powered security analysis and incident response assistance
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
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
)
from core.database import db
from core.cache import cache_result
from core.request_security import build_rate_limit_dependency
from routers.telemetry import current_user, _site_ids_for_user, _scoped_event_rows
import secrets
import time
import httpx
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
ai_rate_limit = build_rate_limit_dependency("ai-advisor", AI_ADVISOR_RATE_LIMIT_MAX_ATTEMPTS, AI_ADVISOR_RATE_LIMIT_WINDOW_SECONDS)

# AI API cost tracking (estimated costs per 1K tokens)
AI_COST_PER_1K_TOKENS = {
    "openai": {"gpt-4": 0.03, "gpt-3.5-turbo": 0.002},
    "anthropic": {"claude-3-opus": 0.015, "claude-3-sonnet": 0.003}
}

# Monthly cost tracking (in-memory, reset on restart)
_monthly_cost = 0.0
_monthly_requests = 0


class AIQueryRequest(BaseModel):
    query: str
    persona: str
    history: List[dict[str, Any]]


class AIResponse(BaseModel):
    response: str
    persona_active: str
    response_source: str


def _generate_local_response(query: str, persona: str, context: List[dict]) -> str:
    """Generate a local fallback response when LLM is not available"""
    query_lower = query.lower()
    
    # Security-focused responses based on persona
    persona_responses = {
        "GENERAL_SENTINEL": {
            "attack": "Based on current threat intelligence, this pattern suggests reconnaissance activity. Monitor for follow-on exploitation attempts.",
            "mitre": "This technique aligns with MITRE ATT&CK framework. Consider implementing detection rules for this tactic.",
            "decoy": "Decoy placement appears effective. Consider expanding coverage to additional high-value targets.",
            "default": "I'm operating in local mode. For advanced AI analysis, ensure LLM integration is configured."
        },
        "FORENSICS": {
            "attack": "Session analysis indicates lateral movement. Preserve artifacts and review timeline for correlation.",
            "mitre": "Tactic classification: Discovery. Recommend collecting additional forensic evidence.",
            "decoy": "Decoy engagement detected. Analyze captured credentials and commands for threat actor TTPs.",
            "default": "Forensic analysis requires full telemetry access. Review incident timeline and preserved evidence."
        },
        "ARCHITECT": {
            "attack": "Architecture review suggests improving network segmentation. Implement zero-trust principles for decoy placement.",
            "mitre": "Technique mapping complete. Update detection rules and playbooks accordingly.",
            "decoy": "Decoy architecture shows good coverage. Consider adding protocol-specific decoys for comprehensive monitoring.",
            "default": "Architecture assessment requires understanding of current deployment topology and security controls."
        },
        "INTEL": {
            "attack": "Threat intelligence indicates this pattern matches known actor groups. Cross-reference with external feeds.",
            "mitre": "TTP analysis suggests APT-style behavior. Update threat hunting priorities.",
            "decoy": "Decoy telemetry provides valuable intel. Correlate with external threat feeds for attribution.",
            "default": "Intelligence analysis requires context from multiple sources. Review threat feeds and historical data."
        }
    }
    
    # Select response based on query content
    responses = persona_responses.get(persona, persona_responses["GENERAL_SENTINEL"])
    
    if "attack" in query_lower or "incident" in query_lower:
        return responses["attack"]
    elif "mitre" in query_lower or "tactic" in query_lower or "technique" in query_lower:
        return responses["mitre"]
    elif "decoy" in query_lower or "trap" in query_lower:
        return responses["decoy"]
    else:
        return responses["default"]


@router.post("/ai/expert-advisor")
async def expert_advisor(
    payload: AIQueryRequest,
    request: Request,
    user: dict[str, Any] = Depends(current_user),
    _: None = Depends(ai_rate_limit),
) -> dict[str, Any]:
    """
    AI Expert Advisor Endpoint
    Provides security analysis and incident response assistance
    
    Supports multiple personas:
    - GENERAL_SENTINEL: General security guidance
    - FORENSICS: Incident forensics and analysis
    - ARCHITECT: Security architecture recommendations
    - INTEL: Threat intelligence and attribution
    """
    
    # Check if LLM is configured (via environment variable)
    import os
    llm_enabled = os.getenv("AI_LLM_ENABLED", "false").lower() == "true"
    
    if llm_enabled:
        # Try to use LLM if configured
        try:
            # Placeholder for actual LLM integration
            # This would call OpenAI, Anthropic, or local LLM
            response_text = _generate_llm_response(payload.query, payload.persona, payload.history)
            response_source = "llm"
        except Exception as e:
            # Fallback to local response on error
            response_text = _generate_local_response(payload.query, payload.persona, payload.history)
            response_source = "local"
    else:
        # Use local fallback response
        response_text = _generate_local_response(payload.query, payload.persona, payload.history)
        response_source = "local"
    
    return {
        "response": response_text,
        "persona_active": payload.persona,
        "response_source": response_source
    }


def _generate_llm_response(query: str, persona: str, history: List[dict]) -> str:
    """
    Generate response using LLM (OpenAI or Anthropic)
    
    This function calls the actual LLM API based on configuration.
    """
    if not AI_LLM_API_KEY:
        raise ValueError("AI_LLM_API_KEY is not configured")
    
    persona_prompts = {
        "GENERAL_SENTINEL": "You are a general security sentinel providing guidance on threat detection and incident response. Give concise, actionable security advice.",
        "FORENSICS": "You are a forensic analyst providing detailed analysis of incident artifacts and attack timelines. Focus on evidence collection and timeline reconstruction.",
        "ARCHITECT": "You are a security architect providing recommendations on network design and security controls. Focus on defense-in-depth and secure architecture principles.",
        "INTEL": "You are a threat intelligence analyst providing attribution and threat actor analysis. Focus on TTPs, indicators of compromise, and threat hunting."
    }
    
    system_prompt = persona_prompts.get(persona, persona_prompts["GENERAL_SENTINEL"])
    
    # Build conversation history
    messages = [
        {"role": "system", "content": system_prompt}
    ]
    
    # Add recent history (last 5 messages to stay within context limits)
    for msg in history[-5:]:
        role = "assistant" if msg.get("role") == "assistant" else "user"
        messages.append({"role": role, "content": msg.get("content", "")})
    
    # Add current query
    messages.append({"role": "user", "content": query})
    
    # Call LLM API based on provider
    if AI_LLM_PROVIDER == "openai":
        return _call_openai_api(messages)
    elif AI_LLM_PROVIDER == "anthropic":
        return _call_anthropic_api(messages)
    else:
        raise ValueError(f"Unsupported LLM provider: {AI_LLM_PROVIDER}")


def _call_openai_api(messages: List[dict]) -> str:
    """Call OpenAI API for chat completion"""
    global _monthly_cost, _monthly_requests
    
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {AI_LLM_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": AI_LLM_MODEL,
                    "messages": messages,
                    "max_tokens": AI_LLM_MAX_TOKENS,
                    "temperature": AI_LLM_TEMPERATURE
                }
            )
            response.raise_for_status()
            data = response.json()
            
            # Track cost
            if "usage" in data:
                prompt_tokens = data["usage"].get("prompt_tokens", 0)
                completion_tokens = data["usage"].get("completion_tokens", 0)
                total_tokens = prompt_tokens + completion_tokens
                cost_per_1k = AI_COST_PER_1K_TOKENS.get("openai", {}).get(AI_LLM_MODEL, 0.03)
                estimated_cost = (total_tokens / 1000) * cost_per_1k
                _monthly_cost += estimated_cost
                _monthly_requests += 1
                
                # Check budget
                if _monthly_cost >= AI_API_COST_BUDGET_MONTHLY * AI_API_COST_ALERT_THRESHOLD:
                    logger.warning(f"AI API cost approaching budget: ${_monthly_cost:.2f} / ${AI_API_COST_BUDGET_MONTHLY:.2f}")
            
            return data["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"OpenAI API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to call OpenAI API: {str(e)}")


def _call_anthropic_api(messages: List[dict]) -> str:
    """Call Anthropic API for chat completion"""
    try:
        # Convert OpenAI format to Anthropic format
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
                    "anthropic-version": "2023-06-01"
                },
                json={
                    "model": AI_LLM_MODEL,
                    "max_tokens": AI_LLM_MAX_TOKENS,
                    "system": system_message,
                    "messages": [{"role": "user", "content": user_message}]
                }
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
async def ai_status(
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    """Check AI service status and configuration"""
    return {
        "status": "operational",
        "llm_enabled": AI_LLM_ENABLED,
        "llm_provider": AI_LLM_PROVIDER,
        "llm_model": AI_LLM_MODEL,
        "llm_configured": bool(AI_LLM_API_KEY and not is_placeholder_secret(AI_LLM_API_KEY)),
        "available_personas": ["GENERAL_SENTINEL", "FORENSICS", "ARCHITECT", "INTEL"],
        "response_mode": "llm" if (AI_LLM_ENABLED and AI_LLM_API_KEY) else "local_fallback",
        "cost_tracking": {
            "monthly_cost": round(_monthly_cost, 2),
            "monthly_requests": _monthly_requests,
            "budget_limit": AI_API_COST_BUDGET_MONTHLY,
            "budget_alert_threshold": AI_API_COST_ALERT_THRESHOLD,
            "budget_warning": _monthly_cost >= AI_API_COST_BUDGET_MONTHLY * AI_API_COST_ALERT_THRESHOLD
        }
    }
