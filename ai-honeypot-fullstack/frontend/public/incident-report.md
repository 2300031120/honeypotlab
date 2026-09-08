# CyberSentinel Incident Walkthrough

Product: CyberSentinel
Scenario: Exposed login, admin, and API route reconnaissance
Report type: Product proof report
Status: Proof artifact for evaluation

## Executive Summary

During a guided pilot scenario, the platform observed a suspicious source touching a decoy login route, pivoting to an admin-style path, and then probing an internal-looking API export route. The sequence was captured inside the deception layer before the real production workflow was reached.

The value of the incident was not only that the interaction was detected, but that the behavior could be preserved in a readable path for operators and analysts:

- First suspicious touch appeared on a decoy login route
- Follow-up movement targeted an admin-style surface
- The source then probed an API-looking export path
- The analyst brief classified the pattern as credential-access reconnaissance

## Incident Snapshot

- Suspicious source: 198.51.100.24
- Session window: 13 minutes
- Exposed surfaces touched: 3 decoy routes
- Severity: High
- Analyst verdict: Credential-access reconnaissance

## Observed Route Sequence

1. `/login-shadow`
2. `/admin/login-shadow`
3. `/api/internal/export`

The route order suggests the actor was mapping exposed entry points and checking whether believable credential surfaces existed behind the public edge.

## Analyst Interpretation

The sequence fits a common early recon pattern:

- Identify a login-style entry point
- Check for adjacent admin exposure
- Probe an internal-looking API route for weak controls or data export behavior

Because the interaction landed in the deception layer, the operator team received a cleaner trail than they would from scattered production logs alone.

## Recommended Actions

1. Review real public login, admin, and API routes for unnecessary exposure.
2. Align WAF or edge controls with the route types the actor touched first.
3. Confirm alert routing and analyst handoff for similar recon sessions.
4. Use the same evidence path to brief leadership or customer-facing stakeholders.

## Why This Report Exists

This file is a proof artifact for product evaluation. It is not presented as a named customer report. It exists so buyers can judge whether the product produces clear, usable incident output after suspicious route activity.
