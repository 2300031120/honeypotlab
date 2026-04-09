import React, { startTransition, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, BrainCircuit, CheckCircle2, LayoutDashboard, Radar, ShieldCheck, Workflow } from "lucide-react";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { PUBLIC_SITE } from "./siteConfig";
import { trackCtaClick } from "./utils/analytics";
import { fetchPublicTelemetrySnapshot, type PublicTelemetrySnapshot } from "./utils/publicTelemetry";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

type TelemetryFeedItem = PublicTelemetrySnapshot["feed"][number];

const PLATFORM_BADGES = ["SSH", "HTTP", "API traps", "Session replay", "AI summaries", "Operator dashboard"];

const PLATFORM_CHECKLIST = [
  "High-interaction decoys that keep attacker behavior believable and contained",
  "Telemetry and replay that preserve what happened across every suspicious session",
  "AI-assisted summaries that help analysts, responders, and security teams move faster",
];

const PLATFORM_AUTHORITY = [
  {
    title: "Operational workflow first",
    detail: "From first touch to analyst response, every module keeps the incident path visible and actionable.",
  },
  {
    title: "Deception depth",
    detail: "Protocol coverage, believable lures, and replay make the platform useful for live monitoring and operator review.",
  },
  {
    title: "Readiness and response",
    detail: "One platform can support production monitoring, analyst briefings, and edge-response readiness without changing the workflow.",
  },
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
    detail: "Run monitoring, triage, and response handoff from one consistent deception workflow.",
    icon: <Workflow size={18} />,
  },
];

const SAMPLE_PLATFORM_SNAPSHOT: PublicTelemetrySnapshot = {
  scope: "sample",
  summary: {
    total_events: 37,
    critical_events: 4,
    medium_events: 11,
    low_events: 22,
    blocked_ips: 6,
    unique_ips: 12,
    unique_sessions: 5,
    live_sessions: 3,
    active_decoys: 8,
    threat_score: 82,
    top_target: "/admin/login-shadow",
    risk_level: "high",
    avg_score: 74,
  },
  insights: {
    dominant_behavior: "credential-access reconnaissance",
    recommended_action: "Review the decoy path, confirm exposed-route coverage, and prepare edge blocking for repeat source IPs.",
  },
  top_targets: [],
  top_source_ips: [],
  timeline: [],
  feed: [
    { id: "sample-platform-1", ts: "2026-04-01T09:14:22Z", path: "/login-shadow", severity: "medium", score: 48, event_type: "http", ip: "198.51.100.24" },
    { id: "sample-platform-2", ts: "2026-04-01T09:14:36Z", path: "/admin/login-shadow", severity: "high", score: 72, event_type: "http", ip: "198.51.100.24" },
    { id: "sample-platform-3", ts: "2026-04-01T09:15:03Z", path: "/api/internal/export", severity: "critical", score: 91, event_type: "http", ip: "198.51.100.24" },
  ],
  ai_summary:
    "Sample incident: a source moved from a decoy login to an admin-looking route, then probed an internal API path. The operator brief flags credential-access reconnaissance with response-ready evidence.",
  generated_at: "2026-04-01T09:15:30Z",
  window_hours: 24,
  include_training: false,
};

export default function Platform() {
  usePageAnalytics("platform");
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;
  useSeo({
    title: `Platform | ${PUBLIC_SITE.siteName}`,
    description: `Explore the ${productName} platform for deception surfaces, telemetry, replay, AI summaries, and operator workflows.`,
    ogTitle: `${PUBLIC_SITE.siteName} Platform`,
    ogDescription: "A clean view of the product modules behind the deception platform.",
  });

  const [snapshot, setSnapshot] = useState<PublicTelemetrySnapshot | null>(null);
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

  const hasLiveSignal = useMemo(() => {
    const summary = snapshot?.summary;
    return Boolean(
      (Array.isArray(snapshot?.feed) && snapshot.feed.length > 0) ||
      Number(summary?.total_events ?? 0) > 0 ||
      Number(summary?.live_sessions ?? 0) > 0 ||
      Number(summary?.active_decoys ?? 0) > 0
    );
  }, [snapshot]);

  const displaySnapshot = hasLiveSignal ? snapshot : SAMPLE_PLATFORM_SNAPSHOT;
  const usingSampleProof = !hasLiveSignal;
  const usingDemoSafeTelemetry = !usingSampleProof && snapshot?.scope === "public_demo";
  const proofMode = usingSampleProof ? "sample" : usingDemoSafeTelemetry ? "demo_safe" : "live";

  const stats = useMemo(() => {
    const summary = displaySnapshot?.summary;
    return [
      { label: "Active decoys", value: Number(summary?.active_decoys ?? 0) },
      {
        label: proofMode === "demo_safe" ? "Demo sessions" : "Live sessions",
        value: proofMode === "demo_safe" ? Number(summary?.total_events ?? 0) : Number(summary?.live_sessions ?? 0),
      },
      { label: "Total events", value: Number(summary?.total_events ?? 0) },
      { label: "Unique IPs", value: Number(summary?.unique_ips ?? 0) },
    ];
  }, [displaySnapshot, proofMode]);

  const feed = useMemo(() => {
    const items: TelemetryFeedItem[] = Array.isArray(displaySnapshot?.feed) ? displaySnapshot.feed : [];
    return items.slice(0, 4).map((item, index) => {
      const resolvedTs = item.ts;
      return {
        id: item.id ?? `${item.path || item.event_type || "event"}-${index}`,
        ts:
          resolvedTs !== null && resolvedTs !== undefined
            ? new Date(resolvedTs).toLocaleTimeString()
            : "--:--:--",
        path: String(item.path || item.event_type || "Sample route"),
      };
    });
  }, [displaySnapshot]);
  const replaySteps = feed;
  const activeLuresLabel = `${stats[0]?.value ?? 0} active lures`;
  const replayHeading =
    proofMode === "sample" ? "Sample attacker path" : proofMode === "demo_safe" ? "Demo-safe attacker path" : "Attacker path in motion";
  const platformHeroPills = ["Believable decoys", "Session replay", "Analyst-ready output"];
  const proofPanelTitle =
    proofMode === "sample" ? "Sample incident state" : proofMode === "demo_safe" ? "Demo-safe telemetry state" : "Current telemetry state";
  const proofStatusLabel =
    proofMode === "sample" ? "Sample proof" : proofMode === "demo_safe" ? "Demo-safe telemetry" : backendOnline ? "Live telemetry" : "Telemetry sync";

  return (
    <div className="marketing-shell platform-marketing-shell">
      <PublicHeader variant="cred" pagePath="/platform" />
      <main className="marketing-main">
        <section className="marketing-hero">
          <article className="marketing-card marketing-hero-copy">
            <div className="marketing-badge">Platform overview</div>
            <h1 className="marketing-title">One platform for exposed-route deception, evidence capture, replay, and analyst-ready output.</h1>
            <p className="marketing-subtitle">
              {productName} combines believable decoys, telemetry, session replay, and analyst-ready output in one
              workflow so teams can catch suspicious first-touch activity before it becomes service impact, data loss, or deeper compromise.
            </p>
            <div className="marketing-inline-points marketing-inline-points-compact">
              {platformHeroPills.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="marketing-actions">
              <Link to="/demo" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("request_demo", "/platform")}>
                Request Demo <ArrowRight size={16} />
              </Link>
              <Link to="/case-study" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("view_case_study", "/platform")}>
                View Sample Incident
              </Link>
            </div>
            <p className="marketing-page-footnote">
              Lead with the attacker path first, then let replay, metrics, and AI insight explain why the session matters before a team opens the full
              dashboard.
            </p>
          </article>

          <aside className="marketing-card marketing-hero-panel marketing-platform-panel">
            <div className="marketing-panel-head">
              <div>
                <div className="marketing-kicker">Proof panel</div>
                <h3>{proofPanelTitle}</h3>
              </div>
              <span className={`marketing-status ${proofMode !== "live" || backendOnline ? "online" : "offline"}`}>
                {proofStatusLabel}
              </span>
            </div>
            <div className="platform-hero-surface">
              <div className="platform-hero-surface-head">
                <span>Replay lane</span>
                <strong>{replayHeading}</strong>
              </div>
              <div className="platform-hero-route-list">
                {replaySteps.map((item, index) => (
                  <div key={item.id} className="platform-hero-route-step">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <code>{item.path}</code>
                      <small>{item.ts}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="marketing-stats platform-hero-metrics">
              {stats.map((item) => (
                <div key={item.label} className="marketing-stat">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="marketing-panel-mini-grid platform-hero-strip">
              <div className="marketing-panel-mini-card">
                <span>Routing model</span>
                <strong>{activeLuresLabel}</strong>
              </div>
              <div className="marketing-panel-mini-card">
                <span>Output model</span>
                <strong>Analyst-ready narrative</strong>
              </div>
            </div>
            <div className="marketing-summary platform-hero-summary">
              <div className="marketing-summary-head">
                <BrainCircuit size={16} />
                <span>AI insight</span>
              </div>
              <p>
                {String(displaySnapshot?.ai_summary || "").trim()}
              </p>
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
              <h2>Built to support early detection, investigation, and cleaner rollout decisions.</h2>
              <p>
                The platform is designed to do more than expose an attacker. It preserves the path, explains intent,
                and gives the team a repeatable workflow they can use under live conditions or in stakeholder review.
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
                operators a reviewable record they can use for response, briefings, or customer-facing proof.
              </p>
            </article>
            <article className="marketing-card marketing-list-card">
              <ul className="marketing-list">
                <li className="simple"><span>01</span><strong>Preserve the attacker journey from first touch to analyst action</strong></li>
                <li className="simple"><span>02</span><strong>Keep live metrics, replay, and AI context in one workflow</strong></li>
                <li className="simple"><span>03</span><strong>Support response teams, MSSPs, and stakeholder briefings from the same platform</strong></li>
              </ul>
            </article>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>Go deeper</p>
            <h2>Go deeper into deployment, integration, and trust detail.</h2>
          </div>
          <div className="marketing-grid-2 marketing-split-proof">
            <article className="marketing-card marketing-showcase marketing-proof-copy-card">
              <p className="marketing-kicker">Resources hub</p>
              <h3>Keep the main product story simple and send technical review into one clean lane.</h3>
              <p>
                Open one place for security posture, integration guides, deployment steps, and architecture context
                when the evaluator wants more than the platform overview.
              </p>
              <div className="marketing-actions">
                <Link to="/resources" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("view_resources", "/platform")}>
                  Open Resources
                </Link>
              </div>
            </article>
            <article className="marketing-card marketing-list-card">
              <p className="marketing-kicker">Evaluation order</p>
              <h3>The cleanest review path is proof, platform, pilot, then technical resources.</h3>
              <p>
                Start with the product workflow, then inspect deployment, integration, and trust material after the
                core value is already clear.
              </p>
              <div className="marketing-actions">
                <Link to="/case-study" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("view_case_study", "/platform")}>
                  View Sample Incident
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
              <h2>Need the platform walkthrough for your team?</h2>
              <p>Request a demo or talk to the team to see how {productName} supports exposed-route detection, analyst review, and rollout planning.</p>
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
