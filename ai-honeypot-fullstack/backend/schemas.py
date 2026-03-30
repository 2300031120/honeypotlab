from typing import Any

from pydantic import BaseModel, Field


class SignupRequest(BaseModel):
    username: str
    email: str
    password: str
    plan: str | None = None
    tenant_name: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class GoogleRequest(BaseModel):
    credential: str
    plan: str | None = None


class SiteRequest(BaseModel):
    name: str
    domain: str


class IngestRequest(BaseModel):
    event_type: str
    url_path: str | None = None
    http_method: str | None = None
    captured_data: dict[str, Any] | None = None
    ip: str | None = None
    cmd: str | None = None
    severity: str | None = None
    score: float | None = None


class LeadSubmission(BaseModel):
    name: str
    email: str
    organization: str
    use_case: str
    message: str
    website: str = ""
    challenge_id: str | None = None
    challenge_answer: str | None = None
    source: str | None = None
    campaign: str | None = None
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None
    submitted_at_ms: int | None = None


class StatusUpdate(BaseModel):
    status: str


class LeadNotePayload(BaseModel):
    note: str


class LeadAssignPayload(BaseModel):
    assigned_to: str = ""


class TerminalCommandPayload(BaseModel):
    cmd: str
    session_id: str | None = None


class AdvisorPayload(BaseModel):
    query: str
    persona: str = "GENERAL_SENTINEL"
    history: list[dict[str, Any]] = Field(default_factory=list)


class SimulatorPayload(BaseModel):
    event_type: str
    severity: str = "medium"
    ip: str = "127.0.0.1"
    url_path: str | None = None
    cmd: str | None = None


class BlockIpPayload(BaseModel):
    ip: str
    reason: str | None = None


class UrlScanPayload(BaseModel):
    url: str


class DeceptionDeployPayload(BaseModel):
    profile: str | None = None
    protocols: dict[str, bool] = Field(default_factory=dict)


class AutoModePayload(BaseModel):
    enabled: bool


class DeceptionProtocolTogglePayload(BaseModel):
    protocol: str
    active: bool


class RuntimeModuleTogglePayload(BaseModel):
    enabled: bool


class CanaryTokenCreatePayload(BaseModel):
    label: str
    type: str = "URL"


class InternalProtocolEventPayload(BaseModel):
    protocol: str
    site_id: int | None = None
    session_id: str
    event_type: str
    timestamp: str | None = None
    phase: str = "interaction"
    ip: str
    geo: str = "SSH Decoy"
    username: str | None = None
    password: str | None = None
    cmd: str | None = None
    output: str | None = None
    prompt: str | None = None
    cwd: str | None = None
    status: str | None = None
    accepted: bool | None = None
    execution_mode: str | None = None
    severity: str | None = None
    score: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
