import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Database,
  LayoutDashboard,
  LockKeyhole,
  Network,
  Radar,
  Server,
  Shield,
} from "lucide-react";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { trackCtaClick } from "./utils/analytics";
import { fetchPublicTelemetrySnapshot } from "./utils/publicTelemetry";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";
import ProofGallery from "./ProofGallery";

const FLOW = [
  {
    title: "1. Dynamic Decoy Surface",
    description: "Web login, admin, API, and internal portal decoys expose realistic interaction paths.",
    icon: <Shield size={18} />,
  },
  {
    title: "2. Event Collector",
    description: "Every request, header, payload, and timing artifact is captured into normalized telemetry events.",
    icon: <Activity size={18} />,
  },
  {
    title: "3. AI Analysis Engine",
    description: "Classifier scores intent, predicts attacker goal, and builds narrative context for analysts.",
    icon: <BrainCircuit size={18} />,
  },
  {
    title: "4. Forensic Storage",
    description: "Structured events, status history, and lead operations metadata are retained for auditability.",
    icon: <Database size={18} />,
  },
  {
    title: "5. Dashboard and SOC Ops",
    description: "Operators receive timeline, scoring, assignment context, and response priorities in real time.",
    icon: <LayoutDashboard size={18} />,
  },
];

const COMPONENTS = [
  {
    name: "Deception Engine",
    detail: "Controls adaptive response templates, fake content mutation, and session continuity logic.",
    icon: <Server size={16} />,
  },
  {
    name: "Telemetry Pipeline",
    detail: "Ingests session events with dedupe-safe persistence and operational reliability controls.",
    icon: <Network size={16} />,
  },
  {
    name: "AI Threat Core",
    detail: "Delivers intent classification, scoring, and concise analyst narrative output.",
    icon: <Radar size={16} />,
  },
  {
    name: "Safety Controls",
    detail: "RBAC, protected admin APIs, spam suppression, and notification idempotency hardening.",
    icon: <LockKeyhole size={16} />,
  },
];

const ARCH_PROOF_POINTS = [
  "Flow clarity: attacker -> decoy -> telemetry -> AI -> dashboard",
  "Safety boundary: believable interaction with controlled system isolation",
  "Operational output: AI narrative and response context for SOC action",
];

const DEMO_PREVIEW = [
  "Decoy environment transitions",
  "Telemetry event collection and scoring",
  "AI intent classification and summary",
  "SOC-facing dashboard actions",
  "Lead and reporting operations",
];

const ARCH_PROOF_GALLERY_ITEMS = [
  {
    label: "Architecture map",
    title: "Pipeline overview",
    description: "Clear attacker-to-analyst flow for customer, SOC, and investor conversations.",
    src: "/media/architecture-illustration.svg",
    alt: "Architecture illustration showing attacker, decoy, telemetry, AI, and dashboard flow",
    points: ARCH_PROOF_POINTS,
  },
  {
    label: "Walkthrough preview",
    title: "Short architecture walkthrough",
    description: "A concise storyline from initial probe to AI summary output and operator action.",
    src: "/media/walkthrough-poster.svg",
    alt: "Architecture walkthrough poster",
    points: [
      "Shows decoy progression and telemetry capture",
      "Demonstrates AI classification and risk narrative",
      "Ends with SOC-facing dashboard actions",
    ],
  },
  {
    label: "Output proof",
    title: "Dashboard result visibility",
    description: "How architecture decisions appear as practical dashboard output for analysts.",
    src: "/media/platform-dashboard-proof.svg",
    alt: "Dashboard output proof connected to architecture decisions",
    points: [
      "Session timeline and threat score context",
      "AI summaries tied to event progression",
      "Evidence for response prioritization",
    ],
  },
];

export default function PublicArchitecture() {
  usePageAnalytics("architecture");
  useSeo({
    title: "Architecture | CyberSentinel AI Dynamic Deception Platform",
    description:
      "Understand the CyberSentinel AI flow from attacker interaction to telemetry collection, AI analysis, and dashboard operations.",
    ogTitle: "CyberSentinel AI Architecture",
    ogDescription:
      "Attacker -> decoy -> telemetry -> AI -> dashboard, designed for believable and controlled deception operations.",
  });
  const [liveTelemetry, setLiveTelemetry] = useState(null);
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    let alive = true;
    const loadTelemetry = async () => {
      try {
        const payload = await fetchPublicTelemetrySnapshot({ params: { hours: 24, limit: 5, include_training: false } });
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

  const liveMetrics = useMemo(() => {
    const summary = liveTelemetry?.summary || {};
    return [
      { label: "Events (24h)", value: Number(summary.total_events || 0) },
      { label: "Unique IPs", value: Number(summary.unique_ips || 0) },
      { label: "Critical", value: Number(summary.critical_events || 0) },
      { label: "Top target", value: String(summary.top_target || "none") },
      { label: "Risk", value: String(summary.risk_level || "low").toUpperCase() },
    ];
  }, [liveTelemetry]);

  return (
    <div className="cred-page architecture-page">
      <div className="cred-ambient cred-ambient-a" />
      <div className="cred-ambient cred-ambient-b" />

      <PublicHeader variant="cred" pagePath="/architecture" />

      <main className="cred-main">
        <section className="cred-hero">
          <p className="cred-badge">AI-Enhanced Dynamic Deception Platform</p>
          <h1>Believable but Controlled Deception Architecture</h1>
          <p className="cred-subtitle">
            The platform combines high-interaction decoy environments, behavior-aware AI analysis, and operator-first
            telemetry workflows while preserving strict control boundaries for safe deployment.
          </p>
          <div className="cred-actions">
            <Link to="/demo" className="cred-btn cred-btn-primary" onClick={() => trackCtaClick("request_demo", "/architecture")}>
              Request Demo <ArrowRight size={15} />
            </Link>
            <Link to="/platform" className="cred-btn cred-btn-ghost" onClick={() => trackCtaClick("explore_platform", "/architecture")}>Explore Platform</Link>
            <Link to="/contact" className="cred-btn cred-btn-ghost" onClick={() => trackCtaClick("contact_team", "/architecture")}>Contact Team</Link>
          </div>
        </section>

        <section className="cred-card architecture-diagram-card">
          <p className="architecture-diagram-title">Live architecture pulse</p>
          <div className="demo-see-grid">
            {liveMetrics.map((metric) => (
              <div key={metric.label} className="demo-see-item">
                <span>{metric.label}</span>
                <strong className="mono">{metric.value}</strong>
              </div>
            ))}
          </div>
          <div className="architecture-diagram-note">
            {backendOnline
              ? String(liveTelemetry?.ai_summary || "Live telemetry is active and feeding this architecture pipeline.")
              : "Live telemetry feed is temporarily offline. Architecture flow remains operational."}
          </div>
        </section>

        <section className="cred-section">
          <div className="cred-section-head">
            <p>End-to-end flow</p>
            <h2>Attacker interaction to analyst action</h2>
          </div>
          <div className="architecture-flow-grid">
            {FLOW.map((step) => (
              <article key={step.title} className="architecture-flow-card">
                <div className="architecture-flow-icon">{step.icon}</div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cred-section">
          <div className="cred-section-head">
            <p>Architecture illustration</p>
            <h2>Visual map for customer and investor conversations</h2>
          </div>
          <ProofGallery items={ARCH_PROOF_GALLERY_ITEMS} />
        </section>

        <section className="cred-section">
          <div className="cred-section-head">
            <p>Component map</p>
            <h2>Core building blocks</h2>
          </div>
          <div className="architecture-component-grid">
            {COMPONENTS.map((item) => (
              <article key={item.name} className="architecture-component-card">
                <h3>
                  {item.icon}
                  {item.name}
                </h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cred-card architecture-diagram-card">
          <p className="architecture-diagram-title">Reference pipeline</p>
          <div className="architecture-diagram">
            <Node name="Attacker" />
            <Node name="Decoy Layer" />
            <Node name="Collector" />
            <Node name="AI Engine" />
            <Node name="Dashboard" />
          </div>
          <div className="architecture-diagram-note">
            This sequence is designed for dynamic mutation, replayable context, and analyst-friendly summaries.
          </div>
        </section>

        <section className="cred-section">
          <div className="cred-section-head">
            <p>Demo expectations</p>
            <h2>What you'll see in the demo</h2>
          </div>
          <div className="demo-see-grid">
            {DEMO_PREVIEW.map((item) => (
              <div key={item} className="demo-see-item">
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="cred-card cred-cta">
          <div>
            <p>Implementation confidence</p>
            <h2>Need the technical walkthrough for customers or investors?</h2>
            <span>Use this architecture view to explain data flow, control boundaries, and AI-assisted output quality.</span>
          </div>
          <div className="cred-actions">
            <Link to="/demo" className="cred-btn cred-btn-primary" onClick={() => trackCtaClick("request_demo", "/architecture")}>
              Request Demo
            </Link>
            <Link to="/platform" className="cred-btn cred-btn-ghost" onClick={() => trackCtaClick("explore_platform", "/architecture")}>Explore Platform</Link>
            <Link to="/contact" className="cred-btn cred-btn-ghost" onClick={() => trackCtaClick("contact_team", "/architecture")}>Contact Team</Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function Node({ name }) {
  return (
    <div className="architecture-node">
      <span>{name}</span>
    </div>
  );
}
