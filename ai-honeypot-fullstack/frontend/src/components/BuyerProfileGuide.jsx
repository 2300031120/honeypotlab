import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Cloud, ShieldCheck, Users } from "lucide-react";
import { trackCtaClick } from "../utils/analytics";
import { PUBLIC_SITE } from "../siteConfig";

const STORAGE_KEY = "public_site_home_profile";
const PRODUCT_NAME = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;

const PROFILES = [
  {
    id: "mssp",
    label: "MSSP",
    plan: "MSSP path",
    title: "Operate one deception workflow across many customer domains.",
    summary:
      `Use ${PRODUCT_NAME} as a repeatable service layer for internet-facing customer apps, with shared telemetry, customer-ready evidence, and cleaner analyst handoff.`,
    signals: ["Multi-tenant telemetry", "Customer-ready evidence", "White-label growth"],
    bullets: [
      "See many customer domains from one analyst workflow",
      "Turn public attack traffic into report-ready narratives",
      "Scale from pilot tenants into repeatable onboarding",
    ],
    focusLabel: "Best fit",
    focusValue: "Service providers and multi-tenant security teams",
    rolloutLabel: "First value",
    rolloutValue: "Shared analyst queue and customer-ready evidence",
    outcomeLabel: "Recommended plan",
    outcomeValue: "MSSP",
    primary: { to: "/pricing", label: "View MSSP Plan", tracking: "view_mssp_plan" },
    secondary: { to: "/demo", label: "Request MSSP Demo", tracking: "request_mssp_demo" },
    icon: <Users size={18} />,
  },
  {
    id: "lean_soc",
    label: "Lean SOC",
    plan: "Growth path",
    title: "Reduce noise and preserve attacker path for a smaller security team.",
    summary:
      "Give a lean SOC one readable workflow for web and API deception, first-touch evidence, AI summaries, and response-ready next steps.",
    signals: ["Faster analyst context", "Less alert stitching", "Clear response path"],
    bullets: [
      "Keep attacker path, telemetry, and summary in one place",
      "Shorten triage time with replay and AI context",
      "Expand from one app into multi-site production coverage",
    ],
    focusLabel: "Best fit",
    focusValue: "Internal security teams with limited analyst time",
    rolloutLabel: "First value",
    rolloutValue: "Immediate first-touch visibility on one exposed app",
    outcomeLabel: "Recommended plan",
    outcomeValue: "Growth",
    primary: { to: "/platform", label: "Explore Platform", tracking: "explore_lean_soc_platform" },
    secondary: { to: "/demo", label: "Request Team Demo", tracking: "request_team_demo" },
    icon: <ShieldCheck size={18} />,
  },
  {
    id: "saas",
    label: "SaaS",
    plan: "Starter path",
    title: "Protect a public app before recon becomes customer-facing incident pressure.",
    summary:
      "Wrap believable login, admin, and API lures around your SaaS edge so your team sees attacker intent before production workflows take the hit.",
    signals: ["Public-edge protection", "API trap coverage", "Fast pilot rollout"],
    bullets: [
      "Deploy around exposed login and admin paths fast",
      "Capture suspicious automation, probing, and token abuse",
      "Move from first pilot to multi-service rollout cleanly",
    ],
    focusLabel: "Best fit",
    focusValue: "Internet-facing SaaS operators and platform teams",
    rolloutLabel: "First value",
    rolloutValue: "Believable lures on one exposed app in under 30 minutes",
    outcomeLabel: "Recommended plan",
    outcomeValue: "Starter",
    primary: { to: "/deployment", label: "View Deployment Path", tracking: "view_saas_deployment" },
    secondary: { to: "/demo", label: "Request SaaS Demo", tracking: "request_saas_demo" },
    icon: <Cloud size={18} />,
  },
  {
    id: "fintech",
    label: "Fintech / Commerce",
    plan: "Growth path",
    title: "Keep credential abuse and admin probing away from the real customer flow.",
    summary:
      `Use ${PRODUCT_NAME} to place believable deception around customer-facing logins, admin paths, and sensitive API edges where fraud and account abuse often begin.`,
    signals: ["Credential-abuse visibility", "Safer service edge", "Response-ready proof"],
    bullets: [
      "Surface admin probing before the real portal is stressed",
      "Capture credential spray and suspicious path order early",
      "Hand responders evidence they can brief leadership with fast",
    ],
    focusLabel: "Best fit",
    focusValue: "Fintech, ecommerce, and regulated public-facing apps",
    rolloutLabel: "First value",
    rolloutValue: "Actionable proof before customer-facing disruption grows",
    outcomeLabel: "Recommended plan",
    outcomeValue: "Growth",
    primary: { to: "/use-cases", label: "View Use Cases", tracking: "view_fintech_use_cases" },
    secondary: { to: "/contact", label: "Talk to Team", tracking: "contact_fintech_team" },
    icon: <Building2 size={18} />,
  },
];

function resolveInitialProfile() {
  if (typeof window === "undefined") {
    return PROFILES[0].id;
  }
  try {
    const stored = String(window.localStorage.getItem(STORAGE_KEY) || "").trim();
    if (PROFILES.some((profile) => profile.id === stored)) {
      return stored;
    }
  } catch {
    // Ignore storage read failures and fall back to the default profile.
  }
  return PROFILES[0].id;
}

export default function BuyerProfileGuide({ pagePath = "/" }) {
  const [activeProfileId, setActiveProfileId] = useState(resolveInitialProfile);

  const activeProfile = useMemo(
    () => PROFILES.find((profile) => profile.id === activeProfileId) || PROFILES[0],
    [activeProfileId]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, activeProfileId);
    } catch {
      // Ignore storage write failures; the selector still works for this session.
    }
  }, [activeProfileId]);

  const handleProfileSelect = (profileId) => {
    setActiveProfileId(profileId);
    trackCtaClick(`profile_${profileId}`, pagePath);
  };

  return (
    <section className="marketing-section">
      <div className="marketing-grid-2 marketing-split-proof">
        <article className="marketing-card marketing-showcase marketing-proof-copy-card">
          <div className="marketing-section-head">
            <p>Dynamic fit</p>
            <h2>Choose your operating profile and let the page adjust to how your team actually buys.</h2>
          </div>

          <div className="marketing-hero-walkthrough-tabs" aria-label="Choose operating profile">
            {PROFILES.map((profile) => (
              <button
                key={profile.id}
                type="button"
                aria-label={`${profile.label} profile`}
                aria-pressed={profile.id === activeProfileId}
                className={`marketing-hero-walkthrough-tab ${profile.id === activeProfileId ? "is-active" : ""}`}
                onClick={() => handleProfileSelect(profile.id)}
              >
                <span>{profile.label}</span>
                <strong>{profile.plan}</strong>
              </button>
            ))}
          </div>

          <div className="marketing-impact-head" style={{ marginTop: "1rem" }}>
            <div className="marketing-icon-box">{activeProfile.icon}</div>
            <span className="marketing-impact-signal">{activeProfile.plan}</span>
          </div>
          <h3>{activeProfile.title}</h3>
          <p>{activeProfile.summary}</p>

          <div className="marketing-inline-points">
            {activeProfile.signals.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>

          <ul className="marketing-checklist marketing-checklist-compact">
            {activeProfile.bullets.map((item) => (
              <li key={item}>
                <ShieldCheck size={16} />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="marketing-actions">
            <Link
              to={activeProfile.primary.to}
              className="marketing-btn marketing-btn-primary"
              onClick={() => trackCtaClick(activeProfile.primary.tracking, pagePath)}
            >
              {activeProfile.primary.label}
            </Link>
            <Link
              to={activeProfile.secondary.to}
              className="marketing-btn marketing-btn-secondary"
              onClick={() => trackCtaClick(activeProfile.secondary.tracking, pagePath)}
            >
              {activeProfile.secondary.label}
            </Link>
          </div>
        </article>

        <article className="marketing-card marketing-list-card">
          <div className="marketing-section-head">
            <p>Recommended motion</p>
            <h2>See what changes for this profile before you open the rest of the site.</h2>
          </div>

          <div className="marketing-panel-mini-grid">
            <div className="marketing-panel-mini-card">
              <span>{activeProfile.focusLabel}</span>
              <strong>{activeProfile.focusValue}</strong>
            </div>
            <div className="marketing-panel-mini-card">
              <span>{activeProfile.rolloutLabel}</span>
              <strong>{activeProfile.rolloutValue}</strong>
            </div>
            <div className="marketing-panel-mini-card">
              <span>{activeProfile.outcomeLabel}</span>
              <strong>{activeProfile.outcomeValue}</strong>
            </div>
            <div className="marketing-panel-mini-card">
              <span>Page behavior</span>
              <strong>Selection stays remembered on this browser</strong>
            </div>
          </div>

          <ul className="marketing-list">
            <li className="simple">
              <span>01</span>
              <div>
                <strong>Start with the right story</strong>
                <p>Show the profile-specific value first instead of forcing every buyer through the same generic copy.</p>
              </div>
            </li>
            <li className="simple">
              <span>02</span>
              <div>
                <strong>Open the right product path</strong>
                <p>Send visitors to deployment, platform, plans, or use cases based on how they operate in the real world.</p>
              </div>
            </li>
            <li className="simple">
              <span>03</span>
              <div>
                <strong>Keep the decision simple</strong>
                <p>One clear next step is better than making every visitor decode the full site before they know where they fit.</p>
              </div>
            </li>
          </ul>
        </article>
      </div>
    </section>
  );
}
