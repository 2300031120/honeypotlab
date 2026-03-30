import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Radar,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { PUBLIC_SITE } from "./siteConfig";
import { trackCtaClick } from "./utils/analytics";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

const CASE_BADGES = ["Representative scenario", "Deception-led detection", "Operator workflow proof"];

const CASE_SIGNALS = ["Public service edge", "Credential probing", "AI incident brief"];

const CASE_SUMMARY = [
  "A public-facing service placed believable decoy login and admin routes around the exposed edge.",
  "Suspicious credential and route probing landed in the deception layer before the live service path was hit.",
  "Operators used telemetry, AI summary, and readiness workflow to brief the team and tighten the rollout path.",
];

const TIMELINE = [
  {
    time: "08:42",
    title: "Decoy route touched",
    detail: "A suspicious source opened the decoy login path and immediately pivoted toward admin-style endpoints.",
  },
  {
    time: "08:44",
    title: "Recon path expands",
    detail: "Repeated probes moved through the fake API export and backup-style routes, indicating mapping behavior.",
  },
  {
    time: "08:47",
    title: "AI brief generated",
    detail: "The platform compressed the first-touch sequence into a readable incident summary for the operator team.",
  },
  {
    time: "08:55",
    title: "Team response aligned",
    detail: "Operators reviewed evidence, validated readiness, and adjusted the public exposure plan before the next rollout step.",
  },
];

const OUTCOMES = [
  {
    title: "Earlier warning",
    detail: "The service team saw attacker intent before the real service workflow absorbed the first suspicious touch.",
    icon: <Radar size={18} />,
  },
  {
    title: "Readable handoff",
    detail: "Instead of scattered logs, responders got a short AI-backed incident path with clear route order and severity.",
    icon: <Workflow size={18} />,
  },
  {
    title: "Safer rollout decisions",
    detail: "The same workflow supported both immediate review and launch-gate decisions before broader public exposure.",
    icon: <ShieldCheck size={18} />,
  },
];

const CASE_NOTES = [
  "Representative story, not a named customer claim",
  "Based on the platform's actual product workflow",
  "Useful for explaining operator value before a live demo",
];

export default function CaseStudy() {
  usePageAnalytics("case_study");
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;
  useSeo({
    title: `Case Study | ${PUBLIC_SITE.siteName}`,
    description: `Review a representative ${productName} incident story from suspicious touch to operator response.`,
    ogTitle: `${PUBLIC_SITE.siteName} Case Study`,
    ogDescription: "See how deception, telemetry, and AI-backed incident context fit together in a real-world style scenario.",
  });

  return (
    <div className="marketing-shell">
      <PublicHeader variant="cred" pagePath="/case-study" />
      <main className="marketing-main">
        <section className="marketing-hero">
          <article className="marketing-card marketing-hero-copy">
            <div className="marketing-badge">Representative case study</div>
            <div className="marketing-hero-signal">
              {CASE_SIGNALS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <h1 className="marketing-title">How a public-facing service used deception to catch suspicious first touch before live impact.</h1>
            <p className="marketing-subtitle">
              This is a representative incident story built from the same product flow shown across the platform: believable decoys,
              live telemetry, AI-backed incident context, and operator review before rollout risk becomes service disruption.
            </p>
            <div className="marketing-inline-points">
              {CASE_BADGES.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="marketing-actions">
              <Link to="/demo" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("request_demo", "/case-study")}>
                Request Demo <ArrowRight size={16} />
              </Link>
              <Link to="/platform" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("view_platform", "/case-study")}>
                View Platform
              </Link>
            </div>
            <div className="marketing-hero-story">
              <div className="marketing-hero-story-head">
                <span className="marketing-kicker">Scenario summary</span>
                <strong>The product value becomes clearer when buyers can follow one incident from touch to response.</strong>
              </div>
              <ul className="marketing-checklist marketing-checklist-compact">
                {CASE_SUMMARY.map((item) => (
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
                <div className="marketing-kicker">Environment</div>
                <h3>Representative public service edge</h3>
              </div>
            </div>
            <div className="marketing-system-flow">
              <div className="marketing-system-flow-step">
                <span className="marketing-system-flow-index">01</span>
                <strong>Believable lures</strong>
                <small>Decoy login, admin, and API routes around the public-facing service edge.</small>
              </div>
              <div className="marketing-system-flow-step">
                <span className="marketing-system-flow-index">02</span>
                <strong>Operator coverage</strong>
                <small>Telemetry, AI summary, and readiness checks available after login for the reviewing team.</small>
              </div>
              <div className="marketing-system-flow-step">
                <span className="marketing-system-flow-index">03</span>
                <strong>Rollout discipline</strong>
                <small>Use the same workflow to brief the team and adjust the deployment path before broader exposure.</small>
              </div>
            </div>
            <div className="marketing-panel-mini-grid">
              <div className="marketing-panel-mini-card">
                <span>Sector fit</span>
                <strong>Citizen-facing or public service edge</strong>
              </div>
              <div className="marketing-panel-mini-card">
                <span>Main trigger</span>
                <strong>Credential probing and route mapping</strong>
              </div>
            </div>
            <div className="marketing-summary">
              <div className="marketing-summary-head">
                <Building2 size={16} />
                <span>Why this story matters</span>
              </div>
              <p>Security buyers want to know not only what the product is, but what it looks like when the product has to help a team make a real decision.</p>
            </div>
          </aside>
        </section>

        <section className="marketing-card marketing-live-ribbon">
          <div className="marketing-live-ribbon-head">
            <Workflow size={15} />
            <strong>Incident path</strong>
          </div>
          <div className="marketing-live-ribbon-stream">
            <div className="marketing-live-pill-item">
              <span>Touch</span>
              <code>Decoy login and admin routes</code>
            </div>
            <div className="marketing-live-pill-item">
              <span>Review</span>
              <code>Telemetry plus AI summary</code>
            </div>
            <div className="marketing-live-pill-item">
              <span>Outcome</span>
              <code>Safer rollout and clearer analyst handoff</code>
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>Timeline</p>
            <h2>One clean path from suspicious touch to operator response.</h2>
          </div>
          <div className="marketing-grid-2 marketing-case-layout">
            <article className="marketing-card marketing-list-card">
              <ul className="marketing-list">
                {TIMELINE.map((item) => (
                  <li key={`${item.time}-${item.title}`} className="marketing-case-row">
                    <span className="marketing-list-number">{item.time}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
            <article className="marketing-card marketing-showcase marketing-proof-copy-card">
              <p className="marketing-kicker">What changed</p>
              <h3>The key value was not just detection, but earlier certainty.</h3>
              <p>
                Without the deception layer, the same team may have seen noise later and with less context. With the platform path in place,
                they saw attacker behavior early, understood what the probing looked like, and aligned rollout decisions before the next exposure step.
              </p>
              <div className="marketing-mini-pill-row">
                {CASE_NOTES.map((item) => (
                  <span key={item} className="marketing-mini-pill">
                    {item}
                  </span>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>Outcomes</p>
            <h2>The story is simple: earlier warning, cleaner evidence, better operator decisions.</h2>
          </div>
          <div className="marketing-grid-3">
            {OUTCOMES.map((item) => (
              <article key={item.title} className="marketing-card marketing-feature">
                <div className="marketing-icon-box">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-card marketing-cta">
          <div className="marketing-cta-copy">
            <h2>Need a walkthrough like this for your own environment?</h2>
            <p>We can map a similar incident story around your public edge, integrations, and operator workflow.</p>
          </div>
          <div className="marketing-actions">
            <Link to="/demo" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("request_demo", "/case-study")}>
              Request Demo
            </Link>
            <Link to="/contact" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("contact_team", "/case-study")}>
              Contact Team
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
