import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  Server,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { PUBLIC_SITE } from "./siteConfig";
import { trackCtaClick } from "./utils/analytics";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

const DEPLOYMENT_BADGES = ["Docker Compose", "PostgreSQL", "HTTPS redirect", "Trusted hosts", "Launch preflight", "Ops readiness"];

const DEPLOYMENT_SIGNALS = ["Production guardrails", "Operator verification", "Launch gate discipline"];

const DEPLOYMENT_CHECKLIST = [
  "Require strong secrets, production-safe hosts, and PostgreSQL before the public launch",
  "Keep HTTPS redirect, secure cookies, and trusted-host validation aligned with the public hostname",
  "Verify the final state with launch preflight and authenticated readiness checks before you go live",
];

const DEPLOYMENT_PATHS = [
  {
    title: "Direct Docker deployment",
    detail: "Run frontend, backend, and PostgreSQL with the standard compose path when you control the server and public ingress.",
    icon: <Server size={18} />,
  },
  {
    title: "TLS gateway path",
    detail: "Use the TLS profile and Certbot flow when you want HTTPS certificates managed alongside the stack.",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "Cloudflare tunnel option",
    detail: "Use named or quick tunnels when you want a safer public exposure path without opening direct inbound ports.",
    icon: <Workflow size={18} />,
  },
  {
    title: "DuckDNS quick setup",
    detail: "Use the DuckDNS helper path when you need a low-friction hostname and certificate path for testing or early pilots.",
    icon: <LockKeyhole size={18} />,
  },
];

const LAUNCH_FLOW = [
  {
    title: "Set production env values",
    detail: "Lock APP_ENV, SECRET_KEY, PUBLIC_BASE_URL, CORS, TRUSTED_HOSTS, PostgreSQL, and trap credentials.",
  },
  {
    title: "Run preflight and health checks",
    detail: "Use launch_preflight.py, /api/health, and the deployment checklist before exposing the service publicly.",
  },
  {
    title: "Verify operator coverage",
    detail: "Log in, check /ops/readiness, and confirm site, telemetry, and canary coverage are present after rollout.",
  },
];

const DEPLOYMENT_NOTES = [
  "docs/PRODUCTION_DEPLOY_CHECKLIST.md",
  "deploy/scripts/launch_preflight.py",
  "GET /ops/readiness",
];

export default function Deployment() {
  usePageAnalytics("deployment");
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;
  useSeo({
    title: `Deployment | ${PUBLIC_SITE.siteName}`,
    description: `Review the ${productName} deployment path for Docker, PostgreSQL, HTTPS, preflight checks, and operator readiness.`,
    ogTitle: `${PUBLIC_SITE.siteName} Deployment`,
    ogDescription: "Production guardrails, launch preflight, and readiness checks for a safer public rollout.",
  });

  return (
    <div className="marketing-shell">
      <PublicHeader variant="cred" pagePath="/deployment" />
      <main className="marketing-main">
        <section className="marketing-hero">
          <article className="marketing-card marketing-hero-copy">
            <div className="marketing-badge">Deployment and security</div>
            <div className="marketing-hero-signal">
              {DEPLOYMENT_SIGNALS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <h1 className="marketing-title">Deploy with production guardrails, isolated telemetry, and a clear launch gate.</h1>
            <p className="marketing-subtitle">
              {productName} now has a stronger production path: PostgreSQL-backed runtime, launch preflight checks, trusted-host validation,
              HTTPS enforcement, and an authenticated readiness view that tells operators what is still missing before launch.
            </p>
            <div className="marketing-inline-points">
              {DEPLOYMENT_BADGES.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="marketing-actions">
              <Link to="/integrations" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("view_integrations", "/deployment")}>
                View Integrations <ArrowRight size={16} />
              </Link>
              <Link to="/demo" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("request_demo", "/deployment")}>
                Request Demo
              </Link>
            </div>
            <div className="marketing-hero-story">
              <div className="marketing-hero-story-head">
                <span className="marketing-kicker">What production means here</span>
                <strong>Not just running the app, but proving the launch state and operator coverage.</strong>
              </div>
              <ul className="marketing-checklist marketing-checklist-compact">
                {DEPLOYMENT_CHECKLIST.map((item) => (
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
                <div className="marketing-kicker">Launch gate</div>
                <h3>Production verification path</h3>
              </div>
            </div>
            <div className="marketing-system-flow">
              {LAUNCH_FLOW.map((item, index) => (
                <div key={item.title} className="marketing-system-flow-step">
                  <span className="marketing-system-flow-index">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
              ))}
            </div>
            <div className="marketing-panel-mini-grid">
              <div className="marketing-panel-mini-card">
                <span>Preflight</span>
                <strong>launch_preflight.py</strong>
              </div>
              <div className="marketing-panel-mini-card">
                <span>Operator check</span>
                <strong>GET /ops/readiness</strong>
              </div>
            </div>
            <div className="marketing-summary">
              <div className="marketing-summary-head">
                <ShieldCheck size={16} />
                <span>Why this matters</span>
              </div>
              <p>The launch decision should be based on verified config, verified telemetry flow, and verified operator coverage, not only a green container state.</p>
            </div>
            <div className="marketing-mini-pill-row">
              {DEPLOYMENT_NOTES.map((item) => (
                <span key={item} className="marketing-mini-pill">
                  {item}
                </span>
              ))}
            </div>
          </aside>
        </section>

        <section className="marketing-card marketing-live-ribbon">
          <div className="marketing-live-ribbon-head">
            <Server size={15} />
            <strong>Available deployment direction</strong>
          </div>
          <div className="marketing-live-ribbon-stream">
            <div className="marketing-live-pill-item">
              <span>Core</span>
              <code>Frontend + Backend + PostgreSQL</code>
            </div>
            <div className="marketing-live-pill-item">
              <span>Secure access</span>
              <code>TLS gateway or Cloudflare tunnel</code>
            </div>
            <div className="marketing-live-pill-item">
              <span>Verification</span>
              <code>Preflight + Health + Ops readiness</code>
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>Deployment options</p>
            <h2>Choose the path that matches how much infrastructure control you want.</h2>
          </div>
          <div className="marketing-grid-3">
            {DEPLOYMENT_PATHS.map((item) => (
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
              <p className="marketing-kicker">Operator reality</p>
              <h3>Healthy infrastructure is only one part of a correct launch.</h3>
              <p>
                A production-ready deployment also needs live site integrations, telemetry already flowing, and at least one canary or
                decoy proof path that the operators can review after login.
              </p>
            </article>
            <article className="marketing-card marketing-list-card">
              <ul className="marketing-list">
                <li className="simple"><span>01</span><strong>Run the launch preflight against the real .env</strong></li>
                <li className="simple"><span>02</span><strong>Check /api/health and then log in to review /ops/readiness</strong></li>
                <li className="simple"><span>03</span><strong>Confirm at least one site, live events, and canary coverage before opening access</strong></li>
              </ul>
            </article>
          </div>
        </section>

        <section className="marketing-card marketing-cta">
          <div className="marketing-cta-copy">
            <h2>Need help moving from local proof to production rollout?</h2>
            <p>We can map the server path, public exposure option, and launch checks your team should clear before go-live.</p>
          </div>
          <div className="marketing-actions">
            <Link to="/contact" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("contact_team", "/deployment")}>
              Contact Team
            </Link>
            <Link to="/demo" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("request_demo", "/deployment")}>
              Request Demo
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
