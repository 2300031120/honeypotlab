import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
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
import ProofGallery from "./ProofGallery";

const CASE_BADGES = ["Sample incident report", "Exposed-route detection", "Operator workflow proof", "Integrity-backed handoff"];

const CASE_SIGNALS = ["Exposed app edge", "Credential probing", "Analyst brief"];

const CASE_SUMMARY = [
  "A public-facing app placed believable decoy login, admin, and API routes around its exposed edge.",
  "Credential probing and route mapping landed in the deception layer before the real production path was hit.",
  "Operators used telemetry, analyst brief, and rollout checks to tighten exposure before the next release step.",
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
    title: "Analyst brief generated",
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
  "Honest sample incident, not a named customer claim",
  "Based on the platform's actual workflow and proof surfaces",
  "Useful for buyers who need something concrete before a live demo",
];

const REPORT_METRICS = [
  { label: "Suspicious source", value: "198.51.100.24" },
  { label: "Route touches", value: "3 decoy surfaces" },
  { label: "Session window", value: "13 minutes" },
  { label: "Analyst verdict", value: "Credential-access recon" },
];

const REPORT_SECTIONS = [
  {
    title: "Executive summary",
    detail: "What happened, why it matters, and why the interaction was treated as early hostile recon instead of harmless noise.",
  },
  {
    title: "Observed route sequence",
    detail: "The order of login, admin, and API-style touches so the buyer sees how the attacker moved through the deception layer.",
  },
  {
    title: "Analyst interpretation",
    detail: "Short reasoning about likely intent, severity, and why the sequence maps to credential probing rather than a random scan.",
  },
  {
    title: "Recommended actions",
    detail: "Concrete follow-up steps for exposed route review, WAF alignment, and deployment decisions after the incident.",
  },
];

const STORY_PILLARS = [
  {
    title: "One incident, one clean operator story",
    detail: "The buyer sees a believable attacker path, the analyst brief, and the operator decision in one sequence instead of fragmented screenshots.",
    icon: <Workflow size={18} />,
  },
  {
    title: "Artifacts, not just claims",
    detail: "Screenshots and the downloadable report support the same narrative, which makes the proof feel product-backed instead of presentation-backed.",
    icon: <FileText size={18} />,
  },
  {
    title: "Decision-ready, not demo theater",
    detail: "The incident is framed around earlier certainty and safer rollout choices, which is much stronger than showing generic threat activity alone.",
    icon: <ShieldCheck size={18} />,
  },
];

const STORY_DECISION_BOARD = [
  { label: "Category proof", value: "High-interaction deception" },
  { label: "Attacker move", value: "Credential-access recon" },
  { label: "Operator output", value: "Brief + artifacts + replay" },
  { label: "Business result", value: "Safer rollout decision" },
];

const HANDOFF_TRUST = [
  "Session replay and artifact views stay tied to the same attacker path shown in the report.",
  "Live platform workflow can produce integrity-backed final reports for operator handoff and review.",
  "The incident story is designed to support rollout decisions, not just create demo theater.",
];

const PROOF_GALLERY_ITEMS = [
  {
    src: "/screenshots/dashboard.png",
    alt: `${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} dashboard screenshot`,
    title: "Dashboard command view",
    description: "Shows the main operator surface used to review incident counts, threat score, and active sessions after the suspicious touch.",
    label: "Operator screenshot",
    points: ["Current command surface", "Threat score and session overview", "Matches the sample incident narrative"],
  },
  {
    src: "/screenshots/threat-intel.png",
    alt: `${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} threat intelligence screenshot`,
    title: "Threat-intel review",
    description: "Supports the sample analyst brief with context the reviewer can use to explain likely intent and route progression.",
    label: "Analyst screenshot",
    points: ["Readable context for triage", "Supports the analyst brief", "Useful in buyer walkthroughs"],
  },
  {
    src: "/screenshots/forensics.png",
    alt: `${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} forensics screenshot`,
    title: "Forensics evidence view",
    description: "Shows how the incident can be reconstructed from captured artifacts, timing, and behavior instead of scattered logs.",
    label: "Evidence screenshot",
    points: ["Artifact reconstruction", "Behavior and timing context", "Proof that the workflow is not just a dashboard claim"],
  },
];

export default function CaseStudy() {
  usePageAnalytics("case_study");
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;
  useSeo({
    title: `Sample Incident | ${PUBLIC_SITE.siteName}`,
    description: `Review a sample ${productName} incident story from suspicious touch to operator response.`,
    ogTitle: `${PUBLIC_SITE.siteName} Sample Incident`,
    ogDescription: "See how deception, telemetry, and analyst-ready incident context fit together in a realistic proof scenario.",
  });

  return (
    <div className="marketing-shell">
      <PublicHeader variant="cred" pagePath="/case-study" />
      <main className="marketing-main">
        <section className="marketing-hero">
          <article className="marketing-card marketing-hero-copy">
            <div className="marketing-badge">Sample incident report</div>
            <div className="marketing-hero-signal">
              {CASE_SIGNALS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <h1 className="marketing-title">How an exposed app pilot caught attacker recon before it touched production routes.</h1>
            <p className="marketing-subtitle">
              This sample incident shows the same product flow used across the platform: believable decoys, telemetry,
              analyst-ready incident context, and operator review before rollout risk becomes production impact.
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
              <a href="/sample-incident-report.md" download className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("download_sample_report", "/case-study")}>
                Download Sample Report
              </a>
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
                <h3>Exposed application edge</h3>
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
                <span>Best fit</span>
                <strong>Public app or admin route pilot</strong>
              </div>
              <div className="marketing-panel-mini-card">
                <span>Main trigger</span>
                <strong>Credential probing and route mapping</strong>
              </div>
            </div>
            <div className="marketing-summary">
              <div className="marketing-summary-head">
                <Building2 size={16} />
                <span>Decision value</span>
              </div>
              <p>Security teams can see how the workflow supports a real rollout decision, not just a dashboard view.</p>
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
              <code>Telemetry plus analyst brief</code>
            </div>
            <div className="marketing-live-pill-item">
              <span>Outcome</span>
              <code>Safer rollout and clearer analyst handoff</code>
            </div>
          </div>
        </section>

        <section className="marketing-card marketing-category-band">
          <div className="marketing-category-layout">
            <article className="marketing-category-copy">
              <p className="marketing-kicker">Why this incident story stands out</p>
              <h2>Follow the incident path from first touch to the operator decision.</h2>
              <p>
                An exposed route is touched, the deception layer captures the path, AI compresses the evidence, and the team uses that context
                before broader exposure continues.
              </p>
            </article>
            <div className="marketing-decision-board">
              {STORY_DECISION_BOARD.map((item) => (
                <div key={item.label} className="marketing-decision-cell">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="marketing-category-grid">
            {STORY_PILLARS.map((item) => (
              <article key={item.title} className="marketing-category-card">
                <div className="marketing-impact-head">
                  <div className="marketing-icon-box">{item.icon}</div>
                  <span className="marketing-impact-signal">{item.title}</span>
                </div>
                <p>{item.detail}</p>
              </article>
            ))}
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
            <p>Report artifact</p>
            <h2>A sample analyst report buyers can keep after the conversation.</h2>
          </div>
          <div className="marketing-grid-2 marketing-split-proof">
            <article className="marketing-card marketing-proof-copy-card">
              <p className="marketing-kicker">Downloadable report</p>
              <h3>Structured like the handoff security teams expect after suspicious route activity.</h3>
              <p>
                Instead of leaving the buyer with only a verbal demo, this sample report shows the kind of deliverable they can evaluate:
                short summary, route sequence, analyst reasoning, and recommended actions.
              </p>
              <div className="marketing-panel-mini-grid">
                {REPORT_METRICS.map((item) => (
                  <div key={item.label} className="marketing-panel-mini-card">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
              <div className="marketing-actions">
                <a href="/sample-incident-report.md" download className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("download_sample_report", "/case-study")}>
                  Download Report <FileText size={16} />
                </a>
                <Link to="/screenshots" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("view_screenshots", "/case-study")}>
                  Open Screenshots
                </Link>
              </div>
            </article>
            <article className="marketing-card marketing-list-card">
              <ul className="marketing-list">
                {REPORT_SECTIONS.map((item, index) => (
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
          <div className="marketing-section-head">
            <p>Visual evidence</p>
            <h2>Screens that support the same sample incident story.</h2>
          </div>
          <ProofGallery items={PROOF_GALLERY_ITEMS} />
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-split-proof">
            <article className="marketing-card marketing-proof-copy-card">
              <p className="marketing-kicker">Handoff trust</p>
              <h3>The incident narrative is strongest when report, replay, and final handoff all match.</h3>
              <p>
                The product preserves evidence cleanly instead of only displaying activity. That is why the incident story, screenshots, and
                handoff language all point to the same operator workflow.
              </p>
            </article>
            <article className="marketing-card marketing-list-card">
              <ul className="marketing-checklist marketing-checklist-compact">
                {HANDOFF_TRUST.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
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
            <h2>Need an incident workflow like this for your own environment?</h2>
            <p>We can map a similar incident story around your exposed routes, rollout priorities, and operator workflow.</p>
          </div>
          <div className="marketing-actions">
            <Link to="/demo" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("request_demo", "/case-study")}>
              Request Demo
            </Link>
            <a href="/sample-incident-report.md" download className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("download_sample_report", "/case-study")}>
              Download Sample Report
            </a>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
