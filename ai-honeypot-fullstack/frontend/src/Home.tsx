// @ts-nocheck
import React, { startTransition, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  BrainCircuit,
  CheckCircle2,
  Link2,
  LockKeyhole,
  Radar,
  ScanSearch,
  Server,
  ShieldAlert,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { API_BASE } from "./apiConfig";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { useScrollReveal } from "./hooks/useScrollReveal";
import { trackCtaClick } from "./utils/analytics";
import { buildAuthHeaders, isAuthenticated } from "./utils/auth";
import { buildCampaignAwarePath } from "./utils/campaignLinks";
import { fetchPublicTelemetrySnapshot } from "./utils/publicTelemetry";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";
import { PUBLIC_SITE } from "./siteConfig";

const FEATURE_CARDS = [
  {
    title: "Believable deception surfaces",
    desc: "Deploy fake login, admin, and internal application paths that attract reconnaissance before attackers reach the real system.",
    icon: <ShieldAlert size={18} />,
  },
  {
    title: "Readable evidence and AI context",
    desc: "Turn noisy first-touch activity into a short incident brief your operators can review, explain, and act on quickly.",
    icon: <BrainCircuit size={18} />,
  },
  {
    title: "One operator workflow",
    desc: "Review sessions, paths, top-targeted decoys, and attacker intent from one dashboard instead of scattered logs and alerts.",
    icon: <Activity size={18} />,
  },
];

const PRODUCT_STEPS = [
  {
    title: "Expose controlled lures",
    detail: "Place believable login, admin, and API-style routes where attackers usually begin reconnaissance and probing.",
    icon: <LockKeyhole size={18} />,
  },
  {
    title: "Capture attacker behavior",
    detail: "Track routes, IPs, timing, repeated probes, and suspicious movement as the interaction unfolds.",
    icon: <ScanSearch size={18} />,
  },
  {
    title: "Respond with evidence",
    detail: "Use AI summaries, timelines, and replay to understand intent faster and brief the team with clean context.",
    icon: <Bot size={18} />,
  },
];

const TRUST_POINTS = ["Internet-facing deception", "Operator-ready evidence", "Cloudflare/WAF actions", "MSSP-ready workflow"];

const IMPACT_POINTS = ["Launch in 30 minutes", "Capture attacker intent live", "Respond with evidence"];
const HERO_PROOF_PILLS = ["API health endpoint", "Public telemetry snapshot", "Real dashboard screenshots", "Security disclosure"];
const VALIDATION_SIGNAL_BAR = [
  "Built for internet-facing security teams",
  "Live telemetry + AI triage + replay workflow",
  "Launch path with deployment and security checks",
  "Public proof endpoints for independent validation",
];
const HARD_DIFFERENTIATORS = [
  {
    title: "High-interaction deception",
    detail: "Believable web and protocol lures capture attacker behavior, not just static signatures.",
  },
  {
    title: "Evidence-first workflow",
    detail: "Session path, severity progression, and AI brief stay in one operator timeline for fast triage.",
  },
  {
    title: "Response-ready output",
    detail: "Captured signals map to edge/WAF blocking and analyst handoff without manual log stitching.",
  },
  {
    title: "Operational launch discipline",
    detail: "Production checklist, readiness checks, and infrastructure guidance reduce rollout risk.",
  },
];

const CHECKLIST_ITEMS = [
  "Expose admin probing, credential spray, API recon, and first-touch intrusion behavior before production paths are hit",
  "Give lean SOC teams and responders a readable attacker trail instead of raw alert noise and disconnected logs",
  "Protect public-facing SaaS, fintech, ecommerce, and service portals with believable web and API deception",
  "Support MSSP multi-tenant operations with one workflow for telemetry review, customer reporting, and response handoff",
];

const BUYER_POINTS = [
  "Built for MSSPs, lean SOC teams, and internet-facing SaaS or service operators",
  "Readable enough for operators, leadership, and customer-facing incident updates",
  "Live telemetry backed by AI-assisted incident context, replay, and block-ready evidence",
];

const TRUST_AUDIENCE_STRIP = ["MSSPs", "Lean SOC teams", "SaaS operators", "Fintech teams", "Ecommerce apps", "Incident responders"];

const TRUST_LEDGER = [
  {
    title: "Deployment-ready",
    detail: "Docker stack, PostgreSQL path, and guarded production settings already wired into the rollout path.",
    icon: <Server size={18} />,
  },
  {
    title: "Operator-readable",
    detail: "Readable telemetry, preserved attacker path, and AI brief layers instead of raw alert noise.",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "Action-ready",
    detail: "One path for live monitoring, investigation, Cloudflare or WAF response, and readiness review.",
    icon: <Workflow size={18} />,
  },
  {
    title: "Channel-ready",
    detail: "Fits public-facing apps, customer environments, and MSSP multi-tenant operating models.",
    icon: <Building2 size={18} />,
  },
];

const USE_CASES = [
  {
    title: "SOC and incident response",
    detail: "Review suspicious sessions quickly, preserve the evidence trail, and hand analysts a clearer attacker narrative.",
  },
  {
    title: "Public-facing services",
    detail: "Place decoys around portals, admin paths, and exposed applications to surface attacker behavior before production impact or service disruption.",
  },
  {
    title: "Higher education and labs",
    detail: "Run deception-driven exercises, research behavior patterns, and help learners study attacker movement in a safe environment.",
  },
  {
    title: "Cyber readiness training",
    detail: "Use realistic telemetry, replay, and summaries to brief teams during exercises, awareness programs, and tabletop drills.",
  },
];

const EVALUATION_PATHS = [
  {
    title: "Platform",
    detail: "See the operator workflow, live telemetry surfaces, replay path, and AI incident output first.",
    to: "/platform",
    cta: "Explore platform",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "Integrations",
    detail: "Check how websites, Cloudflare, Microsoft 365, and provider alerts feed the product.",
    to: "/integrations",
    cta: "View integrations",
    icon: <Link2 size={18} />,
  },
  {
    title: "Deployment",
    detail: "Review the PostgreSQL, HTTPS, preflight, and readiness path before a public rollout.",
    to: "/deployment",
    cta: "View deployment",
    icon: <Server size={18} />,
  },
  {
    title: "Security",
    detail: "Open the disclosure and trust material when you need launch-level safety and handling context.",
    to: "/security",
    cta: "Open security",
    icon: <LockKeyhole size={18} />,
  },
];

const LAUNCH_SIGNALS = [
  {
    title: "PostgreSQL path",
    detail: "Production runtime supports PostgreSQL plus migrations instead of staying on local-only storage.",
    cta: "Deployment",
    to: "/deployment",
    icon: <Server size={18} />,
  },
  {
    title: "Deployable stack",
    detail: "Frontend, backend, and database already run together in a verified Docker flow.",
    cta: "Architecture",
    to: "/architecture",
    icon: <Workflow size={18} />,
  },
  {
    title: "Security guardrails",
    detail: "Rate limits, secure headers, trusted hosts, and HTTPS rollout checks are in the platform path.",
    cta: "Security",
    to: "/security",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "Ops readiness",
    detail: "Readiness checks help teams verify launch state before public rollout or team handoff.",
    cta: "Platform",
    to: "/platform",
    icon: <LockKeyhole size={18} />,
  },
];

const DEMO_CHAPTERS = [
  {
    title: "Deception activation",
    detail: "Operators arm believable lures around exposed login, admin, and API entry points.",
  },
  {
    title: "Suspicious path capture",
    detail: "The platform records route order, severity, and session movement as the attacker touches the trap.",
  },
  {
    title: "AI-backed handoff",
    detail: "The incident brief compresses the path into a readable summary and next-step workflow for the team.",
  },
];

const SCREENSHOT_GALLERY = [
  {
    title: "Live dashboard",
    detail: "Current command view with threat score, active sessions, and the main operator mesh.",
    image: "/screenshots/dashboard.png",
    alt: `${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} dashboard screenshot`,
  },
  {
    title: "Threat intelligence",
    detail: "Threat-intel screen captured from the running local app with live telemetry context.",
    image: "/screenshots/threat-intel.png",
    alt: `${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} threat intelligence screenshot`,
  },
  {
    title: "Forensics lab",
    detail: "Artifact review, risk progression, and attack reconstruction from the local forensics workflow.",
    image: "/screenshots/forensics.png",
    alt: `${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} forensics lab screenshot`,
  },
];

const COMPETITIVE_ROWS = [
  {
    label: "Telemetry depth",
    ours: "Live session timeline + decoy path + severity context",
    generic: "Mostly static dashboards or delayed alert paths",
  },
  {
    label: "Operator workflow",
    ours: "Capture -> AI brief -> replay -> response handoff",
    generic: "Multiple tools and manual analyst correlation",
  },
  {
    label: "Deployment readiness",
    ours: "Docker, PostgreSQL path, security preflight, edge response hooks",
    generic: "Demo-first setup with limited launch guardrails",
  },
  {
    label: "Public trust",
    ours: "Security disclosure, real screenshots, API-backed public snapshot",
    generic: "Positioning claims with limited operational proof",
  },
];

function buildAnalystSummary(feed) {
  if (!Array.isArray(feed) || feed.length === 0) {
    return "No live attacker sequence yet. Adaptive decoys are armed and collecting first-touch telemetry.";
  }

  const firstSteps = feed
    .slice(0, 5)
    .map((event) => String(event?.url_path || event?.cmd || event?.event_type || "").trim())
    .filter(Boolean);
  const sequence = firstSteps.length > 0 ? firstSteps.join(" -> ") : "login -> admin -> backup -> api";
  const intent =
    firstSteps.some((item) => item.includes("admin") || item.includes("login"))
      ? "credential-access reconnaissance"
      : "surface mapping and automation probes";

  return `Attacker sequence observed: ${sequence}. AI classifier marks likely ${intent}.`;
}

function toTimelineItem(event, index = 0) {
  const tsValue = event?.ts || event?.timestamp || null;
  const pathValue = String(event?.path || event?.url_path || event?.cmd || event?.event_type || "unknown");
  return {
    id: event?.id || `${pathValue}-${tsValue || index}`,
    ts: tsValue ? new Date(tsValue).toLocaleTimeString() : "--:--:--",
    path: pathValue,
    severity: String(event?.severity || "low").toLowerCase(),
  };
}

export default function Home() {
  const location = useLocation();
  const toCampaignPath = (path) => buildCampaignAwarePath(path, location.search);
  usePageAnalytics("home");
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName || "CyberSentinel";
  useSeo({
    title: `${PUBLIC_SITE.siteName} | Deception Telemetry Platform`,
    description:
      "Deception telemetry platform with believable decoys, live telemetry, session replay, and AI-assisted incident context for internet-facing cyber defense.",
    ogTitle: `${PUBLIC_SITE.siteName} Deception Telemetry Platform`,
    ogDescription:
      "Detect attacker reconnaissance early, observe suspicious behavior safely, and preserve evidence with AI-assisted incident context.",
  });

  const [snapshot, setSnapshot] = useState({
    totalAttacks: 0,
    criticalThreats: 0,
    blockedIps: 0,
    liveSessions: 0,
    uniqueIps: 0,
    activeDecoys: 0,
    threatScore: 0,
    topDecoy: "",
  });
  const [attackTimeline, setAttackTimeline] = useState([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [analystSummary, setAnalystSummary] = useState(buildAnalystSummary([]));
  const [activeWalkthrough, setActiveWalkthrough] = useState(0);
  const [showRichSections, setShowRichSections] = useState(false);
  const [telemetryEnabled, setTelemetryEnabled] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(false);
  useScrollReveal(".marketing-lazy-section", {
    enabled: motionEnabled,
    refreshToken: showRichSections,
  });

  useEffect(() => {
    if (!telemetryEnabled) {
      return undefined;
    }
    let active = true;
    const loadSnapshot = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      try {
        if (!isAuthenticated()) {
          const publicData = await fetchPublicTelemetrySnapshot();
          const summary = publicData.summary || {};
          const feed = Array.isArray(publicData.feed) ? publicData.feed : [];
          const publicTimeline = feed.slice(0, 5).map((event, index) => toTimelineItem(event, index));
          if (!active) {
            return;
          }
          startTransition(() => {
            setBackendOnline(true);
            setSnapshot({
              totalAttacks: Number(summary.total_events || 0),
              criticalThreats: Number(summary.critical_events || 0),
              blockedIps: Number(summary.blocked_ips || 0),
              liveSessions: Number(summary.live_sessions || 0),
              uniqueIps: Number(summary.unique_ips || 0),
              activeDecoys: Number(summary.active_decoys || 0),
              threatScore: Number(summary.threat_score || 0),
              topDecoy: String(summary.top_target || "").trim(),
            });
            setAttackTimeline(publicTimeline);
            setAnalystSummary(String(publicData.ai_summary || "").trim() || buildAnalystSummary(feed));
          });
          return;
        }

        const authHeaders = buildAuthHeaders({ Accept: "application/json" });
        const res = await fetch(`${API_BASE}/dashboard/stats?include_training=false`, { headers: authHeaders });
        if (!res.ok) {
          throw new Error(`Dashboard stats request failed: ${res.status}`);
        }
        const data = await res.json();
        const summary = data?.summary || {};
        const feed = Array.isArray(data?.feed) ? data.feed : [];
        const trapDistribution = data?.trap_distribution || {};
        const totalAttacks = Number(summary.total || 0);
        const criticalThreats = Number(summary.critical || 0);
        const blockedIps = Number(summary.blocked || 0);
        const uniqueIps = new Set(feed.map((event) => String(event?.ip || "").trim()).filter(Boolean)).size;
        const activeDecoys = Object.keys(trapDistribution).length;
        const topDecoy =
          String(Object.entries(trapDistribution).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || "").trim();
        const threatScore =
          totalAttacks === 0
            ? 0
            : Math.min(99, Math.round((criticalThreats / Math.max(totalAttacks, 1)) * 70 + Math.min(feed.length, 20) * 1.5 + 20));
        const timeline = feed.slice(0, 5).map((event, index) => toTimelineItem(event, index));

        if (!active) {
          return;
        }
        startTransition(() => {
          setSnapshot({
            totalAttacks,
            criticalThreats,
            blockedIps,
            liveSessions: feed.length,
            uniqueIps,
            activeDecoys,
            threatScore,
            topDecoy,
          });
          setAttackTimeline(timeline);
          setAnalystSummary(buildAnalystSummary(feed));
          setBackendOnline(true);
        });
      } catch {
        if (!active) {
          return;
        }
        startTransition(() => {
          setBackendOnline(false);
        });
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") {
        return;
      }
      void loadSnapshot();
    };
    void loadSnapshot();
    const interval = setInterval(() => {
      void loadSnapshot();
    }, 15000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [telemetryEnabled]);

  useEffect(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return undefined;
    }
    const interval = window.setInterval(() => {
      setActiveWalkthrough((current) => (current + 1) % 3);
    }, 3600);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    let revealed = false;
    const unlockInteractiveExperience = () => {
      if (revealed) {
        return;
      }
      revealed = true;
      startTransition(() => {
        setShowRichSections(true);
      });
      setTelemetryEnabled(true);
      setMotionEnabled(true);
    };
    const onScroll = () => {
      if ((window.scrollY || 0) > 120) {
        unlockInteractiveExperience();
      }
    };
    const onPointerDown = () => {
      unlockInteractiveExperience();
    };
    const onKeyDown = () => {
      unlockInteractiveExperience();
    };
    const onHashChange = () => {
      if (window.location.hash) {
        unlockInteractiveExperience();
      }
    };

    if (window.location.hash) {
      unlockInteractiveExperience();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  const hasLiveEventData = attackTimeline.length > 0 || snapshot.totalAttacks > 0 || snapshot.liveSessions > 0;
  const threatScoreLabel = snapshot.threatScore > 0 ? `${snapshot.threatScore}/100` : "No score yet";
  const activeLuresLabel = snapshot.activeDecoys > 0 ? `${snapshot.activeDecoys} active lures` : "No live lures yet";
  const activeSurfacesLabel = snapshot.activeDecoys > 0 ? `${snapshot.activeDecoys} active surfaces` : "No live surfaces yet";
  const liveSessionsLabel = snapshot.liveSessions > 0 ? `${snapshot.liveSessions} live sessions` : "No live sessions yet";
  const eventHitsLabel = snapshot.totalAttacks > 0 ? `${snapshot.totalAttacks} event hits` : "No event hits yet";
  const blockedIpsLabel = snapshot.blockedIps > 0 ? `${snapshot.blockedIps} blocked IPs` : "No blocked IPs yet";
  const topDecoyLabel = snapshot.topDecoy || "No live lure yet";
  const runtimeStatusLabel = backendOnline ? "Online" : "Degraded";
  const snapshotSignal = hasLiveEventData ? "Live signal present" : "Signal warming";
  const defenseCoverageLabel = snapshot.activeDecoys > 0 ? `${snapshot.activeDecoys} decoy surfaces armed` : "Decoy surfaces arming";
  const evidenceDepthLabel = snapshot.totalAttacks > 0 ? `${snapshot.totalAttacks} event records` : "Event records pending";
  const responseReadinessLabel = snapshot.blockedIps > 0 ? `${snapshot.blockedIps} block actions prepared` : "Block actions pending";
  const proofCards = [
    { label: "Runtime status", value: runtimeStatusLabel, detail: "Public API and telemetry path availability." },
    { label: "Threat confidence", value: threatScoreLabel, detail: "AI-assisted signal confidence from live activity." },
    { label: "Coverage state", value: defenseCoverageLabel, detail: "How many decoy surfaces are actively collecting." },
    { label: "Evidence depth", value: evidenceDepthLabel, detail: "Captured records ready for analyst review." },
    { label: "Response path", value: responseReadinessLabel, detail: "Edge/WAF response readiness from observed behavior." },
    { label: "Top targeted lure", value: topDecoyLabel, detail: "Most hit deception surface in the latest window." },
  ];
  const readinessChecklist = [
    `Detection signal: ${snapshotSignal}`,
    `Analyst context: ${analystSummary}`,
    `Live sessions: ${liveSessionsLabel}`,
    `Critical events: ${snapshot.criticalThreats > 0 ? snapshot.criticalThreats : "No critical events yet"}`,
    `Unique source IPs: ${snapshot.uniqueIps > 0 ? snapshot.uniqueIps : "No source IPs yet"}`,
  ];
  const publicHealthUrl = "/api/health";
  const publicSnapshotUrl = "/api/public/telemetry/snapshot";

  const highlights = [
    { label: "Active decoys", value: snapshot.activeDecoys },
    { label: "Threat score", value: threatScoreLabel },
    { label: "Unique IPs", value: snapshot.uniqueIps },
  ];
  const homeConsoleNodes = [
    { label: topDecoyLabel, meta: snapshot.topDecoy ? "Most targeted lure" : "Most targeted lure pending" },
    { label: snapshot.activeDecoys > 0 ? `${snapshot.activeDecoys} decoys armed` : "No armed decoys yet", meta: "Coverage state" },
    { label: snapshot.uniqueIps > 0 ? `${snapshot.uniqueIps} source IPs` : "No source IPs yet", meta: "Observed sources" },
    { label: liveSessionsLabel, meta: "Current session pressure" },
  ];
  const homeProtocolLanes = [
    {
      label: "Web decoys",
      value: snapshot.liveSessions > 0 ? `${snapshot.liveSessions} live sessions` : "Waiting for session flow",
      intensity: snapshot.liveSessions > 0 ? Math.min(96, 38 + snapshot.liveSessions * 8 + snapshot.criticalThreats * 4) : 0,
    },
    {
      label: "API traps",
      value: snapshot.activeDecoys > 0 ? `${snapshot.activeDecoys} decoys armed` : "Waiting for active decoys",
      intensity: snapshot.activeDecoys > 0 ? Math.min(92, 34 + snapshot.activeDecoys * 7 + snapshot.uniqueIps * 3) : 0,
    },
    {
      label: "AI triage",
      value: snapshot.threatScore > 0 ? `Confidence ${threatScoreLabel}` : "Waiting for threat score",
      intensity: snapshot.threatScore > 0 ? Math.min(98, 45 + Math.round(snapshot.threatScore * 0.45)) : 0,
    },
  ];
  const homeConsoleFeed =
    attackTimeline.length > 0
      ? attackTimeline.slice(0, 4)
      : [
          { id: "waiting-events", ts: "--:--:--", path: "Waiting for live attacker events", severity: "low" },
          { id: "waiting-replay", ts: "--:--:--", path: "Replay starts after the first suspicious touch", severity: "low" },
          { id: "waiting-brief", ts: "--:--:--", path: "AI brief updates when telemetry arrives", severity: "low" },
        ];
  const walkthroughFrames = [
    {
      label: "Step 1",
      title: "Trap activation",
      detail: "A decoy route is armed around the public edge so recon lands in a controlled surface first.",
      stats: [activeLuresLabel, topDecoyLabel],
    },
    {
      label: "Step 2",
      title: "Path capture",
      detail: "The platform records route order, timing, and suspicious movement as the session unfolds.",
      stats: [liveSessionsLabel, eventHitsLabel],
    },
    {
      label: "Step 3",
      title: "Operator brief",
      detail: "AI condenses the first-touch sequence into a short summary and readiness checks point to next action.",
      stats: [threatScoreLabel, blockedIpsLabel],
    },
  ];
  const demoFrame = DEMO_CHAPTERS[activeWalkthrough] || DEMO_CHAPTERS[0];

  return (
    <div className={`marketing-shell marketing-shell-home ${motionEnabled ? "marketing-motion-on" : "marketing-motion-paused"}`}>
      <PublicHeader variant="cred" pagePath="/" includeHomeAnchors />

      <main className="marketing-main">
        <section className="marketing-hero marketing-hero-home">
          <article className="marketing-card marketing-hero-copy">
            <div className="marketing-badge">AI-enhanced deception security platform</div>
            <div className="marketing-hero-signal">
              {IMPACT_POINTS.map((item, index) => (
                <span key={item} style={{ "--hero-delay": index }}>{item}</span>
              ))}
            </div>
            <h1 className="marketing-title">Turn public attack traffic into deception telemetry, attacker intelligence, and operator-ready response.</h1>
            <p className="marketing-subtitle">
              {productName} turns noisy internet attack traffic into a usable defender workflow: detect early, preserve evidence, explain intent with AI,
              and move to response before attacker reconnaissance becomes breach pressure.
            </p>
            <div className="marketing-inline-points">
              {TRUST_POINTS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="marketing-actions">
              <Link to={toCampaignPath("/platform")} className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("explore_platform", "/")}>
                Start Live Tour <ArrowRight size={16} />
              </Link>
              <Link to={toCampaignPath("/demo")} className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("request_demo", "/")}>
                Request Demo
              </Link>
              <Link to={toCampaignPath("/screenshots")} className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("view_screenshots_gallery", "/")}>
                See Product Proof
              </Link>
            </div>
            <div className="marketing-mini-pill-row" aria-label="Validation assets">
              {HERO_PROOF_PILLS.map((item) => (
                <span key={item} className="marketing-mini-pill">{item}</span>
              ))}
            </div>
            <div className="marketing-highlight-row">
              {highlights.map((item) => (
                <div key={item.label} className="marketing-highlight">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="marketing-hero-story">
              <div className="marketing-hero-story-head">
                <span className="marketing-kicker">Why teams deploy it</span>
                <strong>One workflow for public-edge detection, analyst review, and response handoff.</strong>
              </div>
              <ul className="marketing-checklist marketing-checklist-compact">
                {BUYER_POINTS.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="marketing-hero-walkthrough">
              <div className="marketing-hero-walkthrough-head">
                <span className="marketing-kicker">Guided walkthrough</span>
                <strong>Watch the operator flow move from lure to AI-backed handoff.</strong>
              </div>
              <div className="marketing-hero-walkthrough-tabs" aria-label="Guided walkthrough">
                {walkthroughFrames.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    className={`marketing-hero-walkthrough-tab ${index === activeWalkthrough ? "is-active" : ""}`}
                    onClick={() => setActiveWalkthrough(index)}
                    aria-pressed={index === activeWalkthrough}
                  >
                    <span>{item.label}</span>
                    <strong>{item.title}</strong>
                  </button>
                ))}
              </div>
              <div className="marketing-hero-walkthrough-card">
                <p>{walkthroughFrames[activeWalkthrough].detail}</p>
                <div className="marketing-hero-walkthrough-stats">
                  {walkthroughFrames[activeWalkthrough].stats.map((item) => (
                    <strong key={item}>{item}</strong>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <aside className="marketing-card marketing-hero-panel marketing-stage marketing-stage-console">
            <div className="marketing-stage-top">
              <div>
                <div className="marketing-kicker">Live deception mesh</div>
                <h2>High-interaction command view</h2>
              </div>
              <span className={`marketing-status ${backendOnline ? "online" : "offline"}`}>
                {backendOnline ? "Online" : "Offline"}
              </span>
            </div>

            <div className="marketing-console-shell">
              <div className="marketing-console-head">
                <span>Decoy mesh armed</span>
                <strong>{activeSurfacesLabel}</strong>
              </div>
              <div className="marketing-deception-map">
                <span className="marketing-deception-trace marketing-deception-trace-v" />
                <span className="marketing-deception-trace marketing-deception-trace-top" />
                <span className="marketing-deception-trace marketing-deception-trace-bottom" />
                <div className="marketing-deception-node marketing-deception-node-1">
                  <small>{homeConsoleNodes[0].meta}</small>
                  <strong>{homeConsoleNodes[0].label}</strong>
                </div>
                <div className="marketing-deception-node marketing-deception-node-2">
                  <small>{homeConsoleNodes[1].meta}</small>
                  <strong>{homeConsoleNodes[1].label}</strong>
                </div>
                <div className="marketing-deception-node marketing-deception-node-core">
                  <small>AI Sentinel</small>
                  <strong>{threatScoreLabel}</strong>
                  <span>Threat score</span>
                </div>
                <div className="marketing-deception-node marketing-deception-node-3">
                  <small>{homeConsoleNodes[2].meta}</small>
                  <strong>{homeConsoleNodes[2].label}</strong>
                </div>
                <div className="marketing-deception-node marketing-deception-node-4">
                  <small>{homeConsoleNodes[3].meta}</small>
                  <strong>{homeConsoleNodes[3].label}</strong>
                </div>
              </div>
              <div className="marketing-signal-lanes">
                {homeProtocolLanes.map((item) => (
                  <div key={item.label} className="marketing-signal-lane">
                    <div className="marketing-signal-lane-meta">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                    <div className="marketing-signal-lane-bar">
                      <span style={{ width: `${item.intensity}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="marketing-stage-summary">
              <div className="marketing-summary-head">
                <BrainCircuit size={16} />
                <span>AI incident brief</span>
              </div>
              <p>{analystSummary}</p>
            </div>

            <div className="marketing-stage-grid">
              <MetricCard label="Attacks today" value={snapshot.totalAttacks} />
              <MetricCard label="Critical threats" value={snapshot.criticalThreats} />
              <MetricCard label="Blocked IPs" value={snapshot.blockedIps} />
              <MetricCard label="Live sessions" value={snapshot.liveSessions} />
            </div>

            <div className="marketing-stage-strip">
              <div>
                <span>Top decoy</span>
                <strong>{topDecoyLabel}</strong>
              </div>
              <div>
                <span>Monitoring</span>
                <strong>Deception active</strong>
              </div>
            </div>
            <div className="marketing-stage-feed marketing-stage-feed-console">
              <div className="marketing-stage-feed-head">
                <Activity size={14} />
                <span>Recent session activity</span>
              </div>
              <ul className="marketing-stage-feed-list marketing-stage-feed-list-rich">
                {homeConsoleFeed.map((item) => (
                  <li key={item.id}>
                    <span>{item.ts}</span>
                    <code>{item.path}</code>
                    <b className={`severity severity-${item.severity}`}>{item.severity}</b>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </section>

        <section id="telemetry" className="marketing-card marketing-live-ribbon">
          <div className="marketing-live-ribbon-head">
            <Activity size={15} />
            <strong>Live telemetry snapshot</strong>
          </div>
          <div className="marketing-live-ribbon-stream">
            {(attackTimeline.length > 0 ? attackTimeline : [{ id: "waiting", ts: "--:--:--", path: "Waiting for live attacker events", severity: "low" }]).map((item) => (
              <div key={item.id} className="marketing-live-pill-item">
                <span>{item.ts}</span>
                <code>{item.path}</code>
              </div>
            ))}
          </div>
        </section>

        <section className="marketing-card marketing-live-ribbon marketing-lazy-section">
          <div className="marketing-live-ribbon-head">
            <ShieldCheck size={15} />
            <strong>Technical validation strip</strong>
          </div>
          <div className="marketing-live-ribbon-stream">
            {VALIDATION_SIGNAL_BAR.map((item) => (
              <div key={item} className="marketing-live-pill-item">
                <span>Proof</span>
                <code>{item}</code>
              </div>
            ))}
          </div>
        </section>

        <section className="marketing-section marketing-lazy-section">
          <div className="marketing-section-head">
            <p>Hard differentiation</p>
            <h2>Why this platform is stronger than baseline security tooling.</h2>
          </div>
          <div className="marketing-grid-2">
            {HARD_DIFFERENTIATORS.map((item) => (
              <article key={item.title} className="marketing-card marketing-showcase">
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section marketing-lazy-section">
          <div className="marketing-section-head">
            <p>Proof-first view</p>
            <h2>Operational evidence buyers and reviewers can verify quickly.</h2>
          </div>
          <div className="marketing-grid-3">
            {proofCards.map((item) => (
              <article key={item.label} className="marketing-card marketing-feature">
                <h3>{item.label}</h3>
                <p style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "6px" }}>{item.value}</p>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
          <div className="marketing-grid-2" style={{ marginTop: "12px" }}>
            <article className="marketing-card marketing-list-card">
              <div className="marketing-section-head">
                <p>Readiness checklist</p>
                <h2>What a technical evaluator can inspect now.</h2>
              </div>
              <ul className="marketing-checklist marketing-checklist-compact">
                {readinessChecklist.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="marketing-actions">
                <a href={publicHealthUrl} className="marketing-btn marketing-btn-secondary" target="_blank" rel="noreferrer">
                  Open API Health
                </a>
                <a href={publicSnapshotUrl} className="marketing-btn marketing-btn-secondary" target="_blank" rel="noreferrer">
                  Open Public Snapshot
                </a>
              </div>
            </article>

            <article className="marketing-card marketing-list-card">
              <div className="marketing-section-head">
                <p>Why this stands out</p>
                <h2>Difference between this platform and baseline security tooling.</h2>
              </div>
              <ul className="marketing-list">
                {COMPETITIVE_ROWS.map((row, index) => (
                  <li key={row.label} className="simple marketing-plan-compare-row">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{row.label}</strong>
                      <p>{row.ours}</p>
                      <p style={{ opacity: 0.78 }}>Typical alternatives: {row.generic}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        {showRichSections ? (
          <>
            <section className="marketing-card marketing-top-trust-strip marketing-lazy-section">
              <div className="marketing-top-trust-head">
                <div className="marketing-top-trust-copy">
                  <span className="marketing-kicker">Buyer confidence</span>
                  <h2>Built for serious operator review, not just a concept landing page.</h2>
                    <p>Teams evaluate three things first: fit, deployment quality, and operational readiness. This section answers those quickly.</p>
                </div>
                <div className="marketing-top-trust-badges" aria-label="Built for these teams">
                  {TRUST_AUDIENCE_STRIP.map((item) => (
                    <span key={item} className="marketing-top-trust-badge">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="marketing-top-trust-ledger">
                {TRUST_LEDGER.map((item) => (
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

            <section className="marketing-section marketing-lazy-section">
              <div className="marketing-section-head">
                <p>Interactive preview</p>
                <h2>A guided product demo built into the page.</h2>
              </div>
              <div className="marketing-grid-2 marketing-demo-band">
                <article className="marketing-card marketing-demo-player">
                  <div className="marketing-demo-topbar">
                    <div className="marketing-demo-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="marketing-demo-label">
                      <span>{productName} demo</span>
                      <strong>{demoFrame.title}</strong>
                    </div>
                  </div>
                  <div className="marketing-demo-screen">
                    <div className="marketing-demo-screen-grid">
                      <div className="marketing-demo-pane marketing-demo-pane-primary">
                        <div className="marketing-demo-pane-head">
                          <span className="marketing-kicker">Live attacker path</span>
                          <strong>{hasLiveEventData ? homeConsoleFeed[0]?.path : "Waiting for live attacker path"}</strong>
                        </div>
                        <div className="marketing-demo-wave">
                          {homeProtocolLanes.map((item, index) => (
                            <div key={item.label} className="marketing-demo-wave-row" style={{ "--lane-delay": index }}>
                              <span>{item.label}</span>
                              <div><b style={{ width: `${item.intensity}%` }} /></div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="marketing-demo-pane">
                        <div className="marketing-demo-pane-head">
                          <span className="marketing-kicker">AI brief</span>
                          <strong>Readable operator context</strong>
                        </div>
                        <p>{analystSummary}</p>
                      </div>
                      <div className="marketing-demo-pane marketing-demo-pane-wide">
                        <div className="marketing-demo-chapters">
                          {DEMO_CHAPTERS.map((item, index) => (
                            <button
                              key={item.title}
                              type="button"
                              className={`marketing-demo-chapter ${index === activeWalkthrough ? "is-active" : ""}`}
                              onClick={() => setActiveWalkthrough(index)}
                            >
                              <span>{String(index + 1).padStart(2, "0")}</span>
                              <div>
                                <strong>{item.title}</strong>
                                <p>{item.detail}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="marketing-demo-play">
                      <div className="marketing-demo-play-button">
                        <span />
                      </div>
                      <strong>Interactive product preview</strong>
                    </div>
                  </div>
                </article>

                <article className="marketing-card marketing-demo-copy">
                  <div className="marketing-section-head">
                    <p>What this shows</p>
                    <h2>The platform path buyers need to understand before opening the full product.</h2>
                  </div>
                  <p>
                    This preview condenses the first-touch workflow into one guided view: decoy activation, suspicious route capture,
                    AI-assisted incident context, and operator-ready next steps. It is designed to answer the first product question fast:
                    "what will my team actually see?"
                  </p>
                  <ul className="marketing-checklist marketing-checklist-compact">
                    <li>
                      <CheckCircle2 size={16} />
                      <span>Shows the operator-facing workflow without opening the dashboard.</span>
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      <span>Matches the same telemetry, AI brief, and readiness story shown elsewhere on the site.</span>
                    </li>
                    <li>
                      <CheckCircle2 size={16} />
                      <span>Lets visitors understand the product before they commit to a demo call.</span>
                    </li>
                  </ul>
                  <div className="marketing-actions">
                    <Link to={toCampaignPath("/demo")} className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("request_demo", "/")}>
                      Request Demo
                    </Link>
                    <Link to={toCampaignPath("/platform")} className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("explore_platform", "/")}>
                      Explore Platform
                    </Link>
                    <Link to={toCampaignPath("/case-study")} className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("view_case_study", "/")}>
                      View Case Study
                    </Link>
                  </div>
                </article>
              </div>
            </section>

            <section className="marketing-section marketing-lazy-section">
              <div className="marketing-section-head">
                <p>Launch trust</p>
                <h2>Immediate credibility signals buyers expect before they spend time on the rest of the site.</h2>
              </div>
              <div className="marketing-launch-ribbon">
                {LAUNCH_SIGNALS.map((item) => (
                  <article key={item.title} className="marketing-card marketing-launch-chip">
                    <div className="marketing-impact-head">
                      <div className="marketing-icon-box">{item.icon}</div>
                      <span className="marketing-impact-signal">{item.title}</span>
                    </div>
                    <p>{item.detail}</p>
                    <Link to={toCampaignPath(item.to)} className="marketing-route-link" onClick={() => trackCtaClick(`launch_${item.cta.toLowerCase()}`, "/")}>
                      {item.cta} <ArrowRight size={15} />
                    </Link>
                  </article>
                ))}
              </div>
            </section>

            <section className="marketing-section marketing-lazy-section">
              <div className="marketing-section-head">
                <p>Real screens</p>
                <h2>Actual screenshots captured from the current local build, not illustration cards.</h2>
              </div>
              <div className="marketing-screenshot-grid">
                {SCREENSHOT_GALLERY.map((item) => (
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
              <div className="marketing-mini-pill-row">
                <span className="marketing-mini-pill">Captured from the running local stack</span>
                <span className="marketing-mini-pill">Dashboard, threat intel, and forensics views</span>
                <span className="marketing-mini-pill">Use Request Demo for a guided live walkthrough</span>
              </div>
              <div className="marketing-actions">
                <Link
                  to={toCampaignPath("/screenshots")}
                  className="marketing-btn marketing-btn-primary"
                  onClick={() => trackCtaClick("view_screenshots_gallery", "/")}
                >
                  Open Screenshots Gallery
                </Link>
                <Link
                  to={toCampaignPath("/demo")}
                  className="marketing-btn marketing-btn-secondary"
                  onClick={() => trackCtaClick("request_demo", "/")}
                >
                  Request Demo
                </Link>
              </div>
            </section>
          </>
        ) : (
          <section className="marketing-section marketing-lazy-section">
            <article className="marketing-card marketing-showcase">
              <h3>Interactive modules ready</h3>
              <p>Deep demo, launch-trust lane, and screenshot proof gallery load after interaction.</p>
              <div className="marketing-actions">
                <button
                  type="button"
                  className="marketing-btn marketing-btn-secondary"
                  onClick={() => {
                    startTransition(() => {
                      setShowRichSections(true);
                    });
                    setTelemetryEnabled(true);
                    setMotionEnabled(true);
                  }}
                >
                  Load Full Experience
                </button>
              </div>
            </article>
          </section>
        )}

        <section className="marketing-section marketing-lazy-section">
          <div className="marketing-section-head">
            <p>Start here</p>
            <h2>Modern buyers do not read everything. They look for product, integration, deployment, and trust in the first few clicks.</h2>
          </div>
          <div className="marketing-grid-2 marketing-route-grid">
            {EVALUATION_PATHS.map((item) => (
              <article key={item.title} className="marketing-card marketing-route-card">
                <div className="marketing-impact-head">
                  <div className="marketing-icon-box">{item.icon}</div>
                  <span className="marketing-impact-signal">{item.title}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <Link to={toCampaignPath(item.to)} className="marketing-route-link" onClick={() => trackCtaClick(`home_${item.cta.replace(/\s+/g, "_").toLowerCase()}`, "/")}>
                  {item.cta} <ArrowRight size={15} />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section id="problem" className="marketing-band marketing-card marketing-proof-band marketing-lazy-section">
          <div className="marketing-proof-copy">
            <p className="marketing-kicker">Mission fit</p>
            <h2>Built for teams that need evidence before attacker movement becomes customer impact, outage risk, or breach pressure.</h2>
          </div>
          <div className="marketing-proof-grid">
            {FEATURE_CARDS.map((feature) => (
              <article key={feature.title} className="marketing-proof-item">
                <div className="marketing-icon-box">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="features" className="marketing-section marketing-lazy-section">
          <div className="marketing-section-head">
            <p>How it works</p>
            <h2>One simple product story from first touch to analyst response</h2>
          </div>
          <div className="marketing-grid-3">
            {PRODUCT_STEPS.map((step) => (
              <article key={step.title} className="marketing-card marketing-step">
                <div className="marketing-icon-box">{step.icon}</div>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section marketing-lazy-section">
          <div className="marketing-section-head">
            <p>Use cases</p>
            <h2>Where the platform fits best</h2>
          </div>
          <div className="marketing-grid-2">
            {USE_CASES.map((item) => (
              <article key={item.title} className="marketing-card marketing-showcase">
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section marketing-lazy-section">
          <div className="marketing-grid-2 marketing-home-lower">
            <article className="marketing-card marketing-list-card">
              <div className="marketing-section-head">
                <p>Live activity</p>
                <h2>Recent telemetry from the event stream</h2>
              </div>
              {attackTimeline.length === 0 ? (
                <p className="marketing-empty">No active timeline yet. Waiting for live events.</p>
              ) : (
                <ul className="marketing-timeline">
                  {attackTimeline.map((item) => (
                    <li key={item.id}>
                      <span className="marketing-timeline-time">{item.ts}</span>
                      <code>{item.path}</code>
                      <b className={`severity severity-${item.severity}`}>{item.severity}</b>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="marketing-card marketing-list-card">
              <div className="marketing-section-head">
                <p>Mission impact</p>
                <h2>Why the platform matters in real environments</h2>
              </div>
              <ul className="marketing-checklist">
                {CHECKLIST_ITEMS.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="marketing-radar-box">
                <div className="marketing-icon-box">
                  <Radar size={18} />
                </div>
                <div>
                  <strong>Readiness focus</strong>
                  <p>Use the same deception workflow for monitoring, exercises, analyst training, and incident review.</p>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="marketing-card marketing-cta marketing-lazy-section">
          <div className="marketing-cta-copy">
            <h2>Need earlier signal, clearer evidence, and a market-ready deception workflow?</h2>
            <p>{productName} helps teams catch suspicious interaction earlier, preserve the attacker path, and move from public attack traffic to response-ready evidence fast.</p>
          </div>
          <div className="marketing-actions">
            <Link to={toCampaignPath("/platform")} className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("view_platform", "/")}>
              View Platform
            </Link>
            <Link to={toCampaignPath("/contact")} className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("contact_team", "/")}>
              Contact Team
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="marketing-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
