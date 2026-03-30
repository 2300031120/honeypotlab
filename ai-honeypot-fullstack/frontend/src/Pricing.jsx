import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { PUBLIC_SITE } from "./siteConfig";
import { trackCtaClick } from "./utils/analytics";
import { buildCampaignAwarePath } from "./utils/campaignLinks";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

const PLAN_SIGNALS = ["Starter to MSSP", "Scope-first rollout", "Built for public attack coverage"];

const PLAN_BADGES = ["Starter", "Growth", "MSSP", "Request quote"];

const BUYING_NOTES = [
  "Start with one public app or domain, prove signal fast, then grow into multi-site or multi-tenant coverage.",
  "Packaging should show deployment shape, telemetry depth, and response workflow instead of hiding behind vague enterprise language.",
  "Final quote depends on domain count, retention, integrations, and whether you need MSSP white-label or customer-facing workflows.",
];

const PLANS = [
  {
    title: "Starter",
    audience: "One app, one team, first deployment",
    icon: <ShieldCheck size={18} />,
    badge: "Fastest start",
    description:
      "Best for teams that want to prove value on one public-facing app, service portal, or exposed domain before expanding coverage.",
    points: [
      "Believable web and API lures around one exposed surface",
      "Readable telemetry, replay, and AI incident summaries",
      "Guided rollout for first live proof and operator review",
    ],
    cta: "Request Demo",
    to: "/demo",
  },
  {
    title: "Growth",
    audience: "Lean SOC teams and multi-site defenders",
    icon: <Users size={18} />,
    badge: "Recommended",
    description:
      "Fit for smaller security teams that need live attacker visibility, response-ready evidence, and a practical rollout path across multiple services or brands.",
    points: [
      "Multi-site telemetry, decoy coverage, and incident review",
      "Cloudflare or WAF-aligned response workflows and readiness checks",
      "Operator handoff for monitoring, triage, and response",
    ],
    cta: "Talk to Team",
    to: "/contact",
  },
  {
    title: "MSSP",
    audience: "Service providers and multi-tenant operations",
    icon: <Workflow size={18} />,
    badge: "Scale channel motion",
    description:
      "For MSSPs and service providers that need one operating model across many customer domains, analysts, and reporting workflows.",
    points: [
      "Multi-tenant review flow, customer-ready evidence, and shared analyst process",
      "White-label and rollout planning for repeated customer onboarding",
      "Integration mapping for edge, provider, and analyst paths",
    ],
    cta: "Contact Team",
    to: "/contact",
  },
];

const COMPARISON_ROWS = [
  {
    label: "Primary fit",
    values: ["Single public app or domain", "Multi-site live monitoring", "Multi-tenant service delivery"],
  },
  {
    label: "Deployment shape",
    values: ["First live pilot", "Production team rollout", "Repeated customer onboarding"],
  },
  {
    label: "Integration depth",
    values: ["Core telemetry and replay", "Response workflow plus readiness", "Provider, customer, and analyst workflows"],
  },
  {
    label: "Best next step",
    values: ["Request a guided demo", "Talk through rollout scope", "Plan channel or white-label rollout"],
  },
];

const BUYING_FLOW = [
  {
    title: "Choose the first deployment shape",
    detail: "Start with whether you need one public app, multiple internal properties, or multi-tenant customer coverage.",
  },
  {
    title: "Map integrations and deployment",
    detail: "Decide the ingest sources, operator workflow, response hooks, and readiness checks needed for go-live.",
  },
  {
    title: "Move into proof and rollout",
    detail: "Use a demo or rollout conversation to pin the exact packaging, timeline, and delivery path.",
  },
];

export default function Pricing() {
  const location = useLocation();
  const toCampaignPath = (path) => buildCampaignAwarePath(path, location.search);
  usePageAnalytics("pricing");
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;
  useSeo({
    title: `Plans | ${PUBLIC_SITE.siteName}`,
    description: `Review ${productName} packaging for starter, growth, and MSSP deployment paths.`,
    ogTitle: `${PUBLIC_SITE.siteName} Plans`,
    ogDescription: "Clear product packaging for starter, growth, and MSSP rollout paths.",
  });

  return (
    <div className="marketing-shell">
      <PublicHeader variant="cred" pagePath="/pricing" />
      <main className="marketing-main">
        <section className="marketing-hero">
          <article className="marketing-card marketing-hero-copy">
            <div className="marketing-badge">Plans and packaging</div>
            <div className="marketing-hero-signal">
              {PLAN_SIGNALS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <h1 className="marketing-title">Choose the rollout path that matches your attack surface, team size, and growth motion.</h1>
            <p className="marketing-subtitle">
              {productName} starts with one public-facing app or domain, grows into multi-site telemetry, and expands into MSSP-ready multi-tenant operations.
              This page shows that path clearly instead of hiding behind generic enterprise pricing language.
            </p>
            <div className="marketing-inline-points">
              {PLAN_BADGES.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="marketing-actions">
              <Link to={toCampaignPath("/demo")} className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("request_demo", "/pricing")}>
                Request Demo <ArrowRight size={16} />
              </Link>
              <Link to={toCampaignPath("/contact")} className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("contact_team", "/pricing")}>
                Talk to Team
              </Link>
            </div>
            <div className="marketing-hero-story">
              <div className="marketing-hero-story-head">
                <span className="marketing-kicker">How buying should work</span>
                <strong>Packaging should reduce confusion, not hide the real rollout decisions.</strong>
              </div>
              <ul className="marketing-checklist marketing-checklist-compact">
                {BUYING_NOTES.map((item) => (
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
                <div className="marketing-kicker">Buying path</div>
                <h3>Three steps from first pilot to rollout scope</h3>
              </div>
            </div>
            <div className="marketing-system-flow">
              {BUYING_FLOW.map((item, index) => (
                <div key={item.title} className="marketing-system-flow-step">
                  <span className="marketing-system-flow-index">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
              ))}
            </div>
            <div className="marketing-panel-mini-grid">
              <div className="marketing-panel-mini-card">
                <span>Best start</span>
                <strong>Demo plus rollout fit review</strong>
              </div>
              <div className="marketing-panel-mini-card">
                <span>Final pricing</span>
                <strong>Quote by scope and deployment shape</strong>
              </div>
            </div>
            <div className="marketing-summary">
              <div className="marketing-summary-head">
                <Workflow size={16} />
                <span>Why this page exists</span>
              </div>
              <p>Buyers should know whether they belong in Starter, Growth, or MSSP before they commit more time.</p>
            </div>
          </aside>
        </section>

        <section className="marketing-card marketing-live-ribbon">
          <div className="marketing-live-ribbon-head">
            <Users size={15} />
            <strong>Packaging direction</strong>
          </div>
          <div className="marketing-live-ribbon-stream">
            <div className="marketing-live-pill-item">
              <span>Starter</span>
              <code>One public app, one fast proof</code>
            </div>
            <div className="marketing-live-pill-item">
              <span>Growth</span>
              <code>Multi-site live monitoring</code>
            </div>
            <div className="marketing-live-pill-item">
              <span>MSSP</span>
              <code>Multi-tenant service delivery</code>
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>Plans</p>
            <h2>Pick the plan that matches the deployment shape, not just the budget line.</h2>
          </div>
          <div className="marketing-grid-3 marketing-plan-grid">
            {PLANS.map((plan) => (
              <article key={plan.title} className={`marketing-card marketing-plan-card ${plan.badge === "Recommended" ? "is-featured" : ""}`}>
                <div className="marketing-impact-head">
                  <div className="marketing-icon-box">{plan.icon}</div>
                  <span className="marketing-impact-signal">{plan.badge}</span>
                </div>
                <div className="marketing-plan-copy">
                  <h3>{plan.title}</h3>
                  <strong>{plan.audience}</strong>
                  <p>{plan.description}</p>
                </div>
                <ul className="marketing-checklist marketing-checklist-compact">
                  {plan.points.map((item) => (
                    <li key={item}>
                      <CheckCircle2 size={16} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link to={toCampaignPath(plan.to)} className="marketing-route-link" onClick={() => trackCtaClick(`plan_${plan.title.toLowerCase()}`, "/pricing")}>
                  {plan.cta} <ArrowRight size={15} />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-split-proof">
            <article className="marketing-card marketing-showcase marketing-proof-copy-card">
              <p className="marketing-kicker">Plan fit</p>
              <h3>Every plan still follows the same core product story: deception, evidence, and operator clarity.</h3>
              <p>
                The difference is how much deployment pressure, integration depth, and operational scale your team needs. Starter buyers need proof fast.
                Growth buyers need workflow fit. MSSPs need repeatable customer onboarding and clean analyst handoff.
              </p>
            </article>
            <article className="marketing-card marketing-list-card">
              <ul className="marketing-list">
                {COMPARISON_ROWS.map((row, index) => (
                  <li key={row.label} className="simple marketing-plan-compare-row">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{row.label}</strong>
                      <p>{row.values.join(" | ")}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="marketing-card marketing-cta">
          <div className="marketing-cta-copy">
            <h2>Need help choosing between Starter, Growth, and MSSP rollout?</h2>
            <p>We can map the right plan based on your attack surface, deployment path, integrations, and operator workflow.</p>
          </div>
          <div className="marketing-actions">
            <Link to={toCampaignPath("/contact")} className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("contact_team", "/pricing")}>
              Contact Team
            </Link>
            <Link to={toCampaignPath("/demo")} className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("request_demo", "/pricing")}>
              Request Demo
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
