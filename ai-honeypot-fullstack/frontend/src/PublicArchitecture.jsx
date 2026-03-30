import React from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, BrainCircuit, CheckCircle2, Database, LayoutDashboard, Shield } from "lucide-react";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { PUBLIC_SITE } from "./siteConfig";
import { trackCtaClick } from "./utils/analytics";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

const ARCHITECTURE_BADGES = ["Web decoys", "API telemetry", "Session timelines", "Evidence trail", "Analyst output"];

const ARCHITECTURE_SIGNALS = ["Evidence-preserving flow", "Operator-ready design", "Built for early detection"];

const ARCHITECTURE_CHECKLIST = [
  "Preserve attacker paths, timing, and evidence from first touch to review",
  "Keep telemetry, AI context, and operator workflow connected in one chain",
  "Support investigations, replay, training, and readiness without losing clarity",
];

const ARCHITECTURE_AUTHORITY = [
  {
    title: "Deception surfaces with purpose",
    detail: "Each decoy layer should attract interaction, preserve context, and feed a meaningful incident trail.",
  },
  {
    title: "Evidence pipeline clarity",
    detail: "Routes, requests, behavior markers, and session timing should read like one evidence chain instead of scattered logs.",
  },
  {
    title: "Operator-ready output",
    detail: "Architecture earns trust when it clearly ends in review workflows, replay, and analyst action rather than abstract diagrams.",
  },
];

const FLOW = [
  {
    title: "Decoy surface",
    detail: "Expose believable decoy surfaces and panels that attract attacker interaction.",
    icon: <Shield size={18} />,
  },
  {
    title: "Event collection",
    detail: "Capture routes, requests, timing, and behavior from active sessions.",
    icon: <Activity size={18} />,
  },
  {
    title: "AI analysis",
    detail: "Summarize intent, suspicious patterns, and practical response context.",
    icon: <BrainCircuit size={18} />,
  },
  {
    title: "Stored evidence",
    detail: "Keep the event trail usable for forensics, replay, and review.",
    icon: <Database size={18} />,
  },
  {
    title: "Operator output",
    detail: "Show the result inside dashboards and team workflows.",
    icon: <LayoutDashboard size={18} />,
  },
];

const REFERENCE_NOTES = [
  "Route path preserved",
  "Session timing retained",
  "AI summary attached",
];

const ARCHITECTURE_FLOW_TRACK = [
  {
    title: "Decoy surface",
    detail: "Believable login and admin traps receive the first touch.",
  },
  {
    title: "Telemetry chain",
    detail: "Paths, requests, timing, and intent clues stay linked.",
  },
  {
    title: "AI analysis",
    detail: "Suspicious movement becomes a readable incident brief.",
  },
  {
    title: "Operator workflow",
    detail: "Replay, review, and action land in one dashboard path.",
  },
];

export default function PublicArchitecture() {
  usePageAnalytics("architecture");
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;
  useSeo({
    title: `Architecture | ${PUBLIC_SITE.siteName}`,
    description: `Understand the ${PUBLIC_SITE.siteName} architecture from suspicious first touch to dashboard output.`,
    ogTitle: `${PUBLIC_SITE.siteName} Architecture`,
    ogDescription: "A simple breakdown of how the deception platform flows end to end.",
  });

  return (
    <div className="marketing-shell">
      <PublicHeader variant="cred" pagePath="/architecture" />
      <main className="marketing-main">
        <section className="marketing-hero">
          <article className="marketing-card marketing-hero-copy">
            <div className="marketing-badge">Architecture</div>
            <div className="marketing-hero-signal">
              {ARCHITECTURE_SIGNALS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <h1 className="marketing-title">Architecture that preserves attacker evidence from first touch to analyst action.</h1>
            <p className="marketing-subtitle">
              Decoys collect suspicious interaction, telemetry preserves the path, AI adds context, and the dashboard turns everything
              into something a team can actually review, replay, and act on before a real environment is hit.
            </p>
            <div className="marketing-inline-points">
              {ARCHITECTURE_BADGES.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="marketing-actions">
              <Link to="/demo" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("request_demo", "/architecture")}>
                Request Demo <ArrowRight size={16} />
              </Link>
              <Link to="/platform" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("view_platform", "/architecture")}>
                View Platform
              </Link>
            </div>
            <div className="marketing-hero-story">
              <div className="marketing-hero-story-head">
                <span className="marketing-kicker">Architecture promise</span>
                <strong>Preserve evidence without breaking operational readability.</strong>
              </div>
              <ul className="marketing-checklist marketing-checklist-compact">
                {ARCHITECTURE_CHECKLIST.map((item) => (
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
                <div className="marketing-kicker">Reference flow</div>
                <h3>End-to-end sequence</h3>
              </div>
            </div>
            <div className="marketing-system-flow">
              {ARCHITECTURE_FLOW_TRACK.map((item, index) => (
                <div key={item.title} className="marketing-system-flow-step">
                  <span className="marketing-system-flow-index">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
              ))}
            </div>
            <div className="marketing-panel-mini-grid">
              <div className="marketing-panel-mini-card">
                <span>Evidence chain</span>
                <strong>Route, timing, session, summary</strong>
              </div>
              <div className="marketing-panel-mini-card">
                <span>End state</span>
                <strong>Analyst-ready review</strong>
              </div>
            </div>
            <div className="marketing-summary">
              <div className="marketing-summary-head">
                <BrainCircuit size={16} />
                <span>Why this flow matters</span>
              </div>
              <p>This flow preserves the attacker journey, adds AI context, and hands the result to operators in a form they can review or replay.</p>
            </div>
            <div className="marketing-mini-pill-row">
              {REFERENCE_NOTES.map((item) => (
                <span key={item} className="marketing-mini-pill">
                  {item}
                </span>
              ))}
            </div>
          </aside>
        </section>

        <section className="marketing-card marketing-live-ribbon">
          <div className="marketing-live-ribbon-head">
            <Activity size={15} />
            <strong>Reference architecture flow</strong>
          </div>
          <div className="marketing-live-ribbon-stream">
            <div className="marketing-live-pill-item">
              <span>Step 1</span>
              <code>Decoy receives attacker touch</code>
            </div>
            <div className="marketing-live-pill-item">
              <span>Step 2</span>
              <code>Telemetry records session behavior</code>
            </div>
            <div className="marketing-live-pill-item">
              <span>Step 3</span>
              <code>AI summary reaches analyst workflow</code>
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-authority-band">
            <article className="marketing-card marketing-authority-copy">
              <p className="marketing-kicker">Operational architecture</p>
              <h2>Built to collect evidence early and keep it useful all the way to analyst action.</h2>
              <p>
                Good deception architecture does not stop at data capture. It preserves routes, timing, and context
                so analysts, responders, and training teams can replay what happened without losing the story.
              </p>
              <ul className="marketing-checklist marketing-checklist-compact">
                {ARCHITECTURE_CHECKLIST.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="marketing-card marketing-authority-list">
              {ARCHITECTURE_AUTHORITY.map((item) => (
                <div key={item.title} className="marketing-authority-item">
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </article>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>Flow</p>
            <h2>Core layers behind the platform workflow</h2>
          </div>
          <div className="marketing-grid-3">
            {FLOW.map((item) => (
              <article key={item.title} className="marketing-card marketing-step">
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
              <p className="marketing-kicker">Design intent</p>
              <h3>Designed to keep deception, evidence, and operator review in one continuous path.</h3>
              <p>
                The architecture is meant to preserve what the attacker did, enrich it with AI context, and deliver a
                reviewable output that supports investigations, drills, and operational briefings.
              </p>
            </article>
            <article className="marketing-card marketing-list-card">
              <ul className="marketing-list">
                <li className="simple"><span className="marketing-list-number">01</span><strong>Decoys attract and contain attacker movement</strong></li>
                <li className="simple"><span className="marketing-list-number">02</span><strong>Telemetry normalizes paths, sessions, and events</strong></li>
                <li className="simple"><span className="marketing-list-number">03</span><strong>Analysts consume summaries, not raw noise</strong></li>
              </ul>
            </article>
          </div>
        </section>

        <section className="marketing-card marketing-cta">
          <div className="marketing-cta-copy">
            <h2>Need a clean architecture walkthrough for your team?</h2>
            <p>Use this flow to explain how {productName} supports monitoring, investigation, and cyber-readiness programs.</p>
          </div>
          <div className="marketing-actions">
            <Link to="/demo" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("request_demo", "/architecture")}>
              Request Demo
            </Link>
            <Link to="/contact" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("contact_team", "/architecture")}>
              Contact Team
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
