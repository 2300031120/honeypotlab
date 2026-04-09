import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  Database,
  Link2,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { PUBLIC_SITE } from "./siteConfig";
import { trackCtaClick } from "./utils/analytics";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

const INTEGRATION_BADGES = [
  "X-API-Key ingest",
  "Node / PHP / Python templates",
  "Cloudflare Worker relay",
  "M365 Logic App",
  "Splunk HEC validation",
  "Ops readiness",
];

const INTEGRATION_SIGNALS = ["Live telemetry intake", "Provider-ready templates", "Operator verification path"];

const INTEGRATION_CHECKLIST = [
  "Create a site, issue an API key, and send customer telemetry to a controlled ingest path",
  "Relay edge and provider alerts with repo-backed templates instead of rebuilding the payload contract",
  "Verify incoming events inside telemetry, forensics, and readiness workflows after deployment",
];

const CONNECTORS = [
  {
    title: "Customer websites and APIs",
    detail: "Send suspicious requests, auth failures, edge hits, and custom app telemetry to POST /api/ingest using the per-site API key.",
    icon: <Link2 size={18} />,
  },
  {
    title: "Cloudflare edge signals",
    detail: "Use the included Worker relay template to forward edge request intelligence and WAF-style events into the platform.",
    icon: <Cloud size={18} />,
  },
  {
    title: "Microsoft 365 alerts",
    detail: "Forward defender-style alerts with the Logic App HTTP action template so high-value provider signals land in the same event stream.",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "Splunk validation path",
    detail: "Validate HEC routing and environment settings with the included scripts before you depend on outbound event delivery.",
    icon: <Database size={18} />,
  },
  {
    title: "Analyst workflows",
    detail: "Review the result in /telemetry, /forensics/detail, and /ops/readiness after live or seeded events arrive.",
    icon: <Workflow size={18} />,
  },
  {
    title: "Bootstrap scripts",
    detail: "Use the one-command bootstrap flow to log in, create a site, rotate the key, and send seed events for a first proof run.",
    icon: <ArrowRight size={18} />,
  },
];

const INTEGRATION_FLOW = [
  {
    title: "Create the site and key",
    detail: "Use the authenticated site flow to generate the tenant API key and bind events to the correct environment.",
  },
  {
    title: "Push or relay events",
    detail: "Send traffic from your app, Cloudflare edge, M365, or other upstream systems into the shared ingest contract.",
  },
  {
    title: "Verify the workflow",
    detail: "Confirm events appear in telemetry, replay, and readiness views before calling the rollout done.",
  },
];

const INTEGRATION_NOTES = [
  "Bootstrap scripts in deploy/scripts/",
  "Provider templates in deploy/integrations/",
  "Production runbook in docs/CUSTOMER_WEBSITE_INTEGRATION_PACK.md",
];

export default function Integrations() {
  usePageAnalytics("integrations");
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;
  useSeo({
    title: `Integrations | ${PUBLIC_SITE.siteName}`,
    description: `See how ${productName} connects customer apps, edge telemetry, provider alerts, and analyst workflows.`,
    ogTitle: `${PUBLIC_SITE.siteName} Integrations`,
    ogDescription: "Website ingest, Cloudflare, Microsoft 365, Splunk validation, and operator verification in one path.",
  });

  return (
    <div className="marketing-shell">
      <PublicHeader variant="cred" pagePath="/integrations" />
      <main className="marketing-main">
        <section className="marketing-hero">
          <article className="marketing-card marketing-hero-copy">
            <div className="marketing-badge">Integrations</div>
            <div className="marketing-hero-signal">
              {INTEGRATION_SIGNALS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <h1 className="marketing-title">Connect websites, edge signals, and analyst workflows without rebuilding your whole stack.</h1>
            <p className="marketing-subtitle">
              {productName} already includes a site-key ingest contract, customer app templates, Cloudflare and Microsoft 365 relay
              patterns, and a practical verification flow so teams can move from “connected” to “proved” with less friction.
            </p>
            <div className="marketing-inline-points">
              {INTEGRATION_BADGES.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="marketing-actions">
              <Link to="/resources" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("view_resources", "/integrations")}>
                Open Resources <ArrowRight size={16} />
              </Link>
              <Link to="/demo" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("request_demo", "/integrations")}>
                Request Demo
              </Link>
            </div>
            <div className="marketing-hero-story">
              <div className="marketing-hero-story-head">
                <span className="marketing-kicker">What teams get</span>
                <strong>The platform already has a concrete path from upstream signal to operator review.</strong>
              </div>
              <ul className="marketing-checklist marketing-checklist-compact">
                {INTEGRATION_CHECKLIST.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <aside className="marketing-card marketing-hero-panel marketing-architecture-panel">
            <div className="marketing-panel-head">
              <div>
                <div className="marketing-kicker">Reference integration flow</div>
                <h3>From source system to analyst screen</h3>
              </div>
            </div>
            <div className="marketing-system-flow">
              {INTEGRATION_FLOW.map((item, index) => (
                <div key={item.title} className="marketing-system-flow-step">
                  <span className="marketing-system-flow-index">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
              ))}
            </div>
            <div className="marketing-panel-mini-grid">
              <div className="marketing-panel-mini-card">
                <span>Primary intake</span>
                <strong>POST /api/ingest + X-API-Key</strong>
              </div>
              <div className="marketing-panel-mini-card">
                <span>Verification path</span>
                <strong>Telemetry, Forensics, Ops</strong>
              </div>
            </div>
            <div className="marketing-summary">
              <div className="marketing-summary-head">
                <Workflow size={16} />
                <span>Ready integration assets</span>
              </div>
              <p>The repo already contains templates, bootstrap scripts, and verification steps for the first live integration pass.</p>
            </div>
            <div className="marketing-mini-pill-row">
              {INTEGRATION_NOTES.map((item) => (
                <span key={item} className="marketing-mini-pill">
                  {item}
                </span>
              ))}
            </div>
          </aside>
        </section>

        <section className="marketing-card marketing-live-ribbon">
          <div className="marketing-live-ribbon-head">
            <Link2 size={15} />
            <strong>Supported integration direction</strong>
          </div>
          <div className="marketing-live-ribbon-stream">
            <div className="marketing-live-pill-item">
              <span>Apps</span>
              <code>{"Web app telemetry -> site ingest"}</code>
            </div>
            <div className="marketing-live-pill-item">
              <span>Edge</span>
              <code>{"Cloudflare worker -> ingest relay"}</code>
            </div>
            <div className="marketing-live-pill-item">
              <span>Analyst</span>
              <code>{"Telemetry -> Forensics -> Ops readiness"}</code>
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>What connects today</p>
            <h2>Use the product with real upstream systems, not just a standalone dashboard.</h2>
          </div>
          <div className="marketing-grid-3">
            {CONNECTORS.map((item) => (
              <article key={item.title} className="marketing-card marketing-feature">
                <div className="marketing-icon-box">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-split-proof">
            <article className="marketing-card marketing-showcase marketing-proof-copy-card">
              <p className="marketing-kicker">Practical rollout</p>
              <h3>Best when integration and analyst validation happen in the same sprint.</h3>
              <p>
                The strongest rollout is not just “we sent an event.” It is “we connected the source, confirmed the event,
                and saw it flow into the analyst workflow with enough context to act.”
              </p>
            </article>
            <article className="marketing-card marketing-list-card">
              <ul className="marketing-list">
                <li className="simple"><span>01</span><strong>Create site and rotate the API key safely</strong></li>
                <li className="simple"><span>02</span><strong>Seed Cloudflare or M365 style events to prove intake</strong></li>
                <li className="simple"><span>03</span><strong>Verify the result in telemetry, forensics, and readiness checks</strong></li>
              </ul>
            </article>
          </div>
        </section>

        <section className="marketing-card marketing-cta">
          <div className="marketing-cta-copy">
            <h2>Need help choosing the first integration path?</h2>
            <p>We can map customer apps, edge relays, and verification steps into a rollout that proves value quickly.</p>
          </div>
          <div className="marketing-actions">
            <Link to="/resources" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("view_resources", "/integrations")}>
              Open Resources
            </Link>
            <Link to="/contact" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("contact_team", "/integrations")}>
              Contact Team
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
