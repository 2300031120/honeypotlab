import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Activity,
  ArrowRight,
  Bot,
  BrainCircuit,
  Layers,
  Radar,
  Server,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { API_BASE } from "./apiConfig";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { trackCtaClick } from "./utils/analytics";
import { isAuthenticated } from "./utils/auth";
import { fetchPublicTelemetrySnapshot } from "./utils/publicTelemetry";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

const FEATURE_CARDS = [
  {
    title: "Dynamic web decoys",
    desc: "Serve believable login portals, admin flows, and multi-page decoys with progressive attacker engagement.",
    icon: <Layers size={20} />,
  },
  {
    title: "AI-driven adaptation",
    desc: "Change responses in-session based on behavior classification, probe sequence, and deception policy.",
    icon: <BrainCircuit size={20} />,
  },
  {
    title: "High-interaction simulation",
    desc: "Maintain realistic state, fake records, audit trails, and continuity so sessions feel authentic.",
    icon: <ShieldCheck size={20} />,
  },
  {
    title: "Real-time analytics",
    desc: "Stream attack telemetry, threat scoring, intent labels, and AI analyst summaries into one command surface.",
    icon: <Activity size={20} />,
  },
];

const DECEPTION_TYPES = [
  "Fake Login Portal Honeypot",
  "Admin Dashboard Honeypot",
  "API Honeypot",
  "File Download Decoy",
  "CMS / Web Panel Decoy",
  "Cloud Console Simulation",
  "Internal Employee Portal Decoy",
];

const COMPARISON_ROWS = [
  ["Static responses", "Adaptive responses"],
  ["Single decoy", "Multi-layer deception"],
  ["Manual log review", "AI-assisted analysis"],
  ["Easy fingerprinting", "Higher realism"],
  ["Limited engagement", "High-interaction flows"],
];

const TREND_MODULES = [
  {
    title: "High-Interaction Web Decoys",
    detail: "Believable login and admin journeys with realistic state transitions.",
  },
  {
    title: "API Honeymesh",
    detail: "Adaptive API response surfaces for probe detection and intent tagging.",
  },
  {
    title: "Cloud Console Simulation",
    detail: "Cloud-style control surfaces to detect credential abuse and recon behavior.",
  },
  {
    title: "Bait File Intelligence",
    detail: "Tokenized download traps with collection-phase telemetry and risk scoring.",
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
  usePageAnalytics("home");
  useSeo({
    title: "CyberSentinel AI | AI-Enhanced Dynamic Deception Platform",
    description:
      "AI-enhanced dynamic deception platform for modern cyber defense with adaptive high-interaction decoys and real-time analytics.",
    ogTitle: "CyberSentinel AI Dynamic Deception Platform",
    ogDescription:
      "Deploy adaptive deception, observe attacker behavior, and analyze threats through AI-assisted security operations.",
  });

  const REAL_ONLY_PARAMS = { params: { include_training: false }, skipAuthRedirect: true };
  const [snapshot, setSnapshot] = useState({
    totalAttacks: 0,
    criticalThreats: 0,
    blockedIps: 0,
    liveSessions: 0,
    uniqueIps: 0,
    activeDecoys: 0,
    threatScore: 0,
    topDecoy: "login-portal",
  });
  const [attackTimeline, setAttackTimeline] = useState([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [analystSummary, setAnalystSummary] = useState(
    "Attacker probed login, admin, backup, and API endpoints in sequence. Behavior indicates reconnaissance activity."
  );

  useEffect(() => {
    const loadSnapshot = async () => {
      try {
        if (!isAuthenticated()) {
          const publicData = await fetchPublicTelemetrySnapshot();
          const summary = publicData.summary || {};
          const feed = Array.isArray(publicData.feed) ? publicData.feed : [];
          const publicTimeline = feed.slice(0, 5).map((event, index) => toTimelineItem(event, index));
          setBackendOnline(true);
          setSnapshot({
            totalAttacks: Number(summary.total_events || 0),
            criticalThreats: Number(summary.critical_events || 0),
            blockedIps: Number(summary.blocked_ips || 0),
            liveSessions: Number(summary.live_sessions || 0),
            uniqueIps: Number(summary.unique_ips || 0),
            activeDecoys: Number(summary.active_decoys || 0),
            threatScore: Number(summary.threat_score || 12),
            topDecoy: String(summary.top_target || "none"),
          });
          setAttackTimeline(publicTimeline);
          setAnalystSummary(
            String(publicData.ai_summary || "").trim() || buildAnalystSummary(feed)
          );
          return;
        }

        const res = await axios.get(`${API_BASE}/dashboard/stats`, REAL_ONLY_PARAMS);
        const summary = res.data?.summary || {};
        const feed = Array.isArray(res.data?.feed) ? res.data.feed : [];
        const trapDistribution = res.data?.trap_distribution || {};
        const totalAttacks = Number(summary.total || 0);
        const criticalThreats = Number(summary.critical || 0);
        const blockedIps = Number(summary.blocked || 0);
        const uniqueIps = new Set(
          feed
            .map((event) => String(event?.ip || "").trim())
            .filter(Boolean)
        ).size;
        const activeDecoys = Object.keys(trapDistribution).length;
        const topDecoy =
          Object.entries(trapDistribution).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || "login-portal";
        const threatScore =
          totalAttacks === 0
            ? 12
            : Math.min(99, Math.round((criticalThreats / Math.max(totalAttacks, 1)) * 70 + Math.min(feed.length, 20) * 1.5 + 20));
        const timeline = feed.slice(0, 5).map((event, index) => toTimelineItem(event, index));

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
      } catch {
        setBackendOnline(false);
      }
    };

    loadSnapshot();
    const interval = setInterval(loadSnapshot, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="home-v2">
      <div className="home-v2-ambient home-v2-ambient-a" />
      <div className="home-v2-ambient home-v2-ambient-b" />

      <PublicHeader variant="home" pagePath="/" brandText="CYBERSENTINEL AI" />

      <main className="home-v2-main">
        <section className="home-v2-hero">
          <div>
            <p className="home-v2-badge">AI-Enhanced Dynamic Deception Platform</p>
            <h1>AI-Enhanced Dynamic Deception Platform</h1>
            <p className="home-v2-subtitle">
              Deploy adaptive high-interaction decoys, observe attacker behavior, and analyze threats in real time
              through an AI-driven analytics dashboard.
            </p>
            <div className="home-v2-trust-strip">
              <span>High-Interaction</span>
              <span>Behavior-Aware AI</span>
              <span>SOC-Ready Analytics</span>
              <span>Startup Ops CRM</span>
            </div>
            <div className="home-v2-hero-actions">
              <Link to="/demo" className="home-v2-btn home-v2-btn-primary" onClick={() => trackCtaClick("request_demo", "/")}>
                Request Demo <ArrowRight size={16} />
              </Link>
              <Link
                to="/platform"
                className="home-v2-btn home-v2-btn-ghost"
                onClick={() => trackCtaClick("explore_platform", "/")}
              >
                Explore Platform
              </Link>
              <Link
                to="/contact"
                className="home-v2-btn home-v2-btn-ghost"
                onClick={() => trackCtaClick("contact_team", "/")}
              >
                Contact Team
              </Link>
            </div>
          </div>

          <div className="home-v2-panel">
            <div className="home-v2-panel-head">
              <h3>Live Security Snapshot</h3>
              <span className={backendOnline ? "status-online" : "status-offline"}>
                {backendOnline ? "AI ONLINE" : "AI OFFLINE"}
              </span>
            </div>
            <div className="home-v2-metric-grid">
              <Metric label="Total attacks today" value={snapshot.totalAttacks} />
              <Metric label="Critical threats" value={snapshot.criticalThreats} />
              <Metric label="Blocked IPs" value={snapshot.blockedIps} />
              <Metric label="Unique IPs" value={snapshot.uniqueIps} />
              <Metric label="Live sessions" value={snapshot.liveSessions} />
              <Metric label="Top targeted decoy" value={snapshot.topDecoy} mono />
            </div>
            <div className="home-v2-analyst">
              <div>
                <Bot size={16} />
                AI Analyst Summary
              </div>
              <p>{analystSummary}</p>
            </div>
          </div>
        </section>

        <section id="problem" className="home-v2-section-split">
          <article className="home-v2-panel">
            <h2>Why static honeypots fail</h2>
            <ul>
              <li>Fixed banners and predictable responses are easy to fingerprint.</li>
              <li>Single-protocol traps break attacker journey realism.</li>
              <li>Manual triage slows incident response.</li>
            </ul>
          </article>
          <article className="home-v2-panel">
            <h2>How this platform solves it</h2>
            <ul>
              <li>Dynamic page mutation and believable decoy data.</li>
              <li>Behavior-aware response adaptation with high-interaction flows.</li>
              <li>Automated intent classification, scoring, and session summaries.</li>
            </ul>
          </article>
        </section>

        <section id="features" className="home-v2-section">
          <div className="home-v2-section-head">
            <p>Core capabilities</p>
            <h2>From trap to full deception ecosystem</h2>
          </div>
          <div className="home-v2-feature-grid">
            {FEATURE_CARDS.map((feature) => (
              <article key={feature.title} className="home-v2-feature-card">
                <div className="home-v2-feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-v2-section">
          <div className="home-v2-section-head">
            <p>Why not traditional honeypots?</p>
            <h2>Static traps vs adaptive deception</h2>
          </div>
          <div className="home-v2-table-wrap home-v2-contrast-card">
            <div className="home-v2-contrast-title">Traditional vs Our System</div>
            <table>
              <thead>
                <tr>
                  <th>Traditional</th>
                  <th>Our System</th>
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

        <section id="architecture" className="home-v2-section">
          <div className="home-v2-section-head">
            <p>Architecture preview</p>
            <h2>Attacker to AI loop in one pipeline</h2>
          </div>
          <div className="home-v2-flow">
            <FlowNode icon={<Activity size={16} />} label="Attacker" />
            <FlowNode icon={<Shield size={16} />} label="Dynamic Decoy" />
            <FlowNode icon={<Server size={16} />} label="Event Collector" />
            <FlowNode icon={<BrainCircuit size={16} />} label="AI Engine" />
            <FlowNode icon={<Radar size={16} />} label="Dashboard" />
          </div>
        </section>

        <section className="home-v2-section">
          <div className="home-v2-section-head">
            <p>Demo preview</p>
            <h2>Mini live dashboard preview</h2>
          </div>
          <div className="home-v2-live-demo">
            <div className="home-v2-live-kpis">
              <LiveKpi label="Active decoys" value={snapshot.activeDecoys} />
              <LiveKpi label="Live sessions" value={snapshot.liveSessions} />
              <LiveKpi label="Threat score" value={`${snapshot.threatScore}/100`} />
              <LiveKpi label="Top decoy" value={snapshot.topDecoy} mono />
            </div>
            <div className="home-v2-live-body">
              <div className="home-v2-live-panel">
                <h3>AI Analyst Summary</h3>
                <p>{analystSummary}</p>
              </div>
              <div className="home-v2-live-panel">
                <h3>Attack Timeline</h3>
                {attackTimeline.length === 0 ? (
                  <p>No active timeline. Waiting for first attack session.</p>
                ) : (
                  <ul>
                    {attackTimeline.map((item) => (
                      <li key={item.id}>
                        <span>{item.ts}</span>
                        <code>{item.path}</code>
                        <b className={`sev-${item.severity}`}>{item.severity.toUpperCase()}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="home-v2-section">
          <div className="home-v2-section-head">
            <p>Supported deception environments</p>
            <h2>Multi-layer decoys beyond one service trap</h2>
          </div>
          <div className="home-v2-chip-grid">
            {DECEPTION_TYPES.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>

        <section className="home-v2-section">
          <div className="home-v2-section-head">
            <p>Trend-aligned modules</p>
            <h2>Built on current deception platform direction</h2>
          </div>
          <div className="home-v2-trend-grid">
            {TREND_MODULES.map((module) => (
              <article key={module.title} className="home-v2-trend-card">
                <h3>{module.title}</h3>
                <p>{module.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="contact" className="home-v2-cta">
          <div>
            <p>Contact / Demo</p>
            <h2>Schedule a dynamic deception walkthrough</h2>
            <span>See how adaptive decoys classify intent and increase attacker dwell time.</span>
          </div>
          <div className="home-v2-cta-actions">
            <Link to="/demo" className="home-v2-btn home-v2-btn-primary" onClick={() => trackCtaClick("request_demo", "/")}>
              Request Demo
            </Link>
            <Link to="/platform" className="home-v2-btn home-v2-btn-ghost" onClick={() => trackCtaClick("explore_platform", "/")}>
              Explore Platform
            </Link>
            <Link to="/contact" className="home-v2-btn home-v2-btn-ghost" onClick={() => trackCtaClick("contact_team", "/")}>
              Contact Team
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

function Metric({ label, value, mono = false }) {
  return (
    <div className="home-v2-metric">
      <span>{label}</span>
      <strong className={mono ? "mono" : ""}>{value}</strong>
    </div>
  );
}

function FlowNode({ icon, label }) {
  return (
    <div className="home-v2-flow-node">
      <div>{icon}</div>
      <span>{label}</span>
    </div>
  );
}

function LiveKpi({ label, value, mono = false }) {
  return (
    <div className="home-v2-live-kpi">
      <span>{label}</span>
      <strong className={mono ? "mono" : ""}>{value}</strong>
    </div>
  );
}
