# Adaptive Web Decoy Architecture (FastAPI + phpMyAdmin-like Surface)

## Goal
Build a high-interaction web honeypot where FastAPI is the control plane and telemetry layer, and phpMyAdmin is a decoy presentation surface only.

## Implemented in this repository

### Control plane and telemetry
- FastAPI routes, middleware, and event logging remain centralized in `backend/main.py`.
- HTTP decoy interactions continue to use `log_http_trap(...)` for:
  - event persistence
  - risk/scoring metadata
  - WebSocket broadcast
  - SIEM forwarding hooks

### Adaptive decoy engine
- New module: `backend/services/adaptive_decoy.py`
- Responsibilities:
  - session state tracking (request count, login attempts, SQL attempts, visited paths)
  - actor classification (`scanner`, `brute_forcer`, `manual_operator`, `exploratory_user`)
  - deception profile selection (`minimal_surface`, `credential_sink`, `deep_interaction`, etc.)
  - storyboard progression (`surface_recon` → `credential_gate` → `metadata_discovery` → `sql_interaction` → `bounded_execution_guard`)
  - deterministic fake metadata generation per session
  - bounded SQL emulation (`SHOW DATABASES`, `SHOW TABLES`, `SELECT`, `DESCRIBE`, safe `USE`)
  - explicit blocking of destructive SQL patterns

### Decoy presentation layer
- Upgraded routes:
  - `GET /phpmyadmin/` (adaptive login surface)
  - `GET /phpmyadmin/index.php` (adaptive fake database browser)
  - `POST /phpmyadmin/index.php` (credential capture + adaptive auth response)
  - `GET /phpmyadmin/sql.php` (fake SQL console)
  - `POST /phpmyadmin/sql.php` (query capture + bounded SQL simulation)
  - `GET /phpmyadmin/tables.php` (database explorer)
  - `GET /phpmyadmin/table.php` (table viewer)
  - `GET /phpmyadmin/import-export.php` (import/export page)
  - `GET /phpmyadmin/sessions.php` (active sessions page)
  - `GET /phpmyadmin/intrusion.php` (intrusion analysis page)
  - `GET /phpmyadmin/alerts.php` (alert popup page)
- These routes render fake phpMyAdmin-like pages from controlled templates in `adaptive_decoy.py` and never execute real administrative SQL.

### Evaluation metrics for research
- New endpoint: `GET /deception/adaptive/metrics` (authenticated analyst view)
- Live metrics include:
  - average dwell time
  - interaction steps
  - unique SQL actions
  - repeat-visit rate
  - probable fingerprinting-success rate
  - analyst usefulness score

### A/B/C experiment runner
- `POST /research/experiments/run` executes three variants:
  - Version A: static decoy
  - Version B: semi-dynamic decoy
  - Version C: adaptive decoy
- `GET /research/experiments/latest` returns the latest run.
- `GET /research/experiments/{run_id}` returns a specific run.
- Each run includes per-variant metrics and comparison deltas versus static baseline.

## Safety boundaries
- Decoy SQL execution is simulated only.
- Destructive statements return controlled permission errors.
- No real phpMyAdmin instance is exposed.
- Real telemetry is captured while interaction side effects remain fake and bounded.

## Next evolution steps
1. Move HTML rendering from string templates to Jinja templates under `backend/templates/`.
2. Add Redis-backed decoy session state for multi-instance deployments.
3. Add explicit ATT&CK mapping for each decoy interaction type.
4. Add analyst replay view focused on decoy SQL timelines.
