import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bot,
  BrainCircuit,
  CircleGauge,
  Layers,
  LayoutDashboard,
  PlayCircle,
  Radar,
  ShieldCheck,
} from "lucide-react";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { trackCtaClick } from "./utils/analytics";
import { fetchPublicTelemetrySnapshot } from "./utils/publicTelemetry";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";
import ProofGallery from "./ProofGallery";

const FALLBACK_KPI_CARDS = [
  { label: "Active decoys", value: 24 },
  { label: "Live sessions", value: 7 },
  { label: "Threat score", value: "84/100" },
  { label: "High-risk paths", value: 11 },
  { label: "AI summaries", value: 39 },
  { label: "Replay-ready sessions", value: 15 },
];

const COMPARISON_ROWS = [
  ["Static responses", "Adaptive responses"],
  ["Single decoy", "Multi-layer deception"],
  ["Manual log review", "AI-assisted analysis"],
  ["Easy fingerprinting", "Higher realism"],
  ["Limited engagement", "High-interaction flows"],
];

const PLATFORM_MODULES = [
  {
    title: "Dynamic Decoy Manager",
    detail: "Design believable web, admin, API, and internal portal decoys with configurable journey depth.",
    linkLabel: "Explore architecture",
    to: "/architecture",
    icon: <Layers size={17} />,
  },
  {
    title: "Telemetry Collector",
    detail: "Normalize session-level events and preserve sequence context for replay, scoring, and detection workflows.",
    linkLabel: "See platform flow",
    to: "/platform",
    icon: <Activity size={17} />,
  },
  {
    title: "AI Threat Analysis",
    detail: "Classify intent, detect reconnaissance patterns, and generate concise analyst narratives for SOC response.",
    linkLabel: "Request live demo",
    to: "/demo",
    icon: <BrainCircuit size={17} />,
  },
  {
    title: "Security Dashboard",
    detail: "Track timeline, risk distribution, owner workflow context, and lead-to-demo operational visibility in one place.",
    linkLabel: "View use cases",
    to: "/use-cases",
    icon: <LayoutDashboard size={17} />,
  },
  {
    title: "Replay and Journey Mapping",
    detail: "Understand exactly where attackers moved from first probe to high-value decoy interaction.",
    linkLabel: "Contact team",
    to: "/contact",
    icon: <Radar size={17} />,
  },
  {
    title: "Operational Guardrails",
    detail: "Built-in intake hardening, duplicate suppression, and role-safe operations for startup execution readiness.",
    linkLabel: "Request walkthrough",
    to: "/demo",
    icon: <ShieldCheck size={17} />,
  },
];

const TREND_POINTS = [
  {
    title: "Adaptive deception at runtime",
    detail: "Decoy responses mutate by behavior pattern instead of staying fixed after initial deployment.",
  },
  {
    title: "Narrative-first SOC workflows",
    detail: "Analysts receive context summaries, not raw event noise, for faster triage decisions.",
  },
  {
    title: "Startup-ready internal operations",
    detail: "CRM, attribution, notes, and controlled status workflows keep inbound security demand operable.",
  },
];

const FALLBACK_ATTACK_TIMELINE = [
  { time: "10:41", path: "GET /auth/login", severity: "low" },
  { time: "10:42", path: "POST /admin/login", severity: "medium" },
  { time: "10:43", path: "GET /api/v1/backup", severity: "medium" },
  { time: "10:44", path: "GET /db/console", severity: "high" },
  { time: "10:45", path: "POST /internal/export", severity: "high" },
];

const FALLBACK_AI_OUTCOMES = [
  {
    label: "AI Analyst Summary",
    detail:
      "Actor probed login, admin, and backup sequence in order. Pattern indicates reconnaissance followed by privilege intent.",
  },
  {
    label: "Behavior Classification",
    detail: "credential probing + endpoint mapping + staged escalation attempt",
  },
  {
    label: "Recommended Response",
    detail: "Maintain decoy continuity, tag source as high-priority, and export replay context for SOC review.",
  },
];

const DEMO_EXPECTATIONS = [
  "Adaptive decoy environments in action",
  "Live threat analytics and scoring",
  "AI-generated attacker session summaries",
  "Attacker journey mapping and replay context",
  "Lead workflow and reporting operations",
];

const PROOF_POINTS = {
  dashboard: [
    "Live KPI surface with session and threat visibility",
    "Analyst-friendly summaries instead of raw logs",
    "Operational metrics for startup execution",
  ],
  decoy: [
    "High-interaction fake login and admin journeys",
    "Believable interface depth for attacker engagement",
    "Structured decoy layers for realistic path simulation",
  ],
  leads: [
    "Demo funnel tied to admin workflow visibility",
    "Repeat lead and status lifecycle discipline",
    "Ops readiness for early sales motion",
  ],
};

const PROOF_GALLERY_ITEMS = [
  {
    label: "Dashboard proof",
    title: "Live analytics dashboard",
    description: "Session visibility, AI summaries, and threat context in one operational view.",
    src: "/media/platform-dashboard-proof.svg",
    alt: "Platform dashboard proof with analytics widgets",
    points: PROOF_POINTS.dashboard,
  },
  {
    label: "Decoy proof",
    title: "Decoy environment depth",
    description: "High-interaction surfaces designed to hold attacker attention and gather behavioral context.",
    src: "/media/platform-decoy-proof.svg",
    alt: "Decoy interactions proof showing realistic portal surfaces",
    points: PROOF_POINTS.decoy,
  },
  {
    label: "Ops proof",
    title: "Operational readiness",
    description: "Demo funnel, repeat lead visibility, and lifecycle discipline for startup execution.",
    src: "/media/platform-leads-proof.svg",
    alt: "Lead operations proof with startup workflow context",
    points: PROOF_POINTS.leads,
  },
];

export default function Platform() {
  usePageAnalytics("platform");
  useSeo({
    title: "Platform | CyberSentinel AI Dynamic Deception",
    description:
      "Explore CyberSentinel AI platform modules: adaptive decoys, telemetry collection, AI behavior analysis, and security operations workflows.",
    ogTitle: "CyberSentinel AI Platform",
    ogDescription:
      "AI-enhanced dynamic deception platform with high-interaction decoys, telemetry pipeline, and analyst-ready threat intelligence.",
  });
  const [liveTelemetry, setLiveTelemetry] = useState(null);
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    let alive = true;
    const loadTelemetry = async () => {
      try {
        const payload = await fetchPublicTelemetrySnapshot({ params: { hours: 24, limit: 6, include_training: false } });
        if (!alive) return;
        setLiveTelemetry(payload);
        setBackendOnline(true);
      } catch {
        if (!alive) return;
        setBackendOnline(false);
      }
    };

    loadTelemetry();
    const interval = setInterval(loadTelemetry, 20000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const kpiCards = useMemo(() => {
    if (!liveTelemetry?.summary) return FALLBACK_KPI_CARDS;
    const summary = liveTelemetry.summary;
    const topTargets = Array.isArray(liveTelemetry.top_targets) ? liveTelemetry.top_targets : [];
    const highRiskPaths = topTargets.filter((target) => Number(target.avg_score || 0) >= 75).length;

    return [
      { label: "Active decoys", value: Number(summary.active_decoys || 0) },
      { label: "Live sessions", value: Number(summary.live_sessions || 0) },
      { label: "Threat score", value: `${Number(summary.threat_score || 12)}/100` },
      { label: "High-risk paths", value: highRiskPaths },
      { label: "AI summaries", value: Number(summary.total_events || 0) },
      { label: "Replay-ready sessions", value: Number(summary.unique_sessions || 0) },
    ];
  }, [liveTelemetry]);

  const attackTimeline = useMemo(() => {
    const feed = Array.isArray(liveTelemetry?.feed) ? liveTelemetry.feed : [];
    if (feed.length === 0) return FALLBACK_ATTACK_TIMELINE;
    return feed.slice(0, 5).map((item, index) => ({
      time: item?.ts ? new Date(item.ts).toLocaleTimeString() : "--:--",
      path: String(item?.path || "unknown"),
      severity: String(item?.severity || "low").toLowerCase(),
      key: item?.id || `${item?.path || "unknown"}-${index}`,
    }));
  }, [liveTelemetry]);

  const aiOutcomes = useMemo(() => {
    if (!liveTelemetry) return FALLBACK_AI_OUTCOMES;
    const insights = liveTelemetry.insights || {};
    return [
      {
        label: "AI Analyst Summary",
        detail: String(liveTelemetry.ai_summary || FALLBACK_AI_OUTCOMES[0].detail),
      },
      {
        label: "Behavior Classification",
        detail: String(insights.dominant_behavior || "unknown").replace(/_/g, " "),
      },
      {
        label: "Recommended Response",
        detail: String(insights.recommended_action || FALLBACK_AI_OUTCOMES[2].detail),
      },
    ];
  }, [liveTelemetry]);

  return (
    <div className="cred-page platform-page">
      <div className="cred-ambient cred-ambient-a" />
      <div className="cred-ambient cred-ambient-b" />

      <PublicHeader variant="cred" pagePath="/platform" />

      <main className="cred-main">
        <section className="platform-v3-hero-shell">
          <div className="cred-hero platform-v3-hero-copy">
            <p className="cred-badge">AI-Enhanced Dynamic Deception Platform</p>
            <h1>Visual, Realistic, and Operator-Ready Deception Platform</h1>
            <p className="cred-subtitle">
              Deploy adaptive high-interaction decoys, watch attacker behavior unfold in sequence, and give analysts
              decision-grade context from one clean control surface.
            </p>
            <div className="platform-v3-chip-row">
              <span className="platform-v3-chip">Adaptive Responses</span>
              <span className="platform-v3-chip">High-Interaction Decoys</span>
              <span className="platform-v3-chip">AI Session Narratives</span>
              <span className="platform-v3-chip">SOC-Ready Dashboard</span>
            </div>
            <div className="cred-actions">
              <Link to="/demo" className="cred-btn cred-btn-primary" onClick={() => trackCtaClick("request_demo", "/platform")}>
                Request Demo <ArrowRight size={15} />
              </Link>
              <Link to="/architecture" className="cred-btn cred-btn-ghost" onClick={() => trackCtaClick("explore_architecture", "/platform")}>
                Explore Architecture
              </Link>
              <Link to="/contact" className="cred-btn cred-btn-ghost" onClick={() => trackCtaClick("contact_team", "/platform")}>
                Contact Team
              </Link>
            </div>
          </div>

          <article className="cred-card platform-v3-hero-card">
            <p className="platform-v3-card-label">Live platform preview</p>
            <div className="platform-kpi-grid">
              {kpiCards.map((item) => (
                <div key={item.label} className="platform-kpi-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="platform-state-strip">
              <div>
                <strong>Deception Engine</strong>
                <span className="state-online">{backendOnline ? "ONLINE" : "DEGRADED"}</span>
              </div>
              <div>
                <strong>Telemetry Collector</strong>
                <span className="state-online">{backendOnline ? "ONLINE" : "DEGRADED"}</span>
              </div>
              <div>
                <strong>AI Summary Pipeline</strong>
                <span className="state-online">{backendOnline ? "ONLINE" : "DEGRADED"}</span>
              </div>
              <p>
                {backendOnline
                  ? "Live telemetry feed is active with real event scoring and analyst narrative output."
                  : "Public telemetry endpoint is temporarily unreachable. Showing last known platform view."}
              </p>
            </div>
            <img
              className="platform-v3-mini-proof"
              src="/media/platform-dashboard-proof.svg"
              alt="Dashboard proof preview"
              loading="lazy"
              decoding="async"
              fetchPriority="low"
            />
          </article>
        </section>

        <section className="cred-section">
          <div className="cred-section-head">
            <p>Positioning clarity</p>
            <h2>Traditional honeypots vs adaptive deception platform</h2>
          </div>
          <div className="platform-v3-contrast">
            <table>
              <thead>
                <tr>
                  <th>Traditional</th>
                  <th>Our Platform</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row[0]}>
                    <td>{row[0]}</td>
                    <td>{row[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="cred-section">
          <div className="cred-section-head">
            <p>Visual proof</p>
            <h2>Product evidence visitors can verify in seconds</h2>
          </div>
          <ProofGallery items={PROOF_GALLERY_ITEMS} />
        </section>

        <section className="cred-section">
          <div className="cred-section-head">
            <p>Core modules</p>
            <h2>Platform capabilities that move beyond a single trap</h2>
          </div>
          <div className="platform-module-grid">
            {PLATFORM_MODULES.map((module) => (
              <Link
                key={module.title}
                to={module.to}
                className="platform-module-card"
                onClick={() => trackCtaClick(module.linkLabel.toLowerCase().replace(/\s+/g, "_"), "/platform")}
              >
                <div className="platform-module-icon">{module.icon}</div>
                <h3>{module.title}</h3>
                <p>{module.detail}</p>
                <span>
                  {module.linkLabel} <ArrowRight size={13} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="cred-section">
          <div className="cred-section-head">
            <p>Mini live preview</p>
            <h2>Session timeline with analyst context</h2>
          </div>
          <div className="platform-demo-grid">
            <article className="cred-card">
              <h3>
                <CircleGauge size={15} /> Attack timeline
              </h3>
              <ul className="platform-timeline-list">
                {attackTimeline.map((item) => (
                  <li key={item.key || `${item.time}-${item.path}`}>
                    <span>{item.time}</span>
                    <code>{item.path}</code>
                    <b className={`sev-${item.severity}`}>{item.severity.toUpperCase()}</b>
                  </li>
                ))}
              </ul>
            </article>
            <article className="cred-card">
              <h3>
                <Bot size={15} /> AI analyst panel
              </h3>
              <div className="platform-outcome-grid">
                {aiOutcomes.map((item) => (
                  <div key={item.label} className="platform-outcome-item">
                    <span>{item.label}</span>
                    <p>{item.detail}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="cred-section">
          <div className="cred-section-head">
            <p>Market direction</p>
            <h2>What modern security buyers expect now</h2>
          </div>
          <div className="platform-trend-grid">
            {TREND_POINTS.map((item) => (
              <article key={item.title} className="platform-trend-card">
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cred-section">
          <div className="cred-section-head">
            <p>Demo expectations</p>
            <h2>What you'll see in the walkthrough</h2>
          </div>
          <div className="demo-see-grid">
            {DEMO_EXPECTATIONS.map((item) => (
              <div key={item} className="demo-see-item">
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="cred-card platform-v3-walkthrough">
          <img
            src="/media/walkthrough-poster.svg"
            alt="Platform walkthrough preview"
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
          <div className="proof-copy">
            <h3>Product walkthrough preview</h3>
            <p>See adaptive response flow, session scoring, and AI narrative generation in one guided sequence.</p>
            <div className="cred-actions">
              <Link to="/demo" className="cred-btn cred-btn-primary" onClick={() => trackCtaClick("request_demo", "/platform")}> 
                <PlayCircle size={15} /> Request Demo
              </Link>
              <Link to="/architecture" className="cred-btn cred-btn-ghost" onClick={() => trackCtaClick("explore_architecture", "/platform")}>Explore Architecture</Link>
            </div>
          </div>
        </section>

        <section className="cred-card cred-cta">
          <div>
            <p>Launch-ready positioning</p>
            <h2>Need a high-credibility platform demo for customers or investors?</h2>
            <span>Show adaptive deception, AI analyst output, and startup-grade operations from one experience.</span>
          </div>
          <div className="cred-actions">
            <Link to="/demo" className="cred-btn cred-btn-primary" onClick={() => trackCtaClick("request_demo", "/platform")}>
              Request Demo
            </Link>
            <Link to="/architecture" className="cred-btn cred-btn-ghost" onClick={() => trackCtaClick("explore_architecture", "/platform")}>Explore Architecture</Link>
            <Link to="/contact" className="cred-btn cred-btn-ghost" onClick={() => trackCtaClick("contact_team", "/platform")}>Contact Team</Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
