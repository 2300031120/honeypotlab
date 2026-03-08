# Technical Spec: High-Interaction SSH + MySQL Modules

## Objective
Add dynamic, high-interaction SSH and MySQL deception modules that plug into the existing control plane and event model.

## In-Scope
- SSH listener with realistic shell interaction.
- MySQL listener with realistic handshake/auth/query behavior.
- Integration with existing auto-tune posture controls.
- Unified session telemetry and replay artifacts.

## Out-of-Scope (v1)
- Full Linux command fidelity.
- Full MySQL SQL engine implementation.
- Production multi-region deployment.

## Architecture

### New Components
1. `backend/services/protocols/base.py`
   - Defines `ProtocolModule` interface:
     - `start()`, `stop()`
     - `health()`
     - `handle_session(context)`
2. `backend/services/protocols/ssh_interaction.py`
   - SSH transport + pseudo-TTY + command pipeline.
3. `backend/services/protocols/mysql_interaction.py`
   - MySQL handshake/auth/query dispatcher.
4. `backend/services/session_orchestrator.py`
   - Shared session lifecycle, quotas, transcript signing, and event publishing.
5. `backend/services/replay_store.py`
   - Stores compressed per-session transcript and metadata.

### Existing Files to Integrate
- `backend/main.py`
  - Register module lifecycle on startup/shutdown.
  - Add protocol status endpoints and operator control endpoints.
- `backend/models.py`
  - Extend `Event` with protocol metadata fields.
- `frontend/src/DeceptionConfig.jsx`
  - Add protocol module status, error count, and active sessions.

## Data Model Changes
Add fields to `Event`:
- `protocol` (`ssh`, `mysql`, `http`).
- `session_phase` (`handshake`, `auth`, `interaction`, `exit`).
- `command_status` (`emulated`, `llm`, `sandbox`, `blocked`).
- `response_latency_ms` (int).
- `transcript_id` (string).

Add new table `session_transcripts`:
- `id`, `session_id`, `protocol`, `started_at`, `ended_at`.
- `artifact_path`, `sha256`, `signing_key_id`.
- `risk_summary`, `attacker_profile`.

## SSH Module Behavior

### Session Flow
1. Banner/profile selected from active deception posture.
2. Credential trap accepts configured weak credentials and records attempts.
3. Shell prompt issued; commands sent through pipeline:
   - Step A: deterministic emulation map.
   - Step B: AI-generated response (if enabled and within timeout).
   - Step C: contained execution for approved command class only.
4. Response tagged with source (`emulated`, `llm`, `sandbox`).
5. Session ends on timeout, disconnect, or high-risk policy trigger.

### Command Classes
- `safe_recon`: `whoami`, `uname -a`, `ls`, `cat`, `pwd`, `id`.
- `suspicious`: download or privilege probes.
- `destructive`: disk wipe, crypto-mining setup, fork bombs.

Policy:
- `safe_recon`: allow and enrich.
- `suspicious`: allow with synthetic friction, increase telemetry.
- `destructive`: block or sandbox-returned synthetic failures based on posture.

## MySQL Module Behavior

### Session Flow
1. Realistic server greeting and version fingerprint.
2. Authentication capture with configurable weak account responses.
3. Query dispatcher handles:
   - Metadata queries (`SHOW DATABASES`, `SHOW TABLES`, `SELECT VERSION()`).
   - Common enumeration (`INFORMATION_SCHEMA` reads).
4. Returns curated decoy datasets with honey rows and trace markers.
5. Logs query path, intent score, and response source.

### Response Strategy
- Use deterministic templates for top query patterns.
- AI-generated table/row responses only for unknown but low-risk queries.
- Reject destructive writes with realistic permission or lock errors.

## Control Plane API Additions

In `backend/main.py`:
- `GET /protocols/status`
  - Returns per-module health, active sessions, error rates.
- `POST /protocols/{name}/toggle`
  - Enables/disables module (`ssh`, `mysql`).
- `POST /protocols/{name}/profile`
  - Updates fingerprint profile (OS distro, MySQL version persona).
- `POST /sessions/{session_id}/terminate`
  - Manual operator termination.

## Security and Isolation Requirements
- Contained execution runs in ephemeral container/jail:
  - no outbound network,
  - read-only base image,
  - writable temp volume only,
  - per-session CPU/memory/time limits.
- Strict command allowlist for any contained execution path.
- Signed transcript artifacts for forensic integrity.

## Observability
- Metrics:
  - sessions started/completed by protocol,
  - mean response latency by source path,
  - command class distribution,
  - posture transition count,
  - block/allow ratio.
- Logs:
  - structured JSON for all session events.
- Alerts:
  - spike in destructive commands,
  - module crash loop,
  - transcript write failures.

## Testing Strategy
- Unit tests:
  - command/query classifier,
  - posture-based policy decisions,
  - response fallback ordering.
- Integration tests:
  - SSH handshake/auth/session lifecycle.
  - MySQL handshake/query lifecycle.
- Load tests:
  - 100 concurrent SSH and 100 concurrent MySQL sessions.
- Red-team acceptance:
  - realism score rubric, response latency, analyst usefulness.

## Acceptance Criteria (v1)
- SSH: supports at least 75 common attacker recon commands with plausible outputs.
- MySQL: supports top enumeration/auth probes with believable schema responses.
- Protocol modules controllable from existing frontend panel.
- Every session produces a replay artifact and normalized event records.
- Dynamic auto-tune can alter protocol behavior profile without restart.
