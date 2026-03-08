# 90-Day Roadmap: AI-Enhanced High-Interaction Dynamic Deception

## Timeline
- Start date: `March 5, 2026` (Day 1)
- End date: `June 2, 2026` (Day 90)
- Total window: `90 calendar days`

## Goal
Deliver a production-ready deception platform on top of this codebase with:
- High-interaction `SSH` and `MySQL` modules.
- Dynamic posture control and explainable auto-tuning.
- ATT&CK-aligned analytics and STIX/TAXII interoperability.
- Hardened operations, observability, and release runbooks.

## Baseline (Already Present)
- Deception state and auto-mode flow in `backend/main.py`.
- Core services in `backend/services/`.
- Rich event telemetry model in `backend/models.py`.
- Frontend deception controls in `frontend/src/DeceptionConfig.jsx`.

## Success Gates By Day 90
- SSH command realism score: `>= 85%` on recon command test set.
- MySQL recon query realism score: `>= 80%`.
- Auto-tune reaction latency after risk spike: `< 60 seconds`.
- End-to-end protocol coverage: `HTTP + SSH + MySQL`.
- STIX 2.1 bundle generation and TAXII 2.1 collection exchange: `pass`.
- False-positive blocking on benign traffic replay: `< 3%`.

## Workstreams
1. Protocol Engine
2. Session Orchestration and Replay
3. Dynamic Deception and Policy
4. SOC UI and Operator Controls
5. Security Isolation and Hardening
6. CTI Export and ATT&CK Analytics
7. QA, Red-Team Validation, and Release

## Phase Milestones
- Milestone A (Day 30, April 3, 2026): SSH v1 + session telemetry + safety rails done.
- Milestone B (Day 60, May 3, 2026): MySQL v1 + dynamic control v2 + observability done.
- Milestone C (Day 90, June 2, 2026): STIX/TAXII + ATT&CK analytics + release hardening done.

## Detailed 90-Day Plan

### Week 1 (Day 1-7, Mar 5 - Mar 11)
- Day 1: Confirm architecture, freeze scope, and create task board with Milestone A/B/C epics.
- Day 2: Create `backend/services/protocols/` package and module registry contract.
- Day 3: Implement protocol base interface (`start`, `stop`, `health`, `handle_session`).
- Day 4: Wire protocol lifecycle startup/shutdown hooks in `backend/main.py`.
- Day 5: Add config toggles for protocol enablement and port bindings.
- Day 6: Build protocol health endpoint skeleton (`GET /protocols/status`).
- Day 7: Add CI checks for new protocol package imports and startup sanity.

### Week 2 (Day 8-14, Mar 12 - Mar 18)
- Day 8: Create session orchestrator skeleton for common session lifecycle management.
- Day 9: Add per-session quotas (CPU, memory, max duration) in orchestrator policy layer.
- Day 10: Add transcript storage model and migration plan.
- Day 11: Extend `Event` schema for `protocol`, `session_phase`, `command_status`, `transcript_id`.
- Day 12: Implement transcript signing utility and integrity metadata generation.
- Day 13: Add replay artifact writer with compressed transcript payload.
- Day 14: Unit test session lifecycle, transcript signing, and schema writes.

### Week 3 (Day 15-21, Mar 19 - Mar 25)
- Day 15: Scaffold SSH interaction module with listener and session accept loop.
- Day 16: Implement SSH persona banner and prompt profile selection.
- Day 17: Add credential capture flow and login attempt telemetry.
- Day 18: Implement deterministic command map v1 for core recon commands.
- Day 19: Add command classifier (`safe_recon`, `suspicious`, `destructive`).
- Day 20: Integrate AI response path with strict timeout and fallback ordering.
- Day 21: Add response source tagging (`emulated`, `llm`, `sandbox`, `blocked`) to event stream.

### Week 4 (Day 22-28, Mar 26 - Apr 1)
- Day 22: Build contained execution adapter interface for approved command class.
- Day 23: Enforce egress deny policy and readonly base filesystem profile.
- Day 24: Add SSH session replay API and operator lookup by `session_id`.
- Day 25: Add protocol metrics counters (sessions, errors, latency).
- Day 26: Build frontend protocol status cards in `DeceptionConfig.jsx`.
- Day 27: Integrate SSH signals into auto-tune posture calculation.
- Day 28: Run 25-concurrent SSH load test and fix top stability bottlenecks.

### Week 5 (Day 29-35, Apr 2 - Apr 8)
- Day 29: Run 50-concurrent SSH load test and tune memory/timeouts.
- Day 30: Milestone A gate review and close blocking defects.
- Day 31: Scaffold MySQL module listener and connection accept loop.
- Day 32: Implement MySQL handshake and server fingerprint persona.
- Day 33: Add MySQL auth trap flow and failed login telemetry.
- Day 34: Implement query dispatcher for deterministic query templates.
- Day 35: Add support for `SHOW DATABASES`, `SHOW TABLES`, `SELECT VERSION()`.

### Week 6 (Day 36-42, Apr 9 - Apr 15)
- Day 36: Add INFORMATION_SCHEMA query emulation templates.
- Day 37: Build honey dataset generator for decoy schemas and records.
- Day 38: Add MySQL query classifier and risk scoring integration.
- Day 39: Integrate AI fallback for unknown, low-risk read queries.
- Day 40: Add realistic reject path for destructive writes/DDL attempts.
- Day 41: Wire MySQL telemetry to shared session orchestrator and replay store.
- Day 42: Add module toggle and profile endpoints for MySQL in control plane.

### Week 7 (Day 43-49, Apr 16 - Apr 22)
- Day 43: Add frontend controls for MySQL enable/disable and persona selection.
- Day 44: Add posture explainability API fields (`reasons`, `confidence`, `samples`).
- Day 45: Display posture trend + reason codes in frontend dashboard.
- Day 46: Add feature store table for auto-tune inputs across protocols.
- Day 47: Add weighted auto-tune scoring function calibration script.
- Day 48: Build replay-driven simulation harness for posture testing.
- Day 49: Execute simulation batch and tune threshold defaults.

### Week 8 (Day 50-56, Apr 23 - Apr 29)
- Day 50: Refine block/observe policy split for intel collection preservation.
- Day 51: Add sandbox seccomp profile and restricted syscall set.
- Day 52: Add sandbox escape negative test suite.
- Day 53: Add chaos test for protocol crash/restart resilience.
- Day 54: Add metrics endpoint for protocol SLOs and error budgets.
- Day 55: Add alert rules for crash loops, latency spikes, and transcript failures.
- Day 56: Add auth abuse rate-limits and IP throttling controls.

### Week 9 (Day 57-63, Apr 30 - May 6)
- Day 57: Add multi-tenant isolation checks for protocol data paths.
- Day 58: Run operator UAT for SSH and MySQL workflows.
- Day 59: Fix UAT defects, close P1 and P2 issues.
- Day 60: Milestone B gate review and release candidate cut for integration branch.
- Day 61: Scaffold STIX mapping service and bundle builder.
- Day 62: Map `Event` data to STIX `observed-data` and `indicator` objects.
- Day 63: Add session and threat relationships for ATT&CK-linked STIX output.

### Week 10 (Day 64-70, May 7 - May 13)
- Day 64: Add STIX export endpoint and signed bundle download support.
- Day 65: Implement TAXII discovery and API root endpoints.
- Day 66: Implement TAXII collections endpoint and metadata.
- Day 67: Implement TAXII objects endpoint with pagination/filtering.
- Day 68: Add TAXII auth mode and token validation.
- Day 69: Validate STIX/TAXII output against conformance tooling.
- Day 70: Add ATT&CK ruleset mapping for command/query/url telemetry.

### Week 11 (Day 71-77, May 14 - May 20)
- Day 71: Add ATT&CK confidence scoring and reason metadata.
- Day 72: Add backend ATT&CK analytics endpoint (counts, trends, confidence).
- Day 73: Add frontend ATT&CK table and heatmap visualization.
- Day 74: Add filters for time range, protocol, severity, and site.
- Day 75: Build combined ATT&CK + STIX intelligence report export.
- Day 76: Prepare red-team attack scripts for SSH/MySQL deception validation.
- Day 77: Run scripted adversary tests and capture realism/latency metrics.

### Week 12 (Day 78-84, May 21 - May 27)
- Day 78: Analyze adversary test gaps and prioritize realism fixes.
- Day 79: Patch SSH command fidelity gaps and improve deterministic outputs.
- Day 80: Patch MySQL query fidelity gaps and decoy dataset realism.
- Day 81: Optimize response latency through cache and timeout tuning.
- Day 82: Run human attacker pilot sessions and record operator feedback.
- Day 83: Apply pilot feedback to interaction logic and UI workflows.
- Day 84: Run full regression across APIs, protocols, and frontend flows.

### Week 13 (Day 85-90, May 28 - Jun 2)
- Day 85: Finalize operations runbook, on-call playbook, and incident SOPs.
- Day 86: Execute deployment hardening checklist and secret/key rotation drill.
- Day 87: Validate backup/restore and transcript integrity recovery procedures.
- Day 88: Create release candidate, freeze non-critical changes, start soak.
- Day 89: Run final acceptance test against Day 90 success gates.
- Day 90: Go-live handoff, KPI report, and next-90-day backlog definition.

## Exit Criteria By Milestone

### Milestone A Exit (Day 30)
- SSH high-interaction v1 runs stable at 50 concurrent sessions.
- Session replay artifacts generated for at least 95% of sessions.
- Sandbox policy blocks disallowed commands and logs all decisions.

### Milestone B Exit (Day 60)
- MySQL emulation handles top recon query set with believable responses.
- Dynamic posture updates use cross-protocol features and reason codes.
- SOC UI supports protocol toggle, posture monitoring, and live health.

### Milestone C Exit (Day 90)
- STIX 2.1 bundle export and TAXII 2.1 collection exchange both pass validation.
- ATT&CK analytics visible in dashboard and export payload.
- Release hardening checklist fully closed and signed off.

## Delivery Artifacts
- Code modules: protocol interfaces, SSH/MySQL handlers, replay/session services.
- Database: schema migrations for protocol telemetry and transcript metadata.
- APIs: protocol controls, session termination, STIX/TAXII endpoints.
- Frontend: module health cards, posture explainability, ATT&CK views.
- QA assets: load tests, red-team scripts, regression suite.
- Operations: runbooks, incident SOPs, deployment checklist.

## Tracking Template (Use Daily)
Copy this for each day in your issue tracker:

```text
Day:
Date:
Planned Deliverable:
Actual Deliverable:
Blocking Issue:
Test Evidence:
Status: complete | partial | blocked
```

## Risk Triggers and Fallbacks
- Trigger: LLM timeout rate exceeds 20% in active sessions.
  - Fallback: force deterministic response mode for top command/query sets.
- Trigger: Sandbox crash loop appears in 3 consecutive runs.
  - Fallback: disable sandbox execution path, keep emulation + telemetry mode.
- Trigger: False-positive block rate above 3%.
  - Fallback: switch to observe-only mode until threshold recalibration completes.
- Trigger: STIX/TAXII validation fails near release freeze.
  - Fallback: ship read-only STIX export first, defer TAXII write path one sprint.
