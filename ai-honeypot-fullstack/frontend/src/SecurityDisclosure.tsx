import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Database, Lock, Server, ShieldCheck } from "lucide-react";
import { PUBLIC_SITE, toMailto } from "./siteConfig";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import PublicHeader from "./PublicHeader";
import PublicFooter from "./PublicFooter";

const SAFETY_SIGNALS = ["Isolated deployment", "No inline production replacement", "Controlled evidence retention", "Integrity-backed report path"];

const TRUST_POINTS = [
  "Deception routes are deployed around exposed surfaces, not as a replacement for the real production service.",
  "The platform is built to observe and preserve attacker behavior, not to execute attack-back or retaliation workflows.",
  "Operator access is authenticated, rate limited, and scoped to the workspace handling the deployment.",
  "Guided rollout focuses on believable coverage, clear evidence, and low-friction handoff to security teams.",
];

const SAFETY_CARDS = [
  {
    title: "Deployment isolation",
    detail: "Decoy login, admin, and API routes are meant to sit beside the public edge in a controlled layer. The goal is earlier visibility, not inline replacement of the production app.",
    icon: <Server size={18} />,
  },
  {
    title: "Operator controls",
    detail: "Authenticated workflows, scoped workspace access, and server-side protections reduce accidental exposure while analysts review incidents and deployment state.",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "Data handling",
    detail: "The product keeps the evidence needed for replay, summaries, and response review. Retention depth should be matched to customer scope and risk tolerance.",
    icon: <Database size={18} />,
  },
  {
    title: "Evidence integrity",
    detail: "Operator workflows preserve session context and support integrity-backed report output so incident handoff feels operational instead of loosely documented.",
    icon: <Lock size={18} />,
  },
];

const GUARDRAILS = [
  "No attack-back, retaliation, or persistence against third-party systems",
  "No requirement to proxy all production traffic through the platform",
  "No customer-data collection outside the agreed deployment scope",
  "No uncontrolled spread from decoy surfaces into unrelated infrastructure",
];

const DISCLOSURE_FLOW = [
  "Send reports to the security address with affected asset, severity, reproduction steps, and supporting logs or screenshots.",
  "Avoid privacy impact, service degradation, persistence, lateral movement, or data exfiltration while validating a report.",
  "We aim to acknowledge valid reports quickly and coordinate remediation updates based on severity and operational risk.",
];

const DATA_BOUNDARIES = [
  {
    title: "Stored on purpose",
    detail: "Session path, route touches, analyst context, and replay-supporting evidence inside the agreed workspace scope.",
  },
  {
    title: "Not the goal",
    detail: "Blanket collection of unrelated customer data or unnecessary inline mirroring of all production traffic.",
  },
  {
    title: "Controlled handoff",
    detail: "Reports, replay, and analyst context should stay bounded to the reviewing team, agreed retention, and incident response workflow.",
  },
];

export default function SecurityDisclosure() {
  useSeo({
    title: `Deployment Safety and Security | ${PUBLIC_SITE.siteName}`,
    description: `How ${PUBLIC_SITE.siteName} keeps deception deployments isolated, operator access controlled, and disclosure handling clear.`,
  });
  usePageAnalytics("security_disclosure");

  return (
    <div className="marketing-shell">
      <PublicHeader variant="cred" pagePath="/security" />
      <main className="marketing-main">
        <section className="marketing-hero">
          <article className="marketing-card marketing-hero-copy">
            <div className="marketing-badge">Deployment safety</div>
            <div className="marketing-hero-signal">
              {SAFETY_SIGNALS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <h1 className="marketing-title">How the platform stays isolated from production while still preserving usable attacker evidence.</h1>
            <p className="marketing-subtitle">
              Review where the decoys live, what touches production, how evidence is handled, and what operator controls exist.
            </p>
            <div className="marketing-actions">
              <Link to="/demo" className="marketing-btn marketing-btn-primary">
                Request Demo <ArrowRight size={16} />
              </Link>
              <Link to="/case-study" className="marketing-btn marketing-btn-secondary">
                View Sample Incident
              </Link>
            </div>
            <div className="marketing-hero-story">
              <div className="marketing-hero-story-head">
                <span className="marketing-kicker">Deployment review</span>
                <strong>The platform is built for earlier warning and cleaner evidence, not risky inline control.</strong>
              </div>
              <ul className="marketing-checklist marketing-checklist-compact">
                {TRUST_POINTS.map((item) => (
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
                <div className="marketing-kicker">Safety model</div>
                <h3>What is and is not in scope</h3>
              </div>
            </div>
            <div className="marketing-system-flow">
              <div className="marketing-system-flow-step">
                <span className="marketing-system-flow-index">01</span>
                <strong>Expose believable decoys</strong>
                <small>Deploy around login, admin, and API edges where attacker recon typically starts.</small>
              </div>
              <div className="marketing-system-flow-step">
                <span className="marketing-system-flow-index">02</span>
                <strong>Preserve evidence</strong>
                <small>Capture touch sequence, route order, and analyst context for review and response planning.</small>
              </div>
              <div className="marketing-system-flow-step">
                <span className="marketing-system-flow-index">03</span>
                <strong>Keep control bounded</strong>
                <small>Operator workflows stay authenticated and the product does not authorize retaliation or attack-back.</small>
              </div>
            </div>
            <div className="marketing-panel-mini-grid">
              <div className="marketing-panel-mini-card">
                <span>Production path</span>
                <strong>Not replaced inline</strong>
              </div>
              <div className="marketing-panel-mini-card">
                <span>Default access</span>
                <strong>Authenticated workspace operators</strong>
              </div>
            </div>
            <div className="marketing-summary">
              <div className="marketing-summary-head">
                <Lock size={16} />
                <span>Why this matters</span>
              </div>
              <p>Security products lose trust fast when isolation, blast radius, and data-handling expectations are left vague.</p>
            </div>
          </aside>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>Guardrails</p>
            <h2>Trust areas buyers usually ask about first.</h2>
          </div>
          <div className="marketing-grid-3">
            {SAFETY_CARDS.map((item) => (
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
            <article className="marketing-card marketing-proof-copy-card">
              <p className="marketing-kicker">Data boundaries</p>
              <h3>What gets stored, what stays out of scope, and why that matters to trust.</h3>
              <p>
                Deception products become risky when collection scope is vague. This platform should stay explicit about what evidence is preserved,
                what is intentionally out of scope, and how operator handoff remains bounded.
              </p>
            </article>
            <article className="marketing-card marketing-list-card">
              <ul className="marketing-list">
                {DATA_BOUNDARIES.map((item, index) => (
                  <li key={item.title} className="simple marketing-plan-compare-row">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-split-proof">
            <article className="marketing-card marketing-list-card">
              <p className="marketing-kicker">Hard boundaries</p>
              <h3 style={{ marginTop: 0 }}>The platform should stay inside these limits.</h3>
              <ul className="marketing-list">
                {GUARDRAILS.map((item, index) => (
                  <li key={item} className="simple marketing-plan-compare-row">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{item}</strong>
                      <p>These are deliberate operating constraints, not afterthoughts.</p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
            <article className="marketing-card marketing-showcase marketing-proof-copy-card">
              <p className="marketing-kicker">Responsible disclosure</p>
              <h3>Report security issues without creating unnecessary impact.</h3>
              <p>
                Send reports to <a href={toMailto(PUBLIC_SITE.securityEmail)}>{PUBLIC_SITE.securityEmail}</a> with the affected asset, impact summary,
                reproduction steps, and supporting evidence. Respect privacy, availability, and third-party boundaries while validating the issue.
              </p>
              <ul className="marketing-checklist marketing-checklist-compact">
                {DISCLOSURE_FLOW.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="marketing-card marketing-cta">
          <div className="marketing-cta-copy">
            <h2>Need a technical trust review before a pilot?</h2>
            <p>We can walk through deployment isolation, operator controls, and evidence handling before any live rollout conversation.</p>
          </div>
          <div className="marketing-actions">
            <Link to="/demo" className="marketing-btn marketing-btn-primary">
              Request Demo
            </Link>
            <a href={toMailto(PUBLIC_SITE.securityEmail)} className="marketing-btn marketing-btn-secondary">
              Email Security
            </a>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
