import React, { startTransition, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, BrainCircuit, CheckCircle2, LayoutDashboard, Radar, ShieldCheck, Workflow } from "lucide-react";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { PUBLIC_SITE } from "./siteConfig";
import { trackCtaClick } from "./utils/analytics";
import { fetchPublicTelemetrySnapshot } from "./utils/publicTelemetry";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

const PLATFORM_BADGES = ["SSH", "HTTP", "API traps", "Session replay", "AI summaries", "Operator dashboard"];

const PLATFORM_SIGNALS = ["Deception-led detection", "Readable AI triage", "Response-ready workflow"];

const PLATFORM_CHECKLIST = [
  "High-interaction decoys that keep attacker behavior believable and contained",
  "Telemetry and replay that preserve what happened across every suspicious session",
  "AI-assisted summaries that help analysts, responders, and training teams move faster",
];

const PLATFORM_AUTHORITY = [
  {
    title: "Operational workflow first",
    detail: "From first touch to analyst response, every module keeps the incident path visible and actionable.",
  },
  {
    title: "Deception depth",
    detail: "Protocol coverage, believable lures, and replay make the platform useful for both monitoring and training.",
  },
  {
    title: "Readiness and response",
    detail: "One platform can support production monitoring, cyber labs, and team exercises without changing the workflow.",
  },
];

const PLATFORM_PANEL_SIGNALS = [
  "Decoys remain believable across sessions",
  "Evidence stays readable for responders and analysts",
  "AI output supports faster review and action",
];

const MODULES = [
  {
    title: "Adaptive decoy layer",
    detail: "Believable login, admin, and internal portal surfaces that keep attacker interaction realistic.",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "Telemetry pipeline",
    detail: "Collect paths, sessions, IPs, and response patterns in one normalized event stream.",
    icon: <Activity size={18} />,
  },
  {
    title: "AI summary engine",
    detail: "Convert raw attacker movement into readable summaries and analyst-ready context.",
    icon: <BrainCircuit size={18} />,
  },
  {
    title: "Dashboard workflow",
    detail: "Give operators a clear place to review live events, priorities, and supporting evidence.",
    icon: <LayoutDashboard size={18} />,
  },
  {
    title: "Journey replay",
    detail: "Follow how an attacker moved from first touch to the most suspicious paths in the session.",
    icon: <Radar size={18} />,
  },
  {
    title: "Operational control",
    detail: "Run monitoring, labs, and readiness exercises from one consistent deception workflow.",
    icon: <Workflow size={18} />,
  },
];

export default function Platform() {
  usePageAnalytics("platform");
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;
  useSeo({
    title: `Platform | ${PUBLIC_SITE.siteName}`,
    description: `Explore the ${productName} platform for deception surfaces, telemetry, replay, AI summaries, and operator workflows.`,
    ogTitle: `${PUBLIC_SITE.siteName} Platform`,
    ogDescription: "A clean view of the product modules behind the deception platform.",
  });

  const [snapshot, setSnapshot] = useState(null);
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      try {
        const payload = await fetchPublicTelemetrySnapshot({ params: { hours: 24, limit: 5, include_training: false } });
        if (!alive) return;
        startTransition(() => {
          setSnapshot(payload);
          setBackendOnline(true);
        });
      } catch {
        if (!alive) return;
        startTransition(() => {
          setBackendOnline(false);
        });
      }
    };
    const handleVisibilityChange = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") {
        return;
      }
      void load();
    };

    void load();
    const interval = setInterval(() => {
      void load();
    }, 20000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      alive = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const stats = useMemo(() => {
    const summary = snapshot?.summary || {};
    return [
      { label: "Active decoys", value: Number(summary.active_decoys || 0) },
      { label: "Live sessions", value: Number(summary.live_sessions || 0) },
      { label: "Total events", value: Number(summary.total_events || 0) },
      { label: "Unique IPs", value: Number(summary.unique_ips || 0) },
    ];
  }, [snapshot]);

  const feed = useMemo(() => {
    const items = Array.isArray(snapshot?.feed) ? snapshot.feed : [];
    return items.slice(0, 4).map((item, index) => ({
      id: item?.id || `${item?.path || item?.url_path || item?.cmd || "event"}-${index}`,
      ts: item?.ts || item?.timestamp ? new Date(item.ts || item.timestamp).toLocaleTimeString() : "--:--:--",
      path: String(item?.path || item?.url_path || item?.cmd || item?.event_type || "Awaiting live event"),
    }));
  }, [snapshot]);
  const protocolTracks = useMemo(() => {
    const summary = snapshot?.summary || {};
    const liveSessions = Number(summary.live_sessions || 0);
    const activeDecoys = Number(summary.active_decoys || 0);
    const uniqueIps = Number(summary.unique_ips || 0);
    return [
      {
        label: "HTTP lure mesh",
        detail: "Credential probe capture",
        intensity: liveSessions > 0 ? Math.min(96, 44 + liveSessions * 10) : 0,
        value: liveSessions > 0 ? `${liveSessions} active flows` : "No live flows yet",
      },
      {
        label: "API trap layer",
        detail: "Recon and token harvesting",
        intensity: activeDecoys > 0 ? Math.min(92, 38 + activeDecoys * 9) : 0,
        value: activeDecoys > 0 ? `${activeDecoys} decoys armed` : "No decoys armed yet",
      },
      {
        label: "AI verdict stream",
        detail: "Readable incident narrative",
        intensity: uniqueIps > 0 ? Math.min(98, 46 + uniqueIps * 7) : 0,
        value: uniqueIps > 0 ? `${uniqueIps} source paths mapped` : "No source paths mapped yet",
      },
    ];
  }, [snapshot]);
  const replaySteps =
    feed.length > 0
      ? feed
      : [
          { id: "replay-wait-1", ts: "--:--:--", path: "Waiting for live replay steps" },
          { id: "replay-wait-2", ts: "--:--:--", path: "First suspicious touch will appear here" },
          { id: "replay-wait-3", ts: "--:--:--", path: "Replay updates when telemetry arrives" },
        ];
  const activeLuresLabel = stats[0]?.value > 0 ? `${stats[0].value} active lures` : "No active lures yet";
  const replayHeading = feed.length > 0 ? "Attacker path in motion" : "Waiting for live attacker path";

  return (
    <div className="marketing-shell">
      <PublicHeader variant="cred" pagePath="/platform" />
      <main className="marketing-main">
        <section className="marketing-hero">
          <article className="marketing-card marketing-hero-copy">
            <div className="marketing-badge">Platform overview</div>
            <div className="marketing-hero-signal">
              {PLATFORM_SIGNALS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <h1 className="marketing-title">One platform for deception, evidence capture, replay, and analyst-ready output.</h1>
            <p className="marketing-subtitle">
              {productName} combines believable decoys, live telemetry, session replay, and AI-assisted output in one
              command workflow so teams can catch suspicious first-touch activity before it becomes service impact, data loss, or deeper compromise.
            </p>
            <div className="marketing-inline-points">
              <span>Believable decoys</span>
              <span>Readable AI summaries</span>
              <span>Operator-friendly workflow</span>
            </div>
            <div className="marketing-actions">
              <Link to="/demo" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("request_demo", "/platform")}>
                Request Demo <ArrowRight size={16} />
              </Link>
              <Link to="/architecture" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("view_architecture", "/platform")}>
                View Architecture
              </Link>
            </div>
            <div className="marketing-hero-story">
              <div className="marketing-hero-story-head">
                <span className="marketing-kicker">What the platform delivers</span>
                <strong>One command flow for early detection, analyst review, and cyber exercises.</strong>
              </div>
              <ul className="marketing-checklist marketing-checklist-compact">
                {PLATFORM_CHECKLIST.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <aside className="marketing-card marketing-hero-panel marketing-platform-panel">
            <div className="marketing-panel-head">
              <div>
                <div className="marketing-kicker">Live platform pulse</div>
                <h3>Current telemetry state</h3>
              </div>
              <span className={`marketing-status ${backendOnline ? "online" : "offline"}`}>
                {backendOnline ? "Online" : "Offline"}
              </span>
            </div>
            <div className="marketing-console-shell marketing-console-shell-tight">
              <div className="marketing-console-head">
                <span>High-interaction routing</span>
                <strong>{activeLuresLabel}</strong>
              </div>
              <div className="marketing-protocol-matrix">
                {protocolTracks.map((item) => (
                  <div key={item.label} className="marketing-protocol-row">
                    <div className="marketing-protocol-row-head">
                      <span>{item.label}</span>
                      <strong>{item.detail}</strong>
                    </div>
                    <div className="marketing-protocol-bar">
                      <span style={{ width: `${item.intensity}%` }} />
                    </div>
                    <small>{item.value}</small>
                  </div>
                ))}
              </div>
              <div className="marketing-session-replay">
                <div className="marketing-session-replay-head">
                  <span>Session replay</span>
                  <strong>{replayHeading}</strong>
                </div>
                <div className="marketing-session-replay-track">
                  {replaySteps.map((item, index) => (
                    <div key={item.id} className="marketing-session-step">
                      <span className="marketing-session-step-index">{String(index + 1).padStart(2, "0")}</span>
                      <code>{item.path}</code>
                      <small>{item.ts}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="marketing-stats">
              {stats.map((item) => (
                <div key={item.label} className="marketing-stat">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="marketing-stage-strip">
              <div>
                <span>Interaction mode</span>
                <strong>High-interaction decoys</strong>
              </div>
              <div>
                <span>Output model</span>
                <strong>Analyst-ready narrative</strong>
              </div>
            </div>
            <div className="marketing-summary">
              <div className="marketing-summary-head">
                <BrainCircuit size={16} />
                <span>AI insight</span>
              </div>
              <p>
                {String(snapshot?.ai_summary || "").trim() ||
                  "No live AI summary yet. Connect telemetry to populate analyst context."}
              </p>
            </div>
            <div className="marketing-panel-mini-grid">
              <div className="marketing-panel-mini-card">
                <span>Coverage</span>
                <strong>SSH, web, API, replay</strong>
              </div>
              <div className="marketing-panel-mini-card">
                <span>Operator fit</span>
                <strong>Readable in one glance</strong>
              </div>
            </div>
            <div className="marketing-stage-feed">
              <div className="marketing-stage-feed-head">
                <Activity size={14} />
                <span>Recent platform activity</span>
              </div>
              {feed.length === 0 ? (
                <p className="marketing-empty">Waiting for live events.</p>
              ) : (
                <ul className="marketing-stage-feed-list">
                  {feed.map((item) => (
                    <li key={item.id}>
                      <span>{item.ts}</span>
                      <code>{item.path}</code>
                    </li>
                  ))}
                </ul>
                )}
              </div>
            <div className="marketing-mini-pill-row">
              {PLATFORM_PANEL_SIGNALS.map((item) => (
                <span key={item} className="marketing-mini-pill">
                  {item}
                </span>
              ))}
            </div>
          </aside>
        </section>

        <section className="marketing-card marketing-live-ribbon">
          <div className="marketing-live-ribbon-head">
            <Activity size={15} />
            <strong>Platform capabilities</strong>
          </div>
          <div className="marketing-inline-points marketing-inline-points-wide">
            {PLATFORM_BADGES.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-authority-band">
            <article className="marketing-card marketing-authority-copy">
              <p className="marketing-kicker">Operational value</p>
              <h2>Built to support early detection, investigation, and cyber-readiness exercises.</h2>
              <p>
                The platform is designed to do more than expose an attacker. It preserves the path, explains intent,
                and gives the team a repeatable workflow they can use under live conditions or in structured drills.
              </p>
              <ul className="marketing-checklist marketing-checklist-compact">
                {PLATFORM_CHECKLIST.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="marketing-card marketing-authority-list">
              {PLATFORM_AUTHORITY.map((item) => (
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
            <p>Modules</p>
              <h2>What your team actually gets from the product</h2>
          </div>
          <div className="marketing-grid-3">
            {MODULES.map((item) => (
              <article key={item.title} className="marketing-card marketing-feature">
                <div className="marketing-icon-box">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-split-proof">
            <article className="marketing-card marketing-showcase marketing-proof-copy-card">
              <p className="marketing-kicker">Why it matters</p>
              <h3>From suspicious interaction to a clean incident narrative.</h3>
              <p>
                An attacker enters a decoy, telemetry preserves the journey, AI summarizes intent, and the dashboard gives
                operators a reviewable record they can use for response, briefings, or training.
              </p>
            </article>
            <article className="marketing-card marketing-list-card">
              <ul className="marketing-list">
                <li className="simple"><span>01</span><strong>Preserve the attacker journey from first touch to analyst action</strong></li>
                <li className="simple"><span>02</span><strong>Keep live metrics, replay, and AI context in one workflow</strong></li>
                <li className="simple"><span>03</span><strong>Support response teams, labs, and readiness exercises from the same platform</strong></li>
              </ul>
            </article>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>Go deeper</p>
            <h2>See how the platform fits into real environments and how it gets launched safely.</h2>
          </div>
          <div className="marketing-grid-2 marketing-split-proof">
            <article className="marketing-card marketing-showcase marketing-proof-copy-card">
              <p className="marketing-kicker">Integration fit</p>
              <h3>Map websites, edge feeds, and provider alerts into one intake path.</h3>
              <p>
                See the current ingest contract, bootstrap scripts, provider-ready templates, and the verification flow
                that proves events actually land in the analyst workflow.
              </p>
              <div className="marketing-actions">
                <Link to="/integrations" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("view_integrations", "/platform")}>
                  View Integrations
                </Link>
              </div>
            </article>
            <article className="marketing-card marketing-list-card">
              <p className="marketing-kicker">Deployment fit</p>
              <h3>Review the production path before you expose the platform publicly.</h3>
              <p>
                Check the PostgreSQL-backed deployment route, launch preflight requirements, trusted-host protection,
                and the authenticated readiness view operators can use after login.
              </p>
              <div className="marketing-actions">
                <Link to="/deployment" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("view_deployment", "/platform")}>
                  View Deployment
                </Link>
              </div>
            </article>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>Live workflow</p>
            <h2>How the product behaves during a real attacker interaction</h2>
          </div>
          <div className="marketing-grid-3">
            <article className="marketing-card marketing-step">
              <div className="marketing-icon-box">
                <ShieldCheck size={18} />
              </div>
              <h3>Attract</h3>
              <p>Believable decoys surface reconnaissance, credential probing, and first-touch exploration.</p>
            </article>
            <article className="marketing-card marketing-step">
              <div className="marketing-icon-box">
                <Activity size={18} />
              </div>
              <h3>Capture</h3>
              <p>Sessions, paths, IPs, and behavioral signals are preserved in one readable event stream.</p>
            </article>
            <article className="marketing-card marketing-step">
              <div className="marketing-icon-box">
                <BrainCircuit size={18} />
              </div>
              <h3>Explain</h3>
              <p>AI summaries and operator dashboards turn raw movement into a cleaner threat narrative.</p>
            </article>
          </div>
        </section>

        <section className="marketing-card marketing-cta">
          <div className="marketing-cta-copy">
              <h2>Need the platform walkthrough for your team or lab?</h2>
              <p>Explore the architecture or request a demo to see how {productName} supports early detection, response, and readiness.</p>
          </div>
          <div className="marketing-actions">
            <Link to="/demo" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("request_demo", "/platform")}>
              Request Demo
            </Link>
            <Link to="/contact" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("contact_team", "/platform")}>
              Contact Team
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
