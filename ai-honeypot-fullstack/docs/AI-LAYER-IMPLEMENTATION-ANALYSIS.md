# CyberSentil — AI Layer Implementation Analysis

> **Status: ANALYSIS ONLY.** No source files were modified to produce this document.
> This is the grounded implementation plan for making CyberSentil genuinely "AI-Enhanced."
> The current AI surface is **real plumbing but dormant intelligence** — the wiring (endpoints, config,
> rate limits, cost tracking, fallbacks) exists, but no LLM is configured, decoy adaptation is
> deterministic/template, and the "AI brief" is a hardcoded string. This document closes that gap.

---

## A. Current AI Architecture (What Actually Exists)

### A.1 Assertion summary

Every existing AI-related component is classified as one of:
- **REAL** — genuinely wired, production code, live.
- **TEMPLATE** — deterministic/template logic presented as "AI" (not learning, not generative).
- **DORMANT** — fully coded but disabled by default / missing a configured key.
- **MOCK** — fabricated sample data only used when no real telemetry exists.

| Component | File / Symbol | Classification | Input | Output | Current behavior |
|---|---|---|---|---|---|
| LLM toggle | `backend/core/config.py:302-307` | **DORMANT** | env `AI_LLM_ENABLED` | bool | Default `False`. Provider default `openai`, model default `gpt-4`, key from `AI_LLM_API_KEY` (unset on server). |
| Cost/budget | `backend/core/config.py:313-314` | **REAL** (guard) | env | floats | `AI_API_COST_BUDGET_MONTHLY=100.0`, `AI_API_COST_ALERT_THRESHOLD=0.8`. Loaded but only used by `ai.py`. |
| Health check | `backend/core/health_monitor.py:50-59` | **REAL** (gate) | `AI_LLM_ENABLED` + `AI_LLM_API_KEY` | component status | Reports AI health only when both enabled & keyed; otherwise "disabled". |
| Expert Advisor endpoint | `backend/routers/ai.py:103-145` | **REAL** plumbing, **TEMPLATE** on fallback | `AIQueryRequest(query, persona, history)`, authed, rate-limited | `AIResponse(response, persona_active, response_source)` | If not enabled → `_generate_local_response` (hardcoded strings). If enabled → `_generate_llm_response` → `_call_openai_api` / `_call_anthropic_api`. |
| Local fallback | `backend/routers/ai.py:58-100` | **TEMPLATE** | query, persona, history | string | Keyword match (`attack`/`mitre`/`decoy`) → canned response per persona. Keywords on the string "local mode" reveal non-AI. |
| LLM callers | `backend/routers/ai.py:148-265` | **REAL** but **DORMANT** (never invoked) | messages | text | httpx calls to OpenAI/Anthropic with 30s timeout; cost math from `AI_COST_PER_1K_TOKENS`. Never reachable because toggle off + no key. |
| Cost tracking | `backend/routers/ai.py:42-43, 210-223` | **REAL** but in-memory only | token usage | `_monthly_cost`, `_monthly_requests` | Reset on restart; not persisted. Used by `/ai/status`. |
| `/ai/status` | `backend/routers/ai.py:268-289` | **REAL** | authed user | config/status JSON (cached 60s) | Reports `response_mode = "local_fallback"` today. |
| Decoy actor classification | `backend/services/adaptive_decoy.py:109-118` | **TEMPLATE** | DecoySession counters | `ActorType` enum | Rules: `<3 reqs`=scanner; `>5 logins`=brute_forcer; `sql>0 & paths>3`=manual_operator; else exploratory. |
| Deception profile selection | `adaptive_decoy.py:120-128` | **TEMPLATE** | actor type | `DeceptionProfile` enum | Static map actor→profile. No telemetry feedback. |
| Storyboard advance | `adaptive_decoy.py:130-150` | **TEMPLATE** | counters | `StoryboardStage` enum | Fixed progression over login/sql/path thresholds. |
| SQL emulation | `adaptive_decoy.py:256-388` | **TEMPLATE** | SQL string | fake results / errors | Regex `DESTRUCTIVE_PATTERNS` block; `SHOW/SELECT/DESC/USE` handlers return deterministic fake rows. |
| Dynamic response gen | `adaptive_decoy.py:391-431` | **TEMPLATE** | username/password/type | error/message strings | `random.choice` over canned MySQL error templates + `delay_ms`. |
| Event capture | `backend/routers/telemetry.py` (many `capture_*` helpers) | **REAL** | raw decoy/HTTP/SSH hit | insert row into `events` | All lures (phpMyAdmin, WP, admin login, XML-RPC, ssh-decoy, cowrie, terminal) normalize & INSERT into `events`. |
| Event normalization | `core/database.py` `normalize_event` | **REAL** | DB row dict | canonical event dict | Applied everywhere; cleans text, computes defaults (severity/score/mitre). |
| Summary/threat parse | `telemetry.py:2420-2448, 3557-3563` | **REAL** (deterministic) | event rows | `summary`, `threat_score` | Pure arithmetic aggregations (`critical*11 + medium*5 + unhealthy*4`). No language model. |
| Public `ai_summary` | `telemetry.py:3611` | **TEMPLATE** | — | constant string | Hardcoded: "Operational telemetry feed active…". Presented as "AI" but static. |
| AI Assistant UI | `frontend/src/AIAssistant.tsx` | **REAL** (link) | auth | FAB → `/ai-companion` | Only visible when authenticated. Backed by `/ai/expert-advisor`. |

### A.2 What the pipeline actually does today (no LLM)

```
Attacker ─► decoy/HTTP/SSH/terminal handler
              │  (telemetry.py capture_* / _insert_event)
              ▼
          events table (normalize_event)   ◄── policy_risk_score, attacker_type, mitre_*, captured_data
              │
              ▼
        deterministic aggregation
    (threat_score = 18 + crit*11 + med*5 + unhealthy*4; severity buckets; distributions)
              │
              ▼
        dashboard / briefs / LED public tile
```

The "AI" label currently maps to: (1) keyword-matched persona fallback text, (2) hardcoded
`ai_summary` strings, (3) rule-based decoy classification. **None of it is generative or learned.**

---

## B. Missing AI Components

1. **LLM activation** — `AI_LLM_ENABLED` never set true; no `AI_LLM_API_KEY` anywhere; no local model host. The entire LLM path is dead code at runtime.
2. **Grounded AI Security Brief** — the AI incident brief is a hardcoded string; it is not generated from the normalized event stream of a real tenant, session, or IP.
3. **AI-driven attacker profiling beyond rules** — `adaptive_decoy.py` classifies by counters only; there is no feature vector, no cross-session correlation, no intent estimation fed by telemetry.
4. **LLM-nudged adaptive decoy response** — decoy responses are `random.choice` templates; nothing reads the actor profile + session telemetry to tailor the lure.
5. **No structured extraction** — no extraction of IPs, usernames, SQL intent, TTPs, IoCs from `captured_data`/`cmd` into a machine-readable AI feature layer.
6. **No persistence of AI artifacts** — profiles, briefs, and risk scores are recomputed per request; there is no store, no history, no audit of "what the AI decided and why."
7. **No safeguard layer** — nothing enforces "LLM output is advisory only" before it touches the deception engine; no prompt-injection stance; no sanitization policy for attacker-supplied text entering prompts.
8. **No offline/local inference path** — `_generate_local_response` is template, not a local model; no quantization/CPU fallback, so "hybrid" isn't real yet.
9. **No telemetry→AI grounding test** — nothing validates that AI output reflects this tenant's actual events (judges probe for exactly this).

---

## C. Recommended Architecture (vendor-neutral)

Recommend a **hybrid, auth-guarded, degradation-first** design. No provider is assumed; the provider is
an implementation detail behind a thin boundary.

### C.1 Layered design

```
┌─ Presentation (FastAPI routers) ─────────────────────────────────────┐
│  /ai/expert-advisor (chat)   /ai/brief/{session|ip}   /ai/profile   │
│  /ai/status                  /ai/adapt                /ai/guard     │
└───────────────┬─────────────────────────────────────────────────────┘
                │ (all authed; rate-limited)
┌───────────────▼─────────────────────────────────────────────────────┐
│  AI Orchestrator  services/ai_service.py                            │
│   • Authz + tenant scoping (reuse _scoped_event_rows)               │
│   • Prompt assembly from NORMALIZED telemetry ONLY                  │
│   • Provider dispatch: openai | anthropic | local | disabled        │
│   • Timeouts, retries, budget guard, fallback ladder                │
│   • Structured output parsing + validation                          │
│   • Full audit logging of every AI decision                         │
└───────┬──────────────────────────┬──────────────────────────────────┘
        │ rule layer (always on)   │ optional LLM layer
        ▼                          ▼
┌─ Deterministic Guard ─────┐  ┌─ Model Adapter (provider) ──────────┐
│ risk/severity/mitre/actor│  │ openai / anthropic / local(hosted)   │
│ rules run first, always  │  │ llm.py  •  always returns JSON         │
└───────┬──────────────────┘  └───────┬──────────────────────────────┘
        │                            │
        ▼                            ▼
 Outcome: attacker profile + risk emoji/score + AI brief + adaptive decoy instruction
                  (validated, canonicalized, audited)
```

### C.2 Provider choice notes (do not assume)

- **Hosted (OpenAI/Anthropic):** fastest to value, best quality, needs an API key secret + budget
  guard + cost persistence + outbound egress from backend. Fine for the expert advisor persona.
- **Local / self-hosted (e.g. a small hosted instruct model via Ollama/vLLM on the box, or a gateway):**
  removes the API-key requirement and data-egress concern → strong for judges (no third-party dependency,
  adversarial prompt budget zero cost). Needs CPU/RAM sizing on `72.61.248.44` and a docker service.
- **Hybrid (recommended):** try enabled LLM; on any failure/timeout/budget-exceed → **deterministic
  rule fallback** (still useful, never empty). This is the resilience story and mirrors how the decoys
  already degrade.

The design below is provider-agnostic: `services/llm.py` exposes one `complete(messages, schema) -> dict`
function; the provider is selected purely by config. This keeps the door open for hosted, local, or hybrid
without changing the rest of the system.

---

## D. Exact Files to Modify (existing)

| File | Change | Why |
|---|---|---|
| `backend/core/config.py` | Add: `AI_LLM_TIMEOUT_SECONDS`, `AI_LLM_MAX_RETRIES`, `AI_LLM_FALLBACK_ENABLED`, `AI_LLM_LOCAL_URL`(optional), `AI_ATTACKER_TEXT_MAX_CHARS`, `AI_STRUCTURED_OUTPUT` flag, `AI_BRIEF_MAX_INPUT_EVENTS`, persist knobs for cost (`AI_COST_PERSIST_FILE`). | Current block (302-314) lacks timeout/fallback/local/local persistence knobs. |
| `backend/core/health_monitor.py` | Report AI degredation state (enabled, keyed, provider, last-error, budget pct) instead of binary disabled. | Judges inspect health; current is coarse. |
| `backend/routers/ai.py` | Split: keep endpoints; delegate to `services/ai_service.py`; add `/ai/brief/{key}` and `/ai/profile/{key}`; make `_generate_local_response` a true structured deterministic fallback (return JSON, not canned text); persist cost. | Centralizes logic, removes dead placement code, adds grounded endpoints. |
| `backend/routers/telemetry.py` | Harden event text sanitization exposed to AI (`clean_event_text`), and have the brief surface call `ai_service.brief(...)` instead of the hardcoded `ai_summary` string. | Real grounding + injection hygiene. |
| `backend/services/adaptive_decoy.py` | Add an optional `llm_nudge` hook on `DecoySession`/engine that, when enabled & safe, suggests a deception-profile/storyboard shift fed by the validated AI profile; keep rule layer authoritative. | LLM becomes a suggestion layer over existing deterministic engine. |
| `frontend/src/AIAssistant.tsx` | Surface `response_source` and brief/profile outcomes; add a "grounded brief" panel fetching `/ai/brief/{key}`. | User-facing proof of AI grounding (judge-visible). |
| `docker-compose.yml` | Optionally add a `llm` (local-inference) service; add `AI_LLM_*` env to backend service; ensure outbound egress if hosted. | Deployment wiring. |

---

## E. New Files / Modules

| File | Purpose |
|---|---|
| `backend/services/ai_service.py` | Orchestrator: authz, tenant scoping, prompt assembly from normalized events, provider dispatch, fallback ladder, structured-output validation, audit log, budget guard. |
| `backend/services/llm.py` | Provider adapters behind one `complete(messages, schema)->dict`: `openai`, `anthropic`, `local` (hosted instruct), and `deterministic` fallback. No provider assumed at call sites. |
| `backend/services/threat_features.py` | Feature extraction from normalized events → dense, machine-readable vector (IPs, usernames, SQL-intent, TTPs, IoCs, session metrics). Pure, unit-testable, LLM-free. |
| `backend/services/attacker_profile.py` | Aggregates features across a session/IP/key into `AttackerProfile` (type, intent, risk, TTPs, decoy-recommendation). Rule-first, LLM-refined. |
| `backend/models/ai.py` | Pydantic schemas: `AIBrief`, `AttackerProfile`, `AIDecision`, `AIAuditEntry`, request/response models. |
| `backend/core/ai_persistence.py` | Persist cost counters, AI audit trail, generated profiles/briefs (reuse existing sqlite/db patterns) so AI decisions are accountable and survivable. |
| `backend/services/ai_guard.py` | The security-control layer: sanitize/reject attacker text, forbid secrets in prompts, enforce "advisory only", prompt-injection defense, output whitelist/validation before use. |
| `backend/tests/test_ai_layer.py` + fixtures | Unit/integration tests (see section H). |
| `.env` server-side | `AI_LLM_ENABLED=true` + provider/key (hosted) or local URL; never committed. |

---

## F. Data Flow (full, target state)

```
 Attacker Activity
      │        ▲  adaptive decoy response (validated)
      ▼        │
 ┌─ Honeypot / Decoy / Protocol + SSL decoys ─┐
 │ phpMyAdmin, WP, admin, XML-RPC, SSH, MySQL,│
 │ terminal-sandbox, cowrie, web lures        │
 └───────────────────┬────────────────────────┘
      ▼  capture_* / _insert_event (REAL today)
 ┌─ Event Storage: `events` table ─┐   (SQLite→Postgres on prod; normalized)
 │ normalized_event: ip, geo, url,│
 │ cmd, attacker_type, severity,   │
 │ score, mitre_*, captured_data   │
 └───────────────┬─────────────────┘
      ▼
 ┌─ Event Normalization ─ normalizes for human + AI (REAL today)
      ▼
 ┌─ Feature Extraction ─ services/threat_features.py (NEW)
 │ → IPs, usernames, SQL-intent, TTPs, IoCs, session metrics
      ▼
 ┌─ Threat / Behavior Analysis ─ deterministic rules (REAL today: severity,
 │ threat_score, actor classify)  +  LLM refinement of inferred intent
      ▼
 ┌─ LLM / AI Layer ─ services/ai_service.py (NEW)  ◄── ai_guard sanitizes input
 │  provider: openai | anthropic | local | deterministic-fallback
 │  structured JSON only; never executes attacker input
      ▼
 ┌─ Attacker Profile ─ services/attacker_profile.py (NEW)
 │  type, intent, TTPs, IoCs, confidence, decoy-recommendation
      ▼
 ┌─ Risk Score ─ blended (deterministic score + AI-inferred intent), audited
      ▼
 ┌─ AI Security Brief ─ /ai/brief/{key}, grounded in this tenant's events
      ▼
 ┌─ Adaptive Decoy Response ─ validated; rule layer authoritative;
 │  LLM may suggest profile/storyboard shift if guard approves
      ▼
 ┌─ Alert / Dashboard ─ WS + REST surfaces, audit log of AI decisions
```

**Key guarantee:** the rule layer always runs first and always produces a safe default. The LLM is
**advisory**, plugged in behind `ai_guard` validation. If the LLM is absent/slow/broken, the system
degrades to the current deterministic behavior — which already works in production.

---

## G. Security Controls (non-negotiable for this product)

1. **No secrets to the LLM.** Prompts must never contain `PROTOCOL_SHARED_SECRET`, DB creds, admin
   credentials, or any `.env` value. AI prompt builder only receives sanctioned normalized fields.
2. **Sanitize and minimize telemetry.** Only send the minimal needed fields. Cap attacker text length
   (`AI_ATTACKER_TEXT_MAX_CHARS`); strip control chars/NFKC; never send full `captured_data` blobs unless
   explicitly scoped.
3. **Attacker text is UNTRUSTED / prompt-injection defense.** All username/password/SQL/command/browser
   strings are treated as hostile. Wrap inputs as opaque `<data>` blocks, escape delimiters, and assert the
   model never echoes back or acts on instructions found inside them. If a prompt boundary is suspected,
   route to deterministic fallback.
4. **LLM must not execute attacker commands.** The AI layer only *produces advisories (JSON)*. Actual
   behavior changes (block IPs, shift decoy profile) are executed by deterministic code and only after
   `ai_guard` validation with allow-listed outcomes.
5. **Validate AI output before it touches the deception engine.** `ai_guard` schema-checks + whitelists
   every field (profile enum, storyboard stage enum, risk int in 0..100, allowed keys). Anything out of
   contract is rejected → fallback.
6. **Deterministic rules sit ABOVE the LLM.** Rules set the floor for safety and correctness; the LLM only
   refines/explains. This is the anti-hallucination posture.
7. **Timeouts / retries / rate limits / fallback / logging.** Per-request timeout + max retries;
   existing `build_rate_limit_dependency` for AI endpoints; cost budget guard (fail-closed at budget);
   full audit trail (who/which user/session/IP/query→decision, `AIAuditEntry`).
8. **Graceful degradation.** If provider errors, times out, budget exceeded, or validation fails → fall
   back to deterministic response, set `response_source=failover`, and log. Never 5xx because the LLM is
   flaky.
9. **Budget must be persistent and enforceable.** Move cost counters out of in-memory globals into
   `ai_persistence` so budget survives restart and cannot be silently bypassed.
10. **Tenant isolation.** AI endpoints reuse `_scoped_event_rows`/`_site_ids_for_user` so one tenant can
    never get another tenant's events into a prompt. AI audit entries inherit the same scoping.

---

## H. Testing Strategy

**Unit (no network):** `threat_features` extraction; attacker profiling math; `ai_guard` sanitize/injection
rejection (known malicious prompts); fallback ladder resolution; validation of structured LLM output
(bad shape → fallback). Use a fake provider that returns scripted JSON and one that raises/timeouts.

**Integration (against local DB):** seed `events` rows for a tenant → `/ai/brief/{key}` returns JSON
grounded in exactly those rows → assert tenant-scoping (user A cannot brief user B's events). Test
`/ai/expert-advisor` with provider disabled vs enabled. Persist cost and assert budget guard triggers.

**Adversarial:** inject prompt-injection strings into attacker fields and assert the model stays within
the boundary (deterministic fallback selected when injection suspected). Assert no secret can ever appear
in an outgoing prompt (grep the assembled message for known .env values).

**CI/smoke:** the deploy path already runs a smoke test (`--skip-smoke` off); extend it to hit
`/ai/status` (expect degraded-but-200) and one grounded brief.

**Live demo proof:** generate one real `events` row via a decoy hit, call `/ai/brief`, assert the brief
references that actual path/technique (grounding, not hallucination).

---

## I. Deployment Requirements

- **Hosted path:** inject `AI_LLM_ENABLED=true`, `AI_LLM_PROVIDER`, `AI_LLM_MODEL`, `AI_LLM_API_KEY` into
  the server-side `/root/ai-honeypot-fullstack/.env` (never into the git bundle; `.env` is preserved by
  `remote_redeploy.py`). Rebuild + restart backend via the existing paramiko deploy script. Ensure the
  backend container has outbound HTTPS egress for the provider.
- **Local path:** add an `llm` service to `docker-compose.yml` (sized for the box's CPU/RAM), set
  `AI_LLM_PROVIDER=local` + `AI_LLM_LOCAL_URL`, keep key absent. Verify startup memory and first-token
  latency on `72.61.248.44`.
- **Persistence:** ensure `ai_persistence` table auto-migrates (mirror existing schema bootstrap in
  `core/database.py`).
- **Secrets hygiene:** NEVER put `AI_LLM_API_KEY` in the bundle; reuse `read_secret` so `$`-containing
  keys are read from file, dodging compose interpolation mangling (matching the earlier SECRET_KEY lesson).
- **Health:** after deploy, `https://cybersentil.online` health endpoint + `/ai/status` (authed) must
  report degraded-but-operational even before a provider key is added.

---

## J. Demo Scenario — "AI detects the attacker and adapts a decoy"

1. Operator is authenticated on the dashboard.
2. A real attacker (or a scripted probe) hits the phpMyAdmin decoy: wrong `admin`/`root` password 6x,
   then a `SELECT * FROM users` after a fake successful login.
3. `telemetry.py` captures 6 login events + 1 SQL event → `events` rows (severity high, score rises).
4. `threat_features` extracts: IP, `admin` username, SQL-intent on `users`, brute-force sequence.
5. Deterministic rules classify actor = **brute_forcer**; storyboard advances to **CREDENTIAL_GATE**.
6. `ai_service` (LLM, host provider) grounds on this tenant's rows and returns a structured `AIBrief`:
   "Brute-force credential attack against phpMyAdmin from IP X; DROP/privilege-escalation intent;
   recommend escalating to deep-interaction decoy and flag IP for blocking."
7. `ai_guard` validates the decision (profile enum valid, risk 0..100, keys allow-listed) → approved.
8. The adaptive engine shifts THIS session's deception profile to **deep_interaction** and, because the
   attacker is now "authenticated," begins answering metadata/SQL queries with deeper fake data —
   keeping them engaged and harvesting more TTPs/IoCs.
9. Dashboard + WS alert show the grounded brief and the profile shift; the decision is in the AI audit log.
10. Whole process shown live in the competition demo — **the AI visibly changed the decoy's behavior in
    response to the attacker's actual actions**, with rules as the safety floor.

This is the concrete, demonstrable "AI-Enhanced" differentiator: **adaptive deception driven by a
validated, telemetry-grounded AI loop**, built on top of the interaction engine that already runs in
production.

---

## K. Recommendation / Next Steps (awaiting approval)

Phase 1 (Fix First, already approved to start but paused): regenerate `$`-free secrets, redeploy.
Phase 2 (AI, this doc): implement `threat_features` → `ai_guard` → `ai_service`/`llm` → `attacker_profile`
→ brief/adapt endpoints → persistence → tests → wire `adaptive_decoy` nudge → deploy with a provider.

**No files were changed by this analysis. Implementation begins only after explicit approval and
provider decision (hosted / local / hybrid).**
