import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Building2, CheckCircle2, Cloud, Globe2, ShieldCheck, Users, Workflow } from "lucide-react";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { PUBLIC_SITE } from "./siteConfig";
import { trackCtaClick } from "./utils/analytics";
import { buildCampaignAwarePath } from "./utils/campaignLinks";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

const BUYER_BADGES = ["SaaS security teams", "Customer portals", "Lean SOC teams", "MSSP partners"];

const USE_CASE_SIGNALS = ["Exposed-route coverage", "Readable evidence", "Safer rollout"];

const USE_CASE_CHECKLIST = [
  "Best for public-facing apps with login, admin, and API routes",
  "Helps lean teams catch reconnaissance before it touches real workflows",
  "Fits one-app pilots that need proof, analyst workflow, and rollout confidence quickly",
];

const USE_CASE_AUTHORITY = [
  {
    title: "Single-app pilot",
    detail: "Start with one exposed app, prove the attacker signal on decoy routes, then decide whether to expand coverage.",
  },
  {
    title: "Lean SOC workflow",
    detail: "Give analysts a readable route trail, incident brief, and proof package instead of disconnected alert noise.",
  },
  {
    title: "MSSP customer proof",
    detail: "Use one operator workflow to review events, explain attacker behavior, and support customer-facing reporting.",
  },
];

const USE_CASES = [
  {
    title: "SaaS and customer portals",
    detail: "Protect exposed login, admin, support, and API routes where attackers usually begin reconnaissance and password spraying.",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "Lean SOC teams",
    detail: "Shorten time to understanding with preserved route order, replay, and analyst-ready evidence.",
    icon: <Users size={18} />,
  },
  {
    title: "MSSP-managed environments",
    detail: "Support multi-customer review, proof sharing, and response handoff from one evidence-first workflow.",
    icon: <Cloud size={18} />,
  },
];

const DEPLOYMENT_CONTEXTS = [
  {
    title: "One exposed app",
    detail: "Best first step when you need proof around one public login or admin surface.",
    signal: "Fastest pilot",
  },
  {
    title: "Multi-site team rollout",
    detail: "Add coverage across several customer-facing apps once the first route pilot proves signal quality.",
    signal: "Team scale",
  },
  {
    title: "MSSP customer onboarding",
    detail: "Use the same workflow across customer environments when you need repeatable proof and reporting.",
    signal: "Partner model",
  },
];

const COMPANY_MARKET_SEGMENTS = [
  {
    title: "Startup SaaS teams",
    detail: "Best where one exposed app or customer portal needs a fast proof point before the security budget broadens.",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "SMEs and customer-facing platforms",
    detail: "Strong fit when smaller teams need readable evidence and cannot afford to stitch together several separate tools.",
    icon: <Building2 size={18} />,
  },
  {
    title: "Fintech, commerce, and trust-sensitive apps",
    detail: "Useful where credential abuse, admin probing, and suspicious API activity can turn into customer-facing pressure fast.",
    icon: <Users size={18} />,
  },
  {
    title: "MSSP partner environments",
    detail: "Clear fit when one evidence-first workflow needs to repeat across many customer domains and reporting paths.",
    icon: <Cloud size={18} />,
  },
];

const COMPANY_MARKET_DECISION_BOARD = [
  { label: "Best first buyer", value: "Public-facing SaaS or SME team" },
  { label: "Best proof motion", value: "One exposed route pilot" },
  { label: "Next expansion", value: "Multi-site rollout or MSSP delivery" },
  { label: "Core value", value: "Readable attacker evidence" },
];

const WORLD_MARKET_BADGES = ["India and Southeast Asia", "United States", "Europe", "Middle East"];

const WORLD_MARKET_PILLARS = [
  {
    title: "Global attack surface",
    detail: "Public login, admin, and API routes are global problems, which makes the product story easier to translate across markets.",
    icon: <Globe2 size={18} />,
  },
  {
    title: "Repeatable SaaS motion",
    detail: "The use case travels well when onboarding, proof assets, and pilot scope can repeat across regions without reinventing the workflow.",
    icon: <Workflow size={18} />,
  },
  {
    title: "Regional trust questions",
    detail: "Each market asks for different proof around deployment, safety, and support, so technical trust needs to sit close to the product story.",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "Partner expansion path",
    detail: "MSSPs and regional service partners help the product move from one-company success into broader market coverage.",
    icon: <Cloud size={18} />,
  },
];

export default function UseCases() {
  const location = useLocation();
  const toCampaignPath = (path: string) => buildCampaignAwarePath(path, location.search);
  usePageAnalytics("use_cases");
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;
  useSeo({
    title: `Use Cases | ${PUBLIC_SITE.siteName}`,
    description: `See where ${PUBLIC_SITE.siteName} fits best for public-facing apps, lean SOC teams, and MSSP rollout paths.`,
    ogTitle: `${PUBLIC_SITE.siteName} Use Cases`,
    ogDescription: "Focused use cases for exposed login, admin, and API route protection.",
  });

  return (
    <div className="marketing-shell">
      <PublicHeader variant="cred" pagePath="/use-cases" />
      <main className="marketing-main">
        <section className="marketing-hero">
          <article className="marketing-card marketing-hero-copy">
            <div className="marketing-badge">Use cases</div>
            <div className="marketing-hero-signal">
              {USE_CASE_SIGNALS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <h1 className="marketing-title">Best for teams protecting exposed login, admin, and API routes.</h1>
            <p className="marketing-subtitle">
              {productName} is strongest when you need earlier warning around public-facing app routes, a cleaner attacker trail for analysts,
              and a safer path from pilot to rollout.
            </p>
            <div className="marketing-inline-points">
              {BUYER_BADGES.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="marketing-actions">
              <Link to={toCampaignPath("/demo")} className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("request_demo", "/use-cases")}>
                Request Demo <ArrowRight size={16} />
              </Link>
              <Link to={toCampaignPath("/pricing")} className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("view_pricing", "/use-cases")}>
                View Pricing
              </Link>
            </div>
            <div className="marketing-hero-story">
              <div className="marketing-hero-story-head">
                <span className="marketing-kicker">Where this wins</span>
                <strong>The best fit is where exposed routes, analyst clarity, and one-app pilot confidence all matter.</strong>
              </div>
              <ul className="marketing-checklist marketing-checklist-compact">
                {USE_CASE_CHECKLIST.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <aside className="marketing-card marketing-hero-panel">
            <div className="marketing-panel-head">
              <div>
                <div className="marketing-kicker">Best fit</div>
                <h3>Where the product helps most</h3>
              </div>
            </div>
            <ul className="marketing-list">
              <li className="simple"><span>1</span><strong>Public-facing SaaS apps and customer portals</strong></li>
              <li className="simple"><span>2</span><strong>Lean SOC teams that need readable attacker evidence</strong></li>
              <li className="simple"><span>3</span><strong>MSSPs proving value across customer environments</strong></li>
            </ul>
            <div className="marketing-summary">
              <div className="marketing-summary-head">
                <ShieldCheck size={16} />
                <span>Ideal motion</span>
              </div>
              <p>Start with one exposed route pilot, prove the attacker signal, then expand once the workflow is trusted.</p>
            </div>
          </aside>
        </section>

        <section className="marketing-card marketing-live-ribbon">
          <div className="marketing-live-ribbon-head">
            <ShieldCheck size={15} />
            <strong>Typical buyer goals</strong>
          </div>
          <div className="marketing-live-ribbon-stream">
            <div className="marketing-live-pill-item">
              <span>Goal</span>
              <code>Catch recon before production routes are touched</code>
            </div>
            <div className="marketing-live-pill-item">
              <span>Goal</span>
              <code>Give analysts a readable incident trail</code>
            </div>
            <div className="marketing-live-pill-item">
              <span>Goal</span>
              <code>Move from pilot to rollout with stronger confidence</code>
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-authority-band">
            <article className="marketing-card marketing-authority-copy">
              <p className="marketing-kicker">Why these use cases fit</p>
              <h2>The strongest use cases are not broad. They are exposed-route problems with clear analyst ownership.</h2>
              <p>
                {productName} works best where teams need believable decoys, preserved route order, and evidence strong enough
                to support response decisions or customer conversations.
              </p>
              <ul className="marketing-checklist marketing-checklist-compact">
                {USE_CASE_CHECKLIST.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="marketing-card marketing-authority-list">
              {USE_CASE_AUTHORITY.map((item) => (
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
            <p>Who it serves</p>
            <h2>Focused environments where the platform creates the most value</h2>
          </div>
          <div className="marketing-grid-2">
            {USE_CASES.map((item) => (
              <article key={item.title} className="marketing-card marketing-showcase">
                <div className="marketing-icon-box">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-card marketing-category-band">
          <div className="marketing-category-layout">
            <article className="marketing-category-copy">
              <p className="marketing-kicker">Buyer fit</p>
              <h2>Start with the buyer who owns exposed routes, then expand from a proven pilot.</h2>
              <p>
                The best first motion is clear ownership: one team owns the exposed surfaces, one workflow validates the incidents,
                and one rollout shape proves value fast. That creates a cleaner path from pilot to scale.
              </p>
            </article>
            <div className="marketing-decision-board">
              {COMPANY_MARKET_DECISION_BOARD.map((item) => (
                <div key={item.label} className="marketing-decision-cell">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="marketing-category-grid">
            {COMPANY_MARKET_SEGMENTS.map((item) => (
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
          <div className="marketing-grid-2 marketing-split-proof">
            <article className="marketing-card marketing-showcase marketing-proof-copy-card">
              <p className="marketing-kicker">Best rollout shapes</p>
              <h3>Choose the rollout shape that matches your team, scope, and operating model.</h3>
              <p>
                The product story stays the same: expose believable routes, capture the attacker path, and give the team usable evidence.
                What changes is the deployment shape and review model.
              </p>
            </article>
            <article className="marketing-card marketing-list-card marketing-impact-grid">
              {DEPLOYMENT_CONTEXTS.map((item) => (
                <div key={item.title} className="marketing-impact-line">
                  <div>
                    <div className="marketing-impact-line-head">
                      <strong>{item.title}</strong>
                      <span className="marketing-impact-signal">{item.signal}</span>
                    </div>
                    <p>{item.detail}</p>
                  </div>
                </div>
              ))}
            </article>
          </div>
        </section>

        <section className="marketing-card marketing-top-trust-strip">
          <div className="marketing-top-trust-head">
            <div className="marketing-top-trust-copy">
              <span className="marketing-kicker">Regional rollout fit</span>
              <h2>Prove one strong buyer motion, then repeat it across regions with similar public attack surfaces.</h2>
              <p>
                Exposed login, admin, and API route abuse appears across SaaS, commerce, and managed environments worldwide.
                Once the first buyer workflow is validated, expansion is mostly a go-to-market and deployment exercise.
              </p>
            </div>
            <div className="marketing-top-trust-badges" aria-label="Regional rollout focus">
              {WORLD_MARKET_BADGES.map((item) => (
                <span key={item} className="marketing-top-trust-badge">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="marketing-top-trust-ledger">
            {WORLD_MARKET_PILLARS.map((item) => (
              <article key={item.title} className="marketing-top-trust-item">
                <div className="marketing-impact-head">
                  <div className="marketing-icon-box">{item.icon}</div>
                  <span className="marketing-impact-signal">{item.title}</span>
                </div>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-card marketing-cta">
          <div className="marketing-cta-copy">
            <h2>Need help deciding where the first pilot should sit?</h2>
            <p>We can map the right exposed route, review model, and rollout path for your team.</p>
          </div>
          <div className="marketing-actions">
            <Link to={toCampaignPath("/demo")} className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("request_demo", "/use-cases")}>
              Request Demo
            </Link>
            <Link to={toCampaignPath("/contact")} className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("contact_team", "/use-cases")}>
              Contact Team
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
