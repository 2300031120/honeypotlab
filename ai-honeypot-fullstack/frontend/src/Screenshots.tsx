import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, FileText, MonitorSmartphone } from "lucide-react";
import { PUBLIC_SITE } from "./siteConfig";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { trackCtaClick } from "./utils/analytics";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";
import ProofGallery from "./ProofGallery";

const SCREENSHOT_BADGES = ["Operator screenshots", "Sample-report companion", "No mock illustration"];

const SCREENSHOT_SIGNALS = ["Dashboard", "Threat intel", "Forensics", "Platform"];

const SHOTS = [
  {
    title: "Dashboard",
    detail: "Main command surface with threat score, session counts, and operator status after suspicious activity is captured.",
    image: "/screenshots/dashboard.png",
    alt: `${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} dashboard screenshot`,
  },
  {
    title: "Threat Intel",
    detail: "Threat-intel workflow showing the context an analyst uses to explain likely intent and severity.",
    image: "/screenshots/threat-intel.png",
    alt: `${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} threat intelligence screenshot`,
  },
  {
    title: "Forensics Lab",
    detail: "Artifact analysis, timing, and path reconstruction used to turn suspicious activity into readable evidence.",
    image: "/screenshots/forensics.png",
    alt: `${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} forensics screenshot`,
  },
  {
    title: "Public Platform Page",
    detail: "Public-facing platform explanation screen that connects the buyer story to the operator workflow behind it.",
    image: "/screenshots/platform-public.png",
    alt: `${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} public platform screenshot`,
  },
];

const SCREENSHOT_NOTES = [
  "Supports the sample incident report with real operator-facing screens",
  "Shows logged-in views plus one public product screen for story continuity",
  "Useful when buyers want proof before a live walkthrough or pilot call",
];

const PROOF_PATH = [
  {
    title: "Read the sample incident",
    detail: "Start with the sample report to understand the attacker path, analyst brief, and recommended actions.",
  },
  {
    title: "Match the screens to the workflow",
    detail: "Use the gallery to see where the operator reviews telemetry, forensics, and platform context after the incident.",
  },
  {
    title: "Book the guided walkthrough",
    detail: "Move to a live demo only after the buyer has already seen the report and visual evidence path.",
  },
];

const SCREENSHOT_TRUST = [
  "Screenshots are paired with the sample incident, not shown as disconnected gallery pieces.",
  "Live demo can connect these same views to replay, AI brief, and integrity-backed final report output.",
  "The goal is buyer confidence before a pilot conversation, not UI theater for its own sake.",
];

export default function Screenshots() {
  usePageAnalytics("screenshots");
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;
  useSeo({
    title: `Screenshots | ${PUBLIC_SITE.siteName}`,
    description: `Browse real ${productName} screenshots that support the sample incident and operator workflow story.`,
    ogTitle: `${PUBLIC_SITE.siteName} Screenshots`,
    ogDescription: "Real dashboard, threat intel, forensics, and platform screens used to support the sample incident proof path.",
  });

  return (
    <div className="marketing-shell">
      <PublicHeader variant="cred" pagePath="/screenshots" />
      <main className="marketing-main">
        <section className="marketing-hero">
          <article className="marketing-card marketing-hero-copy">
            <div className="marketing-badge">Product screenshots</div>
            <div className="marketing-hero-signal">
              {SCREENSHOT_SIGNALS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <h1 className="marketing-title">See the operator screens behind the sample incident story.</h1>
            <p className="marketing-subtitle">
              Connect the sample incident report to the actual screens an operator uses for telemetry review, analyst
              interpretation, and incident follow-up.
            </p>
            <div className="marketing-inline-points">
              {SCREENSHOT_BADGES.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="marketing-actions">
              <Link to="/demo" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("request_demo", "/screenshots")}>
                Request Demo <ArrowRight size={16} />
              </Link>
              <a href="/sample-incident-report.md" download className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("download_sample_report", "/screenshots")}>
                Download Report <FileText size={16} />
              </a>
            </div>
            <div className="marketing-hero-story">
              <div className="marketing-hero-story-head">
                <span className="marketing-kicker">Why this matters</span>
                <strong>Real screens matter more when they are tied to a report buyers can already understand.</strong>
              </div>
              <ul className="marketing-checklist marketing-checklist-compact">
                {SCREENSHOT_NOTES.map((item) => (
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
                <div className="marketing-kicker">Review path</div>
                <h3>How to review the incident flow</h3>
              </div>
            </div>
            <div className="marketing-system-flow">
              {PROOF_PATH.map((item, index) => (
                <div key={item.title} className="marketing-system-flow-step">
                  <span className="marketing-system-flow-index">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
              ))}
            </div>
            <div className="marketing-panel-mini-grid">
              <div className="marketing-panel-mini-card">
                <span>Best first step</span>
                <strong>Read the sample report</strong>
              </div>
              <div className="marketing-panel-mini-card">
                <span>Best follow-up</span>
                <strong>Book the guided walkthrough</strong>
              </div>
            </div>
            <div className="marketing-summary">
              <div className="marketing-summary-head">
                <MonitorSmartphone size={16} />
                <span>Best use</span>
              </div>
              <p>Use this gallery to validate the UI quickly before moving into a live walkthrough.</p>
            </div>
          </aside>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>Gallery</p>
            <h2>Real screens tied to the same incident story.</h2>
          </div>
          <ProofGallery
            items={SHOTS.map((item) => ({
              src: item.image,
              alt: item.alt,
              title: item.title,
              description: item.detail,
              label: "Screenshot",
              points: ["Real operator-facing screen", "Supports the sample incident story", "Useful before the live walkthrough"],
            }))}
          />
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-split-proof">
            <article className="marketing-card marketing-proof-copy-card">
              <p className="marketing-kicker">Best next move</p>
              <h3>Pair screenshots with the sample report for a stronger evaluation.</h3>
              <p>
                Screenshots help prove the product is real, but the stronger buyer sequence is: sample incident first, screenshots second, guided
                walkthrough third. That gives the evaluator both story and evidence.
              </p>
            </article>
            <article className="marketing-card marketing-list-card">
              <ul className="marketing-checklist marketing-checklist-compact">
                <li>
                  <CheckCircle2 size={16} />
                  <span>Open the sample incident to understand the attacker path.</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span>Use this gallery to verify the operator workflow behind that report.</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span>Book the demo only after the buyer already understands the incident flow.</span>
                </li>
              </ul>
            </article>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-split-proof">
            <article className="marketing-card marketing-proof-copy-card">
              <p className="marketing-kicker">Proof consistency</p>
              <h3>These screens are most convincing when they stay attached to the incident and handoff story.</h3>
              <p>
                Buyers trust screenshots more when they support one coherent workflow: attacker path, analyst context, replay, and final evidence handoff.
              </p>
            </article>
            <article className="marketing-card marketing-list-card">
              <ul className="marketing-checklist marketing-checklist-compact">
                {SCREENSHOT_TRUST.map((item) => (
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
            <h2>Need a guided walkthrough after reviewing the screens?</h2>
            <p>We can show the same views live, explain the workflow, and map the best rollout path for your environment.</p>
          </div>
          <div className="marketing-actions">
            <Link to="/demo" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("request_demo", "/screenshots")}>
              Request Demo
            </Link>
            <Link to="/case-study" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("view_case_study", "/screenshots")}>
              View Sample Incident
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
