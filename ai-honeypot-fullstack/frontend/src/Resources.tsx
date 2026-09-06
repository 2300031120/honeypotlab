import React from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BookMarked,
  BookOpen,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  Database,
  FlaskConical,
  KeyRound,
  LayoutDashboard,
  Network,
  Radar,
  Rocket,
  ScrollText,
  Server,
  Shield,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { PUBLIC_SITE } from "./siteConfig";
import { trackCtaClick } from "./utils/analytics";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

const RESOURCE_BADGES = ["Docs", "Architecture", "Security", "Deployment", "API", "FAQ"];

const RESOURCE_SIGNALS = ["Technical review hub", "Readable evidence", "Safer rollout"];

const RESOURCE_CHECKLIST = [
  "Group security, architecture, deployment, and integration pages into one technical review lane",
  "Start with the product story, then move into deployment reality and API details",
  "Confirm claims with sample incidents, screenshots, and rollout guardrails",
];

const RESOURCE_LIBRARY = [
  "Documentation and setup for the current build",
  "Architecture and evidence pipeline walkthroughs",
  "Security posture and threat-intelligence reading",
  "Deployment guides, isolation, and readiness checks",
  "API and integration contract references",
];

const RESOURCE_NOTES = [
  "Docs living in docs/ and deploy/scripts/",
  "Public pages link internally for review",
  "Preflight and check scripts ready",
];

const DOCUMENTATION = [
  {
    title: "Setup and runbook",
    detail: "Step-by-step bootstrap from a cloned repo to a running platform, including the one-command launch path and environment prerequisites.",
    href: "/deployment",
    cta: "Open deployment",
    icon: <Rocket size={18} />,
  },
  {
    title: "Operator workflow",
    detail: "How telemetry, forensics, replay, and ops-readiness views turn captured attacker behavior into analyst-ready evidence.",
    href: "/platform",
    cta: "View platform",
    icon: <LayoutDashboard size={18} />,
  },
  {
    title: "Configuration reference",
    detail: "Environment variables, docker-compose flavors, trusted hosts, HTTPS guardrails, and launch preflight checks.",
    href: "/deployment",
    cta: "Open deployment",
    icon: <ScrollText size={18} />,
  },
  {
    title: "Release verification",
    detail: "The repo ships with launch-preflight, check-all, and release-gate scripts so rollout verification stays repeatable.",
    href: "/architecture",
    cta: "View architecture",
    icon: <Activity size={18} />,
  },
];

const ARCHITECTURE_RESOURCES = [
  {
    title: "Architecture overview",
    detail: "Follow one attacker path from decoy surface, telemetry, and AI context to a reviewable analyst output.",
    href: "/architecture",
    cta: "Open architecture",
    icon: <Network size={18} />,
  },
  {
    title: "Evidence pipeline",
    detail: "Routes, request paths, session timing, and behavior markers stay linked into one evidence chain instead of scattered logs.",
    href: "/case-study",
    cta: "View sample incident",
    icon: <Database size={18} />,
  },
  {
    title: "Deception surface design",
    detail: "Believable login, admin, and API decoys that attract interaction while preserving attacker context for later review.",
    href: "/platform",
    cta: "View platform",
    icon: <Boxes size={18} />,
  },
  {
    title: "Threat scoring model",
    detail: "Suspicious movement is turned into readable incident briefs with severity signals that analysts can prioritize.",
    href: "/case-study",
    cta: "Open sample incident",
    icon: <BrainCircuit size={18} />,
  },
];

const SECURITY_RESOURCES = [
  {
    title: "Security posture",
    detail: "Isolated decoys, bounded operator access, HTTPS guardrails, and disclosure language that avoids risky attack-back claims.",
    href: "/security",
    cta: "Open security",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "Threat intelligence feed",
    detail: "Public telemetry snapshot and incident briefs show real-world probe patterns like /.env scanning and credential abuse.",
    href: "/case-study",
    cta: "Review intelligence",
    icon: <Radar size={18} />,
  },
  {
    title: "Handling sensitive data",
    detail: "Environment files, secrets, and credentials stay out of the repo while backups and deployment notes follow stricter checks.",
    href: "/security",
    cta: "Open security",
    icon: <Shield size={18} />,
  },
  {
    title: "Incident disclosure policy",
    detail: "Read how the project handles vulnerabilities, disclosure, and security reporting before a rollout.",
    href: "/security",
    cta: "Open disclosure",
    icon: <FlaskConical size={18} />,
  },
];

const DEPLOYMENT_GUIDES = [
  {
    title: "Deployment overview",
    detail: "Docker plus PostgreSQL, trusted host checks, HTTPS enforcement, and isolated decoy surfaces for a bounded rollout.",
    href: "/deployment",
    cta: "Open deployment",
    icon: <Server size={18} />,
  },
  {
    title: "Preflight launch checks",
    detail: "Launch preflight and check-all scripts validate environment, secrets, and readiness before the stack starts.",
    href: "/deployment",
    cta: "Open deployment",
    icon: <Activity size={18} />,
  },
  {
    title: "Rollout isolation",
    detail: "Keep decoy containers, trusted hosts, and database runtime separated so verification stays repeatable and safe.",
    href: "/architecture",
    cta: "View architecture",
    icon: <Boxes size={18} />,
  },
  {
    title: "Operations checklist",
    detail: "Post-deployment checks cover backup cadence, monitoring, health endpoints, and evidence review handoff.",
    href: "/deployment",
    cta: "Open deployment",
    icon: <CheckCircle2 size={18} />,
  },
];

const API_RESOURCES = [
  {
    title: "Ingest contract",
    detail: "POST /api/ingest accepts per-site API-key telemetry so customer apps and edge systems can push into one event stream.",
    href: "/integrations",
    cta: "Open integrations",
    icon: <KeyRound size={18} />,
  },
  {
    title: "Edge and provider templates",
    detail: "Cloudflare Worker relay, Microsoft 365 Logic App, and Splunk HEC validation paths are included in the repo.",
    href: "/integrations",
    cta: "Open integrations",
    icon: <Workflow size={18} />,
  },
  {
    title: "Public API health",
    detail: "Check live status through the public telemetry snapshot and confirm the runtime is answering before you depend on it.",
    href: "/api/public/telemetry/snapshot",
    cta: "Open public snapshot",
    icon: <Activity size={18} />,
  },
  {
    title: "Integration verification",
    detail: "Seed events, confirm them in telemetry and forensics, then validate the end-to-end operator workflow.",
    href: "/integrations",
    cta: "Open integrations",
    icon: <CheckCircle2 size={18} />,
  },
];

const FAQ = [
  {
    question: "Where should a new team start?",
    answer:
      "Start with one exposed app or portal, issue a site API key, arm the decoy routes, then confirm the signal in telemetry, forensics, and ops-readiness views.",
  },
  {
    question: "Which deployment flavor fits first?",
    answer:
      "Use the standard docker-compose for a first run, then move to the hardened and security variants once trusted-host, HTTPS, and backup checks are in place.",
  },
  {
    question: "Is attacker data kept safe and readable?",
    answer:
      "Route order, session timing, behavior markers, and AI context are stored as one reviewable evidence chain with operator-facing output.",
  },
  {
    question: "How is access kept bounded?",
    answer:
      "Trusted hosts, HTTPS enforcement, bounded operator access, and isolated decoys keep the rollout containment story consistent with the security posture.",
  },
];

export default function Resources() {
  usePageAnalytics("resources");
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;
  useSeo({
    title: `Resources | ${PUBLIC_SITE.siteName}`,
    description: `Technical review resources for ${productName}, covering documentation, architecture, security, deployment, API integration, and common questions.`,
    ogTitle: `${PUBLIC_SITE.siteName} Resources`,
    ogDescription: "One technical review hub for security, architecture, deployment, integrations, and getting started.",
  });

  return (
    <div className="marketing-shell">
      <PublicHeader variant="cred" pagePath="/resources" />
      <main className="marketing-main">
        <section className="marketing-hero">
          <article className="marketing-card marketing-hero-copy">
            <div className="marketing-badge">Resources</div>
            <div className="marketing-hero-signal">
              {RESOURCE_SIGNALS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <h1 className="marketing-title">One technical review hub for security, architecture, deployment, and integrations.</h1>
            <p className="marketing-subtitle">
              {productName} ships with public proof, runnable scripts, deployment guardrails, and integration templates. This page groups
              them so technical evaluators can move from product story to rollout reality without leaving the site.
            </p>
            <div className="marketing-inline-points">
              {RESOURCE_BADGES.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="marketing-actions">
              <Link to="/architecture" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("view_architecture", "/resources")}>
                View Architecture <ArrowRight size={16} />
              </Link>
              <Link to="/demo" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("request_demo", "/resources")}>
                Request Demo
              </Link>
            </div>
            <div className="marketing-hero-story">
              <div className="marketing-hero-story-head">
                <span className="marketing-kicker">What this lane covers</span>
                <strong>Grouped so security, architecture, deployment, and integration review happen in one pass.</strong>
              </div>
              <ul className="marketing-checklist marketing-checklist-compact">
                {RESOURCE_CHECKLIST.map((item) => (
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
                <div className="marketing-kicker">Resource library</div>
                <h3>From first doc to rollout checks</h3>
              </div>
            </div>
            <ul className="marketing-list">
              {RESOURCE_LIBRARY.map((item, index) => (
                <li key={item} className="simple">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item}</strong>
                </li>
              ))}
            </ul>
            <div className="marketing-summary">
              <div className="marketing-summary-head">
                <BookMarked size={16} />
                <span>Why this matters</span>
              </div>
              <p>Technical buyers trust the product when every claim has a page, script, or runbook they can check.</p>
            </div>
            <div className="marketing-mini-pill-row">
              {RESOURCE_NOTES.map((item) => (
                <span key={item} className="marketing-mini-pill">
                  {item}
                </span>
              ))}
            </div>
          </aside>
        </section>

        <section className="marketing-card marketing-live-ribbon">
          <div className="marketing-live-ribbon-head">
            <BookOpen size={15} />
            <strong>Review order that works</strong>
          </div>
          <div className="marketing-live-ribbon-stream">
            <div className="marketing-live-pill-item">
              <span>Start</span>
              <code>Product story {"->"} Platform and screenshots</code>
            </div>
            <div className="marketing-live-pill-item">
              <span>Prove</span>
              <code>Sample incident {"->"} Architecture {"->"} Security</code>
            </div>
            <div className="marketing-live-pill-item">
              <span>Plan</span>
              <code>Deployment {"->"} Integrations {"->"} Demo</code>
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>Documentation</p>
            <h2>Start with the runbook, then follow the operator workflow.</h2>
          </div>
          <div className="marketing-grid-3">
            {DOCUMENTATION.map((item) => (
              <article key={item.title} className="marketing-card marketing-feature">
                <div className="marketing-icon-box">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <Link to={item.href} className="marketing-text-link" onClick={() => trackCtaClick("resource_docs", "/resources")}>
                  {item.cta} <ArrowRight size={15} />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-authority-band">
            <article className="marketing-card marketing-authority-copy">
              <p className="marketing-kicker">Architecture and technical resources</p>
              <h2>Readable architecture that preserves attacker evidence end to end.</h2>
              <p>
                Every technical review path lands on evidence: decoy surfaces collect interaction, telemetry preserves the route and timing,
                AI adds context, and the operator dashboard turns it into something a team can replay and act on.
              </p>
              <ul className="marketing-checklist marketing-checklist-compact">
                <li>
                  <CheckCircle2 size={16} />
                  <span>Preserve routes, sessions, and timing in one evidence chain</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span>Confirm claims with a public sample incident and screenshot gallery</span>
                </li>
              </ul>
            </article>

            <article className="marketing-card marketing-authority-list">
              {ARCHITECTURE_RESOURCES.map((item) => (
                <div key={item.title} className="marketing-authority-item">
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <Link to={item.href} className="marketing-text-link" onClick={() => trackCtaClick("resource_architecture", "/resources")}>
                    {item.cta} <ArrowRight size={14} />
                  </Link>
                </div>
              ))}
            </article>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-authority-band">
            <article className="marketing-card marketing-authority-copy">
              <p className="marketing-kicker">Security and threat intelligence</p>
              <h2>Grounded in isolated decoys, bounded access, and disclosure language.</h2>
              <p>
                The security story stays practical: believable exposed-route traps, readable incident evidence, and rollouts kept inside
                trusted-host and HTTPS checks. Public telemetry snapshots keep threat intelligence visible without exposing real environments.
              </p>
              <ul className="marketing-checklist marketing-checklist-compact">
                <li>
                  <CheckCircle2 size={16} />
                  <span>Review security posture and disclosure policy before rollout</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span>Read public incident briefs to see the attacker evidence shape</span>
                </li>
              </ul>
            </article>

            <article className="marketing-card marketing-authority-list">
              {SECURITY_RESOURCES.map((item) => (
                <div key={item.title} className="marketing-authority-item">
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <Link to={item.href} className="marketing-text-link" onClick={() => trackCtaClick("resource_security", "/resources")}>
                    {item.cta} <ArrowRight size={14} />
                  </Link>
                </div>
              ))}
            </article>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>Deployment guides</p>
            <h2>Rollout checks that keep the trust story grounded in reality.</h2>
          </div>
          <div className="marketing-grid-3">
            {DEPLOYMENT_GUIDES.map((item) => (
              <article key={item.title} className="marketing-card marketing-feature">
                <div className="marketing-icon-box">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <Link to={item.href} className="marketing-text-link" onClick={() => trackCtaClick("resource_deployment", "/resources")}>
                  {item.cta} <ArrowRight size={15} />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>API and integration resources</p>
            <h2>Connect website, edge, and provider signals through one ingest contract.</h2>
          </div>
          <div className="marketing-grid-3">
            {API_RESOURCES.map((item) => (
              <article key={item.title} className="marketing-card marketing-feature">
                <div className="marketing-icon-box">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <Link to={item.href} className="marketing-text-link" onClick={() => trackCtaClick("resource_api", "/resources")}>
                  {item.cta} <ArrowRight size={15} />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-split-proof">
            <article className="marketing-card marketing-showcase marketing-proof-copy-card">
              <p className="marketing-kicker">Frequently asked questions</p>
              <h3>Quick answers for the questions technical evaluators usually ask.</h3>
              <p>
                For deeper detail, continue into the deployment, security, and integration pages, or book a live walkthrough with the team.
              </p>
              <div className="marketing-actions">
                <Link to="/pricing" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("view_pricing", "/resources")}>
                  View Pricing
                </Link>
                <Link to="/demo" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("request_demo", "/resources")}>
                  Request Demo
                </Link>
              </div>
            </article>

            <article className="marketing-card marketing-list-card">
              {FAQ.map((item, index) => (
                <div key={item.question} className="marketing-authority-item">
                  <strong>
                    {String(index + 1).padStart(2, "0")}. {item.question}
                  </strong>
                  <p>{item.answer}</p>
                </div>
              ))}
            </article>
          </div>
        </section>

        <section className="marketing-card marketing-cta">
          <div className="marketing-cta-copy">
            <h2>Need help choosing where to start?</h2>
            <p>We can map the right exposed route, review model, and deployment path for your team.</p>
          </div>
          <div className="marketing-actions">
            <Link to="/demo" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("request_demo", "/resources")}>
              Request Demo
            </Link>
            <Link to="/contact" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("contact_team", "/resources")}>
              Contact Team
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}