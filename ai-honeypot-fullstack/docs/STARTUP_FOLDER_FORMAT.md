# Startup Folder Format (Operational Layout)

This structure keeps the project clear for startup execution, product demos, and security operations.

## Recommended layout

```text
ai-honeypot-fullstack/
  backend/
    config/
      deception_profiles.json
    services/
    sql/
    tests/
    main.py
    models.py
  frontend/
    src/
    public/
  deploy/
    scripts/
  docs/
    STARTUP_FOLDER_FORMAT.md
    ADAPTIVE_WEB_DECOY_ARCHITECTURE.md
```

## Folder purpose

- `backend/config/`: source-of-truth configs used by APIs and control-plane logic.
- `backend/services/`: runtime engines (AI, deception, protocols, telemetry processing).
- `backend/tests/`: matrix + integration + regression tests.
- `frontend/src/`: website, funnel pages, admin CRM, telemetry dashboard UI.
- `deploy/scripts/`: operational scripts for deployment and environment tasks.
- `docs/`: product architecture, runbooks, and startup execution playbooks.

## Trend-aligned modules

- Dynamic web decoys: `web_admin_dynamic`
- API deception mesh: `api_honeymesh`
- Cloud/SaaS decoy surface: `cloud_console_clone`
- Canary + bait file tracking: `bait_file_trap`

These are managed in:

- `backend/config/deception_profiles.json`
- `GET /deception/profiles` (admin)

## Why this helps startup teams

- Product team: clear place for features and profile updates.
- Security team: fast visibility into supported deception patterns.
- Founder/ops: cleaner release and handoff process.
