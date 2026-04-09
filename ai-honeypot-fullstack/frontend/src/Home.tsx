import { startTransition, useEffect, useState } from "react";
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
import { AUTH_CHANGED_EVENT, buildAuthHeaders, isAuthenticated } from "./utils/auth";
import { loadAuthProviders } from "./utils/authProviders";
import { buildCampaignAwarePath } from "./utils/campaignLinks";
import { fetchPublicTelemetrySnapshot, type PublicTelemetrySnapshot } from "./utils/publicTelemetry";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";
import { PUBLIC_SITE } from "./siteConfig";

type HomeSnapshot = {
  totalAttacks: number;
  criticalThreats: number;
  blockedIps: number;
  liveSessions: number;
  uniqueIps: number;
  activeDecoys: number;
  threatScore: number;
  topDecoy: string;
};

type FeedEvent = {
  id?: string | number | null;
  ts?: string | number | null;
  timestamp?: string | number | null;
  path?: string;
  url_path?: string;
  cmd?: string;
  event_type?: string | null;
  severity?: string | null;
  ip?: string | null;
};

type TimelineItem = {
  id: string;
  ts: string;
  path: string;
  severity: string;
};

const FEATURE_CARDS = [
  {
    title: "Believable decoy routes",
    desc: "Place decoy login, admin, and API paths where attackers normally probe first so recon lands in a controlled surface instead of production.",
    icon: <ShieldAlert size={18} />,
  },
  {
    title: "Readable attacker evidence",
    desc: "Turn first-touch activity into a short incident brief with route order, severity, and intent so analysts can explain what happened quickly.",
    icon: <BrainCircuit size={18} />,
  },
  {
    title: "One operator workflow",
    desc: "Review the attacker path, supporting evidence, and the recommended next step from one dashboard instead of stitching logs by hand.",
    icon: <Activity size={18} />,
  },
];

const PRODUCT_STEPS = [
  {
    title: "Deploy decoy surfaces",
    detail: "Expose believable login, admin, and API-style routes where attackers usually begin reconnaissance and password spraying.",
    icon: <LockKeyhole size={18} />,
  },
  {
    title: "Capture the attacker path",
    detail: "Track route order, IPs, timing, repeated probes, and suspicious movement as the session unfolds.",
    icon: <ScanSearch size={18} />,
  },
  {
    title: "Respond with evidence",
    detail: "Use summaries, replay, and analyst-ready context to brief the team before reconnaissance turns into production pressure.",
    icon: <Bot size={18} />,
  },
];

const TRUST_AUDIENCE_STRIP = ["SaaS security teams", "Lean SOC teams", "MSSPs", "Customer portals"];

const TRUST_LEDGER = [
  {
    title: "Pilot-ready",
    detail: "Docker stack, PostgreSQL path, and guided production settings keep the first rollout practical.",
    icon: <Server size={18} />,
  },
  {
    title: "Operator-readable",
    detail: "Readable telemetry, preserved attacker path, and analyst context reduce investigation friction.",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "Action-ready",
    detail: "One path for live monitoring, investigation, response handoff, and readiness review.",
    icon: <Workflow size={18} />,
  },
  {
    title: "Buyer-safe",
    detail: "Security disclosure, guarded deployment language, and proof assets make the product easier to trust.",
    icon: <Building2 size={18} />,
  },
];

const USE_CASES = [
  {
    title: "SaaS and customer portals",
    detail: "Catch probing against login, admin, support, and API-style routes before attackers touch the real application flow.",
  },
  {
    title: "Lean SOC teams",
    detail: "Give smaller security teams a readable path from first suspicious touch to analyst-ready response context.",
  },
  {
    title: "MSSP customer environments",
    detail: "Support proof sharing, customer reporting, and response handoff across managed environments.",
  },
];

const GLOBAL_REGION_STRIP = ["India and Southeast Asia", "United States", "Europe", "Middle East"];

const GLOBAL_MARKET_PILLARS = [
  {
    title: "Company-market fit first",
    detail: "Start with one exposed app, one team, and one clear operator workflow so the first customer proof is practical.",
    icon: <Building2 size={18} />,
  },
  {
    title: "Repeatable SaaS delivery",
    detail: "Multi-tenant onboarding, telemetry collection, and guided deployment make the product easier to repeat across accounts and regions.",
    icon: <Server size={18} />,
  },
  {
    title: "Channel and MSSP motion",
    detail: "The same evidence-first workflow can support service providers, customer reporting, and partner-led rollout conversations.",
    icon: <Workflow size={18} />,
  },
  {
    title: "World-market relevance",
    detail: "Public login, admin, and API routes are global attack surfaces, so the product story travels across regions more cleanly than local-only tooling.",
    icon: <Link2 size={18} />,
  },
];

const CATEGORY_PILLARS = [
  {
    title: "Not another passive alert dashboard",
    detail: "Visitors should immediately see attacker path, decoy coverage, and operator action instead of generic cyber charts with no product angle.",
    icon: <Activity size={18} />,
  },
  {
    title: "Not a lab-only honeypot story",
    detail: "The product is framed around exposed login, admin, and API routes that teams actually need to defend in customer-facing environments.",
    icon: <ShieldAlert size={18} />,
  },
  {
    title: "Not an AI wrapper on top of logs",
    detail: "AI sits on top of captured deception context, route order, and session behavior so the site feels like a real system, not a prompt trick.",
    icon: <BrainCircuit size={18} />,
  },
];

const CATEGORY_DECISION_BOARD = [
  { label: "Category", value: "High-interaction deception system" },
  { label: "Best first buyer", value: "Public-facing SaaS or MSSP team" },
  { label: "Core scene", value: "Login, admin, and API edges" },
  { label: "Why it matters", value: "Evidence before production pressure" },
];

const SIGNATURE_RAIL = [
  {
    title: "Believable edge routes",
    detail: "Decoy login, admin, and API surfaces sit where attackers normally begin, so the first suspicious touch lands inside a controlled path.",
  },
  {
    title: "Stateful session capture",
    detail: "The system preserves route order, timing, commands, and repeated probes so the operator sees a session narrative instead of one isolated alert.",
  },
  {
    title: "Signed evidence handoff",
    detail: "Replay, analyst summary, and integrity-backed report output make the result feel operational, not like a mock dashboard export.",
  },
];

const DIFFERENTIATOR_STACK = [
  {
    title: "Harder to fake than a dashboard clone",
    detail: "The website now sells the underlying workflow: believable trap surfaces, session memory, and evidence integrity instead of generic cyber charts.",
  },
  {
    title: "Built around attacker behavior, not vanity metrics",
    detail: "The first screen starts with route pressure, live path, and analyst context so buyers understand the product in seconds.",
  },
  {
    title: "Safe enough for real rollout conversations",
    detail: "Deployment, proof, and trust copy stay disciplined around isolated decoys and production-adjacent pilot language.",
  },
  {
    title: "Ownable category language",
    detail: "High-interaction deception for exposed routes is sharper and more defensible than a broad AI-security-platform claim.",
  },
];

const PROOF_ASSET_PACK = [
  {
    title: "Representative pilot snapshot",
    detail: "Use a clear sample metric block so buyers understand the first success criteria before a live rollout.",
    icon: <Building2 size={18} />,
    stats: ["1 exposed app pilot", "3 trapped route touches", "13-minute session window"],
  },
  {
    title: "Guided walkthrough path",
    detail: "Show what the team will see live: route pressure, AI brief, replay path, and final evidence handoff.",
    icon: <Bot size={18} />,
    stats: ["Edge traps armed", "Operator brief ready", "Replay plus final report"],
  },
  {
    title: "Evidence pack",
    detail: "Give one place to open the sample incident, screenshots, and downloadable report before the demo conversation starts.",
    icon: <ShieldCheck size={18} />,
    stats: ["Sample incident", "Screenshots gallery", "Downloadable report"],
  },
];

const EVALUATION_PATHS = [
  {
    title: "Sample Incident",
    detail: "See the attacker path, analyst brief, and evidence shape buyers expect before they book time.",
    to: "/case-study",
    cta: "View sample incident",
    icon: <Radar size={18} />,
  },
  {
    title: "Platform Tour",
    detail: "See the operator workflow, telemetry surfaces, replay path, and analyst output first.",
    to: "/platform",
    cta: "Explore platform",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "Pricing",
    detail: "See the guided pilot, rollout scope, and pricing path before you ask for access.",
    to: "/pricing",
    cta: "View pricing",
    icon: <Link2 size={18} />,
  },
  {
    title: "Technical Review",
    detail: "Open the technical-review hub for security, integrations, deployment, and architecture pages.",
    to: "/resources",
    cta: "Open resources",
    icon: <LockKeyhole size={18} />,
  },
];

const TRUST_SHORTCUTS = [
  {
    title: "Integrations",
    detail: "The current build already supports the site ingest contract, Cloudflare Worker relay, Microsoft 365 relay, and Splunk validation paths.",
    to: "/integrations",
    cta: "View integrations",
    icon: <Link2 size={18} />,
  },
  {
    title: "Deployment",
    detail: "Docker plus PostgreSQL, trusted hosts, HTTPS guardrails, launch preflight, and ops readiness checks support a safer rollout path.",
    to: "/deployment",
    cta: "Review deployment",
    icon: <Server size={18} />,
  },
  {
    title: "Security posture",
    detail: "The product story stays grounded in isolated decoys, bounded operator access, and disclosure language that avoids risky attack-back claims.",
    to: "/security",
    cta: "Open security",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "Technical resources",
    detail: "Architecture, screenshots, sample incident proof, and rollout docs are grouped into one review lane for technical evaluators.",
    to: "/resources",
    cta: "Open resources",
    icon: <Workflow size={18} />,
  },
];

const BUYER_FAQ = [
  {
    question: "How does a team start with the platform?",
    answer:
      "Start with one exposed app or portal, issue a site API key, arm the decoy routes, then confirm the signal in telemetry, forensics, and ops-readiness views.",
  },
  {
    question: "Can it connect to existing edge and provider signals?",
    answer:
      "Yes. The current repo already includes the ingest contract plus reference paths for Cloudflare Worker relay, Microsoft 365 alerts, and Splunk validation.",
  },
  {
    question: "What proof can buyers inspect before a live demo?",
    answer:
      "The public flow already exposes a sample incident, screenshot gallery, downloadable report, public telemetry snapshot, and the API health endpoint.",
  },
  {
    question: "How is the rollout kept bounded and believable?",
    answer:
      "The rollout story stays tied to isolated decoys, trusted-host and HTTPS checks, PostgreSQL-backed runtime, and launch-preflight plus ops-readiness verification.",
  },
];

const SUPPORTED_ECOSYSTEM = [
  "X-API-Key ingest",
  "Cloudflare Worker relay",
  "Microsoft 365 Logic App",
  "Splunk HEC validation",
  "Docker Compose",
  "PostgreSQL runtime",
  "Public API health",
  "Ops readiness checks",
];

const ECOSYSTEM_PILLARS = [
  {
    title: "Website and API ingest",
    detail: "Per-site API keys and the current ingest contract let teams bind suspicious route activity to the right tenant and environment.",
    icon: <Link2 size={18} />,
  },
  {
    title: "Edge and provider relay",
    detail: "Cloudflare and Microsoft 365 relay patterns already exist in the repo so upstream signals can land in the same operator workflow.",
    icon: <Workflow size={18} />,
  },
  {
    title: "Operator verification",
    detail: "The same rollout path ends in telemetry, forensics, and ops-readiness checks instead of stopping at one successful event post.",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "Deployment reality",
    detail: "Docker, PostgreSQL, trusted hosts, HTTPS, and launch preflight keep the trust story grounded in a real deployment path.",
    icon: <Server size={18} />,
  },
];

const ASSURANCE_CARDS = [
  {
    title: "Operational proof",
    detail: "Sample incident, screenshot gallery, public telemetry snapshot, and API health already give evaluators artifacts they can inspect before a call.",
    icon: <Radar size={18} />,
  },
  {
    title: "Bounded rollout",
    detail: "Trusted hosts, HTTPS, PostgreSQL-backed runtime, launch preflight, and ops-readiness checks keep the deployment story disciplined.",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "Evidence integrity",
    detail: "Route order, session behavior, forensics artifacts, analyst narrative, and signed report output stay tied to one incident path.",
    icon: <LockKeyhole size={18} />,
  },
  {
    title: "No invented proof",
    detail: "The site leans on supported systems and repo-backed artifacts instead of fake customer logos, analyst awards, or compliance claims it cannot defend.",
    icon: <Building2 size={18} />,
  },
];

const COMPARISON_LANES = [
  {
    title: "Passive dashboards",
    ours: "Believable route traps, attacker path capture, and an operator brief in one workflow.",
    other: "Alert views without controlled first-touch capture or replayable evidence.",
  },
  {
    title: "Generic honeypot demos",
    ours: "Focused on exposed login, admin, and API routes that public-facing teams actually defend.",
    other: "Broader lab-style decoys with weaker rollout context for customer-facing SaaS teams.",
  },
  {
    title: "AI on top of logs",
    ours: "Summaries built from captured route order, session behavior, and incident artifacts.",
    other: "Narratives built from disconnected logs or prompt-only interpretation.",
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
    detail: "Threat-intel screen captured from the current product build with live telemetry context.",
    image: "/screenshots/threat-intel.png",
    alt: `${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} threat intelligence screenshot`,
  },
  {
    title: "Forensics lab",
    detail: "Artifact review, risk progression, and attack reconstruction from the current forensics workflow.",
    image: "/screenshots/forensics.png",
    alt: `${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} forensics lab screenshot`,
  },
];

const SAMPLE_HOME_SNAPSHOT: HomeSnapshot = {
  totalAttacks: 37,
  criticalThreats: 4,
  blockedIps: 6,
  liveSessions: 3,
  uniqueIps: 12,
  activeDecoys: 8,
  threatScore: 82,
  topDecoy: "/admin/login-shadow",
};

const SAMPLE_ATTACK_TIMELINE: TimelineItem[] = [
  { id: "sample-1", ts: "09:14:22", path: "/login-shadow", severity: "medium" },
  { id: "sample-2", ts: "09:14:36", path: "/admin/login-shadow", severity: "high" },
  { id: "sample-3", ts: "09:15:03", path: "/api/internal/export", severity: "critical" },
  { id: "sample-4", ts: "09:15:17", path: "credential spray pattern detected", severity: "high" },
];

const SAMPLE_ANALYST_SUMMARY =
  "Sample incident: the attacker moved from a decoy login to an exposed admin route, then probed an internal-looking API path. The analyst brief flags credential-access reconnaissance with response-ready evidence.";

const HERO_FLOW_LANES = [
  {
    id: "lane-01",
    d: "M-40 470C84 430 176 392 284 322C396 250 518 148 760 38",
    nodeX: 714,
    nodeY: 58,
    delay: "0s",
  },
  {
    id: "lane-02",
    d: "M-78 360C86 344 206 334 314 300C420 266 528 216 744 154",
    nodeX: 698,
    nodeY: 172,
    delay: "0.7s",
  },
  {
    id: "lane-03",
    d: "M-28 570C114 504 224 436 352 352C450 288 546 224 746 94",
    nodeX: 702,
    nodeY: 118,
    delay: "1.2s",
  },
  {
    id: "lane-04",
    d: "M-82 266C88 280 208 310 316 356C430 404 552 468 746 562",
    nodeX: 706,
    nodeY: 532,
    delay: "1.8s",
  },
  {
    id: "lane-05",
    d: "M34 606C152 550 252 486 372 408C494 328 594 250 756 166",
    nodeX: 710,
    nodeY: 188,
    delay: "2.3s",
  },
  {
    id: "lane-06",
    d: "M124 618C246 556 356 480 476 388C582 306 660 238 758 132",
    nodeX: 714,
    nodeY: 148,
    delay: "2.9s",
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

function buildAnalystSummary(feed: FeedEvent[]) {
  if (!Array.isArray(feed) || feed.length === 0) {
    return SAMPLE_ANALYST_SUMMARY;
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

function toTimelineItem(event: FeedEvent, index = 0): TimelineItem {
  const tsValue = event?.ts || event?.timestamp || null;
  const pathValue = String(event?.path || event?.url_path || event?.cmd || event?.event_type || "unknown");
  return {
    id: String(event?.id || `${pathValue}-${tsValue || index}`),
    ts: tsValue ? new Date(tsValue).toLocaleTimeString() : "--:--:--",
    path: pathValue,
    severity: String(event?.severity || "low").toLowerCase(),
  };
}

function HeroFlowField() {
  return (
    <div className="marketing-home-flow-field" aria-hidden="true">
      <div className="marketing-home-flow-haze marketing-home-flow-haze-left" />
      <div className="marketing-home-flow-haze marketing-home-flow-haze-core" />
      <div className="marketing-home-flow-stage">
        <div className="marketing-home-flow-core" />
        <div className="marketing-home-flow-chip marketing-home-flow-chip-top">Deception flow mesh</div>
        <div className="marketing-home-flow-chip marketing-home-flow-chip-bottom">Routes to telemetry to brief</div>
        <svg className="marketing-home-flow-svg" viewBox="0 0 760 620" fill="none" preserveAspectRatio="none">
          <defs>
            <linearGradient id="marketing-home-flow-gradient" x1="16" y1="560" x2="742" y2="68" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffbf2a" />
              <stop offset="0.42" stopColor="#ff5c36" />
              <stop offset="1" stopColor="#63d7ff" />
            </linearGradient>
            <filter id="marketing-home-flow-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {HERO_FLOW_LANES.map((lane) => (
            <g key={lane.id} className="marketing-home-flow-lane">
              <path d={lane.d} className="marketing-home-flow-line-shadow" filter="url(#marketing-home-flow-glow)" />
              <path d={lane.d} className="marketing-home-flow-line" />
              <path d={lane.d} className="marketing-home-flow-tracer" pathLength="100" style={{ animationDelay: lane.delay }} />
              <circle cx={lane.nodeX} cy={lane.nodeY} r="10" className="marketing-home-flow-node-halo" style={{ animationDelay: lane.delay }} />
              <circle cx={lane.nodeX} cy={lane.nodeY} r="4" className="marketing-home-flow-node" style={{ animationDelay: lane.delay }} />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default function Home() {
  const location = useLocation();
  const toCampaignPath = (path: string) => buildCampaignAwarePath(path, location.search);
  usePageAnalytics("home");
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName || "CyberSentil";
  useSeo({
    title: `${PUBLIC_SITE.siteName} | AI Deception Platform`,
    description:
      "CyberSentil helps SaaS teams and MSSPs deploy believable login, admin, and API decoys, capture attacker behavior early, and turn first-touch telemetry into analyst-ready evidence.",
    ogTitle: `${PUBLIC_SITE.siteName} AI Deception Platform`,
    ogDescription:
      "Deploy believable exposed-route decoys, capture attacker behavior early, and give analysts readable evidence before production impact.",
  });

  const [snapshot, setSnapshot] = useState<HomeSnapshot>({
    totalAttacks: 0,
    criticalThreats: 0,
    blockedIps: 0,
    liveSessions: 0,
    uniqueIps: 0,
    activeDecoys: 0,
    threatScore: 0,
    topDecoy: "",
  });
  const [attackTimeline, setAttackTimeline] = useState<TimelineItem[]>([]);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [snapshotScope, setSnapshotScope] = useState<string>("unknown");
  const [analystSummary, setAnalystSummary] = useState<string>(buildAnalystSummary([]));
  const [showRichSections, setShowRichSections] = useState<boolean>(true);
  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean>(true);
  const [motionEnabled, setMotionEnabled] = useState<boolean>(true);
  const [authenticated, setAuthenticated] = useState<boolean>(() => isAuthenticated());
  const [signupEnabled, setSignupEnabled] = useState<boolean>(true);
  useScrollReveal(".marketing-lazy-section", {
    enabled: motionEnabled,
    refreshToken: showRichSections,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const syncAuthState = () => {
      setAuthenticated(isAuthenticated());
    };
    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthState);
    window.addEventListener("storage", syncAuthState);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthState);
      window.removeEventListener("storage", syncAuthState);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const fetchProviders = async () => {
      try {
        const providers = await loadAuthProviders();
        if (active) {
          setSignupEnabled(providers.signupEnabled !== false);
        }
      } catch {
        // Keep self-serve CTA available if provider discovery is temporarily unavailable.
      }
    };

    void fetchProviders();
    return () => {
      active = false;
    };
  }, []);

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
        if (!authenticated) {
          const publicData: PublicTelemetrySnapshot = await fetchPublicTelemetrySnapshot();
          const summary = publicData.summary || {};
          const feed: FeedEvent[] = Array.isArray(publicData.feed) ? publicData.feed : [];
          const publicTimeline = feed.slice(0, 5).map((event, index) => toTimelineItem(event, index));
          if (!active) {
            return;
          }
          startTransition(() => {
            setBackendOnline(true);
            setSnapshotScope(String(publicData.scope || "unknown"));
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
        const res = await fetch(`${API_BASE}/dashboard/stats?include_training=false`, {
          credentials: "include",
          headers: authHeaders,
        });
        if (!res.ok) {
          throw new Error(`Dashboard stats request failed: ${res.status}`);
        }
        const data = await res.json();
        const summary = data?.summary || {};
        const feed: FeedEvent[] = Array.isArray(data?.feed) ? data.feed : [];
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
          setSnapshotScope("tenant");
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
  }, [authenticated, telemetryEnabled]);

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
  const hasDemoSafePublicSignal = !authenticated && snapshotScope === "public_demo";
  const usingSampleProof = !hasLiveEventData;
  const displaySnapshot = usingSampleProof ? SAMPLE_HOME_SNAPSHOT : snapshot;
  const displayTimeline = usingSampleProof ? SAMPLE_ATTACK_TIMELINE : attackTimeline;
  const displayAnalystSummary = usingSampleProof ? SAMPLE_ANALYST_SUMMARY : analystSummary;
  const proofMode = usingSampleProof ? "sample" : hasDemoSafePublicSignal ? "demo_safe" : "live";
  const threatScoreLabel = displaySnapshot.threatScore > 0 ? `${displaySnapshot.threatScore}/100` : "Scoring";
  const activeSurfacesLabel = `${displaySnapshot.activeDecoys} active surfaces`;
  const liveSessionsLabel =
    proofMode === "demo_safe" ? `${displaySnapshot.totalAttacks} demo events` : `${displaySnapshot.liveSessions} live sessions`;
  const blockedIpsLabel = `${displaySnapshot.blockedIps} blocked IPs`;
  const topDecoyLabel = displaySnapshot.topDecoy;
  const runtimeStatusLabel =
    proofMode === "sample"
      ? "Sample proof"
      : proofMode === "demo_safe"
        ? "Demo-safe telemetry"
        : backendOnline
          ? "Live telemetry"
          : "Telemetry sync";
  const snapshotSignal =
    proofMode === "sample" ? "Sample incident ready" : proofMode === "demo_safe" ? "Demo-safe signal present" : "Live signal present";
  const defenseCoverageLabel = `${displaySnapshot.activeDecoys} decoy surfaces armed`;
  const evidenceDepthLabel = `${displaySnapshot.totalAttacks} event records`;
  const responseReadinessLabel = `${displaySnapshot.blockedIps} block actions prepared`;
  const proofCards = [
    {
      label: "Proof state",
      value: runtimeStatusLabel,
      detail: "Public pages use a demo-safe telemetry preview. Authenticated workspaces switch to live tenant telemetry.",
    },
    { label: "Threat confidence", value: threatScoreLabel, detail: "Analyst confidence score for the current proof path." },
    { label: "Coverage state", value: defenseCoverageLabel, detail: "How many decoy surfaces are armed for exposed routes." },
    { label: "Evidence depth", value: evidenceDepthLabel, detail: "Captured records ready for analyst review." },
    { label: "Response path", value: responseReadinessLabel, detail: "Response actions prepared from the observed behavior." },
    { label: "Top targeted lure", value: topDecoyLabel, detail: "Most hit deception surface in the current proof window." },
  ];
  const homeTrustStats = [
    { label: "Runtime", value: runtimeStatusLabel },
    { label: "Top decoy", value: topDecoyLabel },
    { label: "Live sessions", value: liveSessionsLabel },
    { label: "Blocked IPs", value: blockedIpsLabel },
  ];
  const readinessChecklist = [
    `Detection signal: ${snapshotSignal}`,
    `Analyst context: ${displayAnalystSummary}`,
    `Live sessions: ${liveSessionsLabel}`,
    `Critical events: ${displaySnapshot.criticalThreats}`,
    `Unique source IPs: ${displaySnapshot.uniqueIps}`,
  ];
  const publicHealthUrl = "/api/health";
  const publicSnapshotUrl = "/api/public/telemetry/snapshot";

  const homeConsoleFeed = displayTimeline.slice(0, 4);
  const heroPreviewEvents = (homeConsoleFeed.length ? homeConsoleFeed : SAMPLE_ATTACK_TIMELINE).slice(0, 2);
  const heroSignalMetrics = [
    { label: "Runtime", value: runtimeStatusLabel },
    { label: "Coverage", value: activeSurfacesLabel },
    { label: "Evidence", value: evidenceDepthLabel },
  ];
  const heroAnalystBrief =
    displayAnalystSummary.length > 160 ? `${displayAnalystSummary.slice(0, 157).trimEnd()}...` : displayAnalystSummary;
  const canCreateWorkspace = signupEnabled && !authenticated;
  const heroPrimaryAction = authenticated
    ? { to: "/dashboard", label: "Open Dashboard", tracking: "open_dashboard" }
    : canCreateWorkspace
      ? { to: "/auth/signup", label: "Create Workspace", tracking: "create_workspace" }
      : { to: "/demo", label: "Request Demo", tracking: "request_demo" };
  const heroSecondaryAction = authenticated
    ? { to: "/platform", label: "Review Platform", tracking: "review_platform" }
    : canCreateWorkspace
      ? { to: "/demo", label: "Request Demo", tracking: "request_demo_secondary" }
      : { to: "/platform", label: "Explore Platform", tracking: "explore_platform" };
  const finalHeading = authenticated
    ? "Ready to jump back into the live workspace?"
    : canCreateWorkspace
      ? "Ready to create a workspace or start with a guided review?"
      : "Ready to start with one pilot deployment?";
  const finalCopy = authenticated
    ? `${productName} is already tracking route pressure, evidence depth, and analyst context. Go back into the workspace and continue from the live operator view.`
    : canCreateWorkspace
      ? `Create the first ${productName} workspace owner account now, or use the guided demo flow if you want a walkthrough before rollout planning.`
      : `${productName} gives security teams a practical first pilot: believable exposed-route traps, preserved attacker paths, and analyst-ready evidence that can stand up in real buyer and rollout conversations.`;
  const finalPrimaryAction = authenticated
    ? { to: "/dashboard", label: "Open Dashboard", tracking: "open_dashboard_bottom" }
    : canCreateWorkspace
      ? { to: "/auth/signup", label: "Create Workspace", tracking: "create_workspace_bottom" }
      : { to: "/demo", label: "Request Demo", tracking: "request_demo_bottom" };
  const finalSecondaryAction = authenticated
    ? { to: "/platform", label: "Review Platform", tracking: "review_platform_bottom" }
    : canCreateWorkspace
      ? { to: "/demo", label: "Request Demo", tracking: "request_demo_bottom_secondary" }
      : { to: "/pricing", label: "View Pricing", tracking: "view_pricing" };

  return (
    <div className={`marketing-shell marketing-shell-home ${motionEnabled ? "marketing-motion-on" : "marketing-motion-paused"}`}>
      <PublicHeader variant="cred" pagePath="/" />

      <main className="marketing-main">
        <section className="marketing-home-announcement">
          <span className="marketing-home-announcement-label">Pilot-ready release</span>
          <p>Review the product story, operating flow, and buyer proof before the first call.</p>
          <Link to={toCampaignPath("/case-study")} onClick={() => trackCtaClick("hero_top_bar_case_study", "/")}>
            View Sample Incident <ArrowRight size={15} />
          </Link>
        </section>

        <section className="marketing-home-cinematic">
          <article className="marketing-home-cinematic-copy">
            <div className="marketing-home-kicker">AI deception platform for exposed routes</div>
            <h1 className="marketing-home-display">Turn exposed login, admin, and API routes into early attacker intelligence.</h1>
            <p className="marketing-home-lead">
              {productName} helps SaaS teams, lean SOCs, and MSSPs deploy believable decoy surfaces, capture attacker behavior from the first touch,
              and turn suspicious route activity into analyst-ready evidence and a defensible response story.
            </p>
            <div className="marketing-actions marketing-home-cinematic-actions">
              <Link
                to={toCampaignPath(heroPrimaryAction.to)}
                className="marketing-btn marketing-btn-primary"
                onClick={() => trackCtaClick(heroPrimaryAction.tracking, "/")}
              >
                {heroPrimaryAction.label}
              </Link>
              <Link
                to={toCampaignPath(heroSecondaryAction.to)}
                className="marketing-btn marketing-btn-secondary"
                onClick={() => trackCtaClick(heroSecondaryAction.tracking, "/")}
              >
                {heroSecondaryAction.label}
              </Link>
            </div>
            <div className="marketing-home-signal-strip">
              {heroSignalMetrics.map((item) => (
                <div key={item.label} className="marketing-home-signal-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="marketing-home-proof-rail" aria-label="Core operator workflow">
              {SIGNATURE_RAIL.map((item) => (
                <article key={item.title} className="marketing-home-proof-item">
                  <span>{item.title}</span>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </article>

          <aside className="marketing-home-cinematic-visual" aria-label="Hero proof visual">
            <div className="marketing-home-visual-glow marketing-home-visual-glow-a" />
            <div className="marketing-home-visual-glow marketing-home-visual-glow-b" />
            <div className="marketing-home-visual-line-grid" />
            <HeroFlowField />

            <article className="marketing-home-float-card marketing-home-float-card-path">
              <span>Incident path</span>
              <strong>
                {proofMode === "sample" ? "Sample route pressure" : proofMode === "demo_safe" ? "Demo-safe route pressure" : "Live route pressure"}
              </strong>
              <div className="marketing-home-path-list">
                {heroPreviewEvents.map((item) => (
                  <div key={item.id} className="marketing-home-path-step">
                    <code>{item.path}</code>
                    <small>{item.ts}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="marketing-home-float-card marketing-home-float-card-score">
              <span>Threat confidence</span>
              <strong>{threatScoreLabel}</strong>
              <small>{topDecoyLabel}</small>
            </article>

            <article className="marketing-home-float-card marketing-home-float-card-brief">
              <div className="marketing-summary-head">
                <BrainCircuit size={16} />
                <span>Analyst brief</span>
              </div>
              <p>{heroAnalystBrief}</p>
            </article>
          </aside>
        </section>

        <section id="telemetry" className="marketing-card marketing-home-trust-rail marketing-lazy-section">
          <div className="marketing-home-trust-layout">
            <article className="marketing-home-trust-copy">
              <span className="marketing-kicker">Operational trust</span>
              <h2>Built for real rollout conversations, not lab-only hype.</h2>
              <p>
                The public story stays grounded in what buyers actually validate first: runtime health, exposed-route coverage, supported integrations,
                and a bounded deployment path around isolated decoys and readable evidence.
              </p>
              <div className="marketing-home-trust-badges" aria-label="Built for these teams">
                {TRUST_AUDIENCE_STRIP.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <div className="marketing-home-trust-badges is-ecosystem" aria-label="Supported ecosystem">
                {SUPPORTED_ECOSYSTEM.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>
            <div className="marketing-home-trust-grid">
              {homeTrustStats.map((item) => (
                <div key={item.label} className="marketing-home-trust-stat">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-card marketing-platform-band marketing-lazy-section">
          <div className="marketing-platform-layout">
            <article className="marketing-platform-copy">
              <span className="marketing-kicker">Platform overview</span>
              <h2>See the platform from armed decoy routes to analyst-ready evidence.</h2>
              <p>
                The product story is simple: deploy believable login, admin, and API traps where attackers probe first, preserve the route path,
                then turn it into readable evidence your team can act on before production is touched.
              </p>
              <div className="marketing-platform-flow">
                {PRODUCT_STEPS.map((step, index) => (
                  <div key={step.title} className="marketing-platform-flow-step">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <small>{step.detail}</small>
                    </div>
                  </div>
                ))}
              </div>
              <div className="marketing-actions">
                <Link to={toCampaignPath("/platform")} className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("explore_platform", "/")}>
                  Explore Platform
                </Link>
                <Link to={toCampaignPath("/integrations")} className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("view_integrations", "/")}>
                  View Integrations
                </Link>
              </div>
            </article>
            <div className="marketing-platform-grid">
              {FEATURE_CARDS.map((item) => (
                <article key={item.title} className="marketing-platform-card">
                  <div className="marketing-impact-head">
                    <div className="marketing-icon-box">{item.icon}</div>
                    <span className="marketing-impact-signal">{item.title}</span>
                  </div>
                  <p>{item.desc}</p>
                </article>
              ))}
              {TRUST_SHORTCUTS.map((item) => (
                <Link
                  key={item.title}
                  to={toCampaignPath(item.to)}
                  className="marketing-platform-shortcut"
                  onClick={() => trackCtaClick(`home_${item.cta.replace(/\s+/g, "_").toLowerCase()}`, "/")}
                >
                  <strong>{item.title}</strong>
                  <span>{item.cta}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="proof" className="marketing-section marketing-lazy-section">
          <div className="marketing-section-head">
            <p>Buyer validation</p>
            <h2>Everything a security buyer needs to validate in minutes.</h2>
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
                <h2>What security teams can validate before rollout.</h2>
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
                <p>Why this feels credible</p>
                <h2>Why the signal feels trustworthy.</h2>
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

        <section className="marketing-card marketing-proof-asset-band marketing-lazy-section">
          <div className="marketing-section-head">
            <p>Proof pack</p>
            <h2>Give buyers one clean proof bundle before the live walkthrough.</h2>
          </div>
          <div className="marketing-grid-3 marketing-proof-asset-grid">
            {PROOF_ASSET_PACK.map((item) => (
              <article key={item.title} className="marketing-proof-asset-card">
                <div className="marketing-impact-head">
                  <div className="marketing-icon-box">{item.icon}</div>
                  <span className="marketing-impact-signal">{item.title}</span>
                </div>
                <p>{item.detail}</p>
                <div className="marketing-proof-asset-stats">
                  {item.stats.map((stat) => (
                    <strong key={stat}>{stat}</strong>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section marketing-lazy-section">
          <div className="marketing-section-head">
            <p>Product screens</p>
            <h2>Show the actual operator experience before the first demo call.</h2>
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
        </section>

        <section className="marketing-section marketing-lazy-section">
          <div className="marketing-section-head">
            <p>Start evaluation</p>
            <h2>Move buyers from curiosity to demo with one deliberate path.</h2>
          </div>
          <div className="marketing-grid-2 marketing-home-evaluation-grid">
            {EVALUATION_PATHS.map((item) => (
              <Link
                key={item.title}
                to={toCampaignPath(item.to)}
                className="marketing-card marketing-showcase marketing-home-evaluation-card"
                onClick={() => trackCtaClick(`home_${item.cta.replace(/\s+/g, "_").toLowerCase()}`, "/")}
              >
                <div className="marketing-impact-head">
                  <div className="marketing-icon-box">{item.icon}</div>
                  <span className="marketing-impact-signal">{item.title}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <span className="marketing-home-inline-cta">
                  {item.cta} <ArrowRight size={15} />
                </span>
              </Link>
            ))}
          </div>
          <div className="marketing-grid-2 marketing-home-assurance-grid">
            {ASSURANCE_CARDS.map((item) => (
              <article key={item.title} className="marketing-card marketing-showcase marketing-home-assurance-card">
                <div className="marketing-impact-head">
                  <div className="marketing-icon-box">{item.icon}</div>
                  <span className="marketing-impact-signal">{item.title}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="why-us" className="marketing-section marketing-lazy-section">
          <div className="marketing-section-head">
            <p>Why this path</p>
            <h2>Choose behavior capture over passive dashboards, lab demos, or log-only summaries.</h2>
          </div>
          <div className="marketing-grid-3">
            {COMPARISON_LANES.map((item) => (
              <article key={item.title} className="marketing-card marketing-feature">
                <div className="marketing-impact-head">
                  <span className="marketing-impact-signal">{item.title}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.ours}</p>
                <p style={{ opacity: 0.78 }}>Typical alternative: {item.other}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="marketing-section marketing-lazy-section">
          <div className="marketing-section-head">
            <p>Use cases</p>
            <h2>Start with the public-facing surface your team worries about first.</h2>
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
          <div className="marketing-section-head">
            <p>Rollout FAQ</p>
            <h2>Answers buyers usually need before they commit to a pilot.</h2>
          </div>
          <div className="marketing-grid-2">
            {BUYER_FAQ.map((item) => (
              <article key={item.question} className="marketing-card marketing-showcase">
                <p className="marketing-kicker">Common question</p>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-card marketing-cta marketing-lazy-section">
          <div className="marketing-cta-copy">
            <h2>{finalHeading}</h2>
            <p>{finalCopy}</p>
          </div>
          <div className="marketing-actions">
            <Link
              to={toCampaignPath(finalPrimaryAction.to)}
              className="marketing-btn marketing-btn-primary"
              onClick={() => trackCtaClick(finalPrimaryAction.tracking, "/")}
            >
              {finalPrimaryAction.label}
            </Link>
            <Link
              to={toCampaignPath(finalSecondaryAction.to)}
              className="marketing-btn marketing-btn-secondary"
              onClick={() => trackCtaClick(finalSecondaryAction.tracking, "/")}
            >
              {finalSecondaryAction.label}
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
