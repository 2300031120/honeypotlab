import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Building2,
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

const BUYING_NOTES = [
  "Start with one exposed app or domain, prove the signal quickly, then add more routes or customer environments.",
  "Packaging should show pilot shape, deployment scope, and operator workflow instead of hiding behind vague enterprise language.",
  "Show a typical scope before the first call, even when final pricing is quote-based.",
  "Final pricing depends on route count, retention, integrations, and whether you need MSSP or white-label delivery.",
];

const PLANS = [
  {
    title: "Starter",
    audience: "One app, one team, first deployment",
    icon: <ShieldCheck size={18} />,
    badge: "Best first pilot",
    priceHint: "$99/month - Student/Individual plan",
    scopeHint: "Typical scope: 1 exposed app, up to 10 decoy routes, core replay and analyst brief",
    description:
      "Best for teams that want to prove value on one public-facing app, service portal, or exposed domain before expanding coverage.",
    points: [
      "Believable web and API decoys around one exposed surface",
      "Readable telemetry, replay, and analyst-ready incident summaries",
      "Guided rollout for first live proof and operator review",
    ],
    cta: "Start pilot review",
    to: "/demo",
  },
  {
    title: "Growth",
    audience: "Lean SOC teams and multi-site defenders",
    icon: <Users size={18} />,
    badge: "Recommended",
    priceHint: "$299/month - Custom rollout available",
    scopeHint: "Typical scope: 3 to 10 exposed apps, response workflow, readiness review",
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
    priceHint: "$799/month - Multi-tenant quote available",
    scopeHint: "Typical scope: 10+ customer environments, shared analyst workflow, customer reporting",
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

const BUYING_FLOW = [
  {
    title: "Choose the first exposed surface",
    detail: "Start with the public app, admin route, or API edge where you need proof first.",
  },
  {
    title: "Map deployment and workflow",
    detail: "Decide the ingest sources, response hooks, and analyst workflow needed for go-live.",
  },
  {
    title: "Lock pilot or rollout scope",
    detail: "Use the demo or rollout conversation to pin the packaging, timeline, and delivery path.",
  },
];

const PILOT_DELIVERABLES = [
  "One exposed app or domain mapped for believable login, admin, and API decoys",
  "Operator walkthrough covering telemetry, replay, and analyst-ready incident context",
  "Deployment check aligned to isolation, safety, and first response workflow",
  "Clear decision point for expansion, team rollout, or MSSP path after the first signal",
];

const QUOTE_TRANSPARENCY = [
  { label: "Never starts with", value: "Seat-count guessing" },
  { label: "Usually starts with", value: "One exposed app pilot" },
  { label: "Grows by", value: "Routes, replay depth, and response workflow" },
  { label: "Best buyer behavior", value: "Prove signal first, expand second" },
];

const COMPANY_STAGE_FITS = [
  {
    title: "Startup and first product team",
    detail: "If one public app or portal is the immediate risk, keep the buying motion narrow: prove signal first, then expand after the pilot.",
    signal: "Starter fit",
    icon: <Building2 size={18} />,
  },
  {
    title: "SME and lean security team",
    detail: "If the team already handles multiple exposed services, the commercial story should shift toward workflow fit, response hooks, and retained evidence.",
    signal: "Growth fit",
    icon: <Users size={18} />,
  },
  {
    title: "Enterprise business unit",
    detail: "Large organizations still buy better when the first phase stays scoped to a clear set of routes, owners, and rollout controls instead of platform sprawl.",
    signal: "Scoped rollout",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "MSSP or channel partner",
    detail: "When repeated onboarding, customer reporting, and shared analyst flow matter, the commercial path should move to multi-tenant delivery and partner packaging.",
    signal: "MSSP fit",
    icon: <Workflow size={18} />,
  },
];

const EVERY_PLAN_INCLUDES = [
  "Believable decoy coverage around the agreed exposed routes",
  "Readable telemetry, replay, and analyst-facing incident context",
  "Scope review so the first rollout matches the operator workflow",
  "A clear next step for pilot expansion, team rollout, or MSSP delivery",
];

export default function Pricing() {
  const location = useLocation();
  const toCampaignPath = (path: string) => buildCampaignAwarePath(path, location.search);
  usePageAnalytics("pricing");
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;
  useSeo({
    title: `Plans | ${PUBLIC_SITE.siteName}`,
    description: `Review ${productName} packaging for starter, growth, and MSSP deployment paths.`,
    ogTitle: `${PUBLIC_SITE.siteName} Plans`,
    ogDescription: "Clear product packaging for starter, growth, and MSSP rollout paths.",
  });
  const pricingHeroPills = ["14-day pilot", "Team rollout", "MSSP quote"];
  const pricingHeroMetrics = [
    { label: "Starter", value: "1 app, up to 10 routes" },
    { label: "Growth", value: "3 to 10 apps with workflow" },
    { label: "MSSP", value: "10+ customer environments" },
  ];

  return (
    <div className="marketing-shell pricing-marketing-shell">
      <PublicHeader variant="cred" pagePath="/pricing" />
      <main className="marketing-main">
        <section className="marketing-hero">
          <article className="marketing-card marketing-hero-copy">
            <div className="marketing-badge">Plans and packaging</div>
            <h1 className="marketing-title">Start with a guided pilot, then scale when the signal is proven.</h1>
            <p className="marketing-subtitle">
              {productName} fits best when buyers start with one exposed app, prove signal fast, and expand only after the workflow is trusted.
              Plans are packaged around route coverage, retention, integrations, and support depth.
            </p>
            <div className="marketing-inline-points marketing-inline-points-compact">
              {pricingHeroPills.map((item) => (
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
            <p className="marketing-page-footnote">
              Keep the first commercial decision narrow: one exposed surface, one operator workflow, and one clear decision point for expansion after the
              signal is proven.
            </p>
          </article>

          <aside className="marketing-card marketing-hero-panel marketing-architecture-panel pricing-hero-panel">
            <div className="marketing-panel-head">
              <div>
                <div className="marketing-kicker">Buying path</div>
                <h3>Commercial scope should read like a rollout plan, not a pricing maze.</h3>
              </div>
            </div>
            <div className="pricing-hero-surface">
              {BUYING_FLOW.map((item, index) => (
                <article key={item.title} className="pricing-hero-step">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </div>
                </article>
              ))}
            </div>
            <div className="pricing-hero-metrics">
              {pricingHeroMetrics.map((item) => (
                <div key={item.label} className="pricing-hero-metric">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="marketing-summary pricing-hero-summary">
              <div className="marketing-summary-head">
                <Workflow size={16} />
                <span>Commercial snapshot</span>
              </div>
              <p>{BUYING_NOTES[0]} {BUYING_NOTES[3]}</p>
            </div>
          </aside>
        </section>

        <section className="marketing-card marketing-live-ribbon">
          <div className="marketing-live-ribbon-head">
            <Users size={15} />
            <strong>Commercial anchors</strong>
          </div>
          <div className="marketing-live-ribbon-stream">
            {QUOTE_TRANSPARENCY.slice(0, 3).map((item) => (
              <div key={item.label} className="marketing-live-pill-item">
                <span>{item.label}</span>
                <code>{item.value}</code>
              </div>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>Plans</p>
            <h2>Choose the plan that matches how your company buys today.</h2>
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
                  <p className="marketing-kicker">{plan.priceHint}</p>
                  <p className="marketing-kicker">{plan.scopeHint}</p>
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
            <article className="marketing-card marketing-proof-copy-card">
              <p className="marketing-kicker">What the first pilot should include</p>
              <h3>What the first pilot includes.</h3>
              <p>
                A good first package is not vague platform access. It is one exposed surface, one operator workflow, one trust review,
                and one decision point for expansion after the signal is proven.
              </p>
              <ul className="marketing-checklist marketing-checklist-compact">
                {PILOT_DELIVERABLES.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
            <article className="marketing-card marketing-list-card">
              <p className="marketing-kicker">Quote clarity</p>
              <h3 style={{ marginTop: 0 }}>Quote details that stay clear from the first call.</h3>
              <div className="marketing-panel-mini-grid">
                {QUOTE_TRANSPARENCY.map((item) => (
                  <div key={item.label} className="marketing-panel-mini-card">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>Buyer fit</p>
            <h2>See the most common buyer shapes before the quote conversation starts.</h2>
          </div>
          <div className="marketing-grid-2">
            {COMPANY_STAGE_FITS.map((item) => (
              <article key={item.title} className="marketing-card marketing-showcase">
                <div className="marketing-impact-head">
                  <div className="marketing-icon-box">{item.icon}</div>
                  <span className="marketing-impact-signal">{item.signal}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>Included in every plan</p>
            <h2>Keep the first rollout readable even when the quote changes.</h2>
          </div>
          <div className="marketing-grid-2">
            {EVERY_PLAN_INCLUDES.map((item) => (
              <article key={item} className="marketing-card marketing-showcase">
                <h3>{item}</h3>
                <p>This is part of the baseline commercial story so buyers are not left guessing what the first phase actually covers.</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-card marketing-cta">
          <div className="marketing-cta-copy">
            <h2>Need help choosing the right pilot or rollout path?</h2>
            <p>We can map the right plan based on your exposed routes, deployment path, integrations, and operator workflow.</p>
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
