import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, MonitorSmartphone } from "lucide-react";
import { PUBLIC_SITE } from "./siteConfig";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { trackCtaClick } from "./utils/analytics";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

const SCREENSHOT_BADGES = ["Current local build", "Operator views", "No mock illustration"];

const SCREENSHOT_SIGNALS = ["Dashboard", "Threat intel", "Forensics", "Platform"];

const SHOTS = [
  {
    title: "Dashboard",
    detail: "Main command surface with threat score, session counts, and operator status.",
    image: "/screenshots/dashboard.png",
    alt: `${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} dashboard screenshot`,
  },
  {
    title: "Threat Intel",
    detail: "Threat-intel workflow showing live event context and analyst-facing security insights.",
    image: "/screenshots/threat-intel.png",
    alt: `${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} threat intelligence screenshot`,
  },
  {
    title: "Forensics Lab",
    detail: "Artifact analysis, risk progression, and incident reconstruction from the current build.",
    image: "/screenshots/forensics.png",
    alt: `${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} forensics screenshot`,
  },
  {
    title: "Public Platform Page",
    detail: "Public-facing platform explanation page captured from the same live local stack.",
    image: "/screenshots/platform-public.png",
    alt: `${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} public platform screenshot`,
  },
];

const SCREENSHOT_NOTES = [
  "Captured from the running local stack",
  "Logged-in operator views plus public platform screen",
  "Useful for buyers who want visual proof before a live walkthrough",
];

export default function Screenshots() {
  usePageAnalytics("screenshots");
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;
  useSeo({
    title: `Screenshots | ${PUBLIC_SITE.siteName}`,
    description: `Browse real ${productName} screenshots captured from the current running build.`,
    ogTitle: `${PUBLIC_SITE.siteName} Screenshots`,
    ogDescription: "Real dashboard, threat intel, forensics, and platform screens from the current local build.",
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
            <h1 className="marketing-title">See the current product screens exactly as they look in the running build.</h1>
            <p className="marketing-subtitle">
              This gallery uses actual screenshots captured from the local stack, including logged-in operator views and public product pages.
              It is meant to answer the buyer question fast: “does the product look real and usable?”
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
              <Link to="/platform" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("view_platform", "/screenshots")}>
                View Platform
              </Link>
            </div>
            <div className="marketing-hero-story">
              <div className="marketing-hero-story-head">
                <span className="marketing-kicker">Why this matters</span>
                <strong>Real screenshots build more trust than abstract claims about the product.</strong>
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
                <div className="marketing-kicker">Gallery proof</div>
                <h3>Captured from the current application state</h3>
              </div>
            </div>
            <div className="marketing-system-flow">
              <div className="marketing-system-flow-step">
                <span className="marketing-system-flow-index">01</span>
                <strong>Logged-in screens</strong>
                <small>Dashboard, threat intel, and forensics pages captured after authenticating into the local app.</small>
              </div>
              <div className="marketing-system-flow-step">
                <span className="marketing-system-flow-index">02</span>
                <strong>Public product screen</strong>
                <small>Platform page captured from the same running frontend for product-story continuity.</small>
              </div>
              <div className="marketing-system-flow-step">
                <span className="marketing-system-flow-index">03</span>
                <strong>Same stack, same code</strong>
                <small>The screenshots match the app state currently running in local development and build output.</small>
              </div>
            </div>
            <div className="marketing-panel-mini-grid">
              <div className="marketing-panel-mini-card">
                <span>Source</span>
                <strong>Local running stack</strong>
              </div>
              <div className="marketing-panel-mini-card">
                <span>Use</span>
                <strong>Visual proof before demo calls</strong>
              </div>
            </div>
            <div className="marketing-summary">
              <div className="marketing-summary-head">
                <MonitorSmartphone size={16} />
                <span>Best use</span>
              </div>
              <p>Share this page when someone wants a faster visual sense of the product before deeper platform and deployment review.</p>
            </div>
          </aside>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>Gallery</p>
            <h2>Actual product screens from the current build.</h2>
          </div>
          <div className="marketing-screenshot-grid">
            {SHOTS.map((item) => (
              <article key={item.title} className="marketing-card marketing-screenshot-card">
                <div className="marketing-screenshot-frame">
                  <img src={item.image} alt={item.alt} loading="lazy" />
                </div>
                <div className="marketing-screenshot-copy">
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
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
            <Link to="/contact" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("contact_team", "/screenshots")}>
              Contact Team
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
