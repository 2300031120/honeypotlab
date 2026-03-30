import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API_BASE, WS_BASE } from './apiConfig';
import {
  Activity, Shield, AlertTriangle,
  Wifi, Globe as GlobeIcon, Target, Cpu, ShieldAlert, Zap, Search, FileSearch, ChevronRight, TrendingUp, BrainCircuit
} from "lucide-react";
import { motion, AnimatePresence } from "./utils/motionLite.jsx";
import { ForecastSparkChart, MitreDonutChart, SeverityDonutChart } from "./components/charts/SignalCharts.jsx";
import ThreatGlobe from "./components/dashboard/ThreatGlobe.jsx";
import { isSyntheticEvent, stableGeoLatLng } from "./utils/eventUtils";
import { createManagedWebSocket, safeParseJson } from "./utils/realtime";

// Trap severity config
const TRAP_CONFIG = {
  '/.env': { color: '#f85149', label: 'CRITICAL', icon: '🔑' },
  '/wp-login.php': { color: '#f85149', label: 'HIGH', icon: '🔐' },
  '/phpmyadmin/': { color: '#d29922', label: 'HIGH', icon: '🛢' },
  '/.git/config': { color: '#d29922', label: 'HIGH', icon: '🐙' },
  '/actuator/env': { color: '#d29922', label: 'HIGH', icon: '⚙' },
  '/actuator/health': { color: '#3fb950', label: 'LOW', icon: '💚' },
  '/admin': { color: '#d29922', label: 'MEDIUM', icon: '🔒' },
  '/admin/': { color: '#d29922', label: 'MEDIUM', icon: '🔒' },
  '/config.php': { color: '#f85149', label: 'HIGH', icon: '🗄' },
  '/xmlrpc.php': { color: '#f85149', label: 'HIGH', icon: '⚡' },
  '/api/v1/users': { color: '#d29922', label: 'MEDIUM', icon: '👤' },
  '/server-status': { color: '#3fb950', label: 'LOW', icon: '📊' },
  '/robots.txt': { color: '#3fb950', label: 'LOW', icon: '🤖' },
  '/wp-admin/': { color: '#d29922', label: 'MEDIUM', icon: '📁' },
};

const EMPTY_ADAPTIVE_METRICS = {
  profile_mode: "adaptive",
  summary: {
    total_sessions: 0,
    avg_policy_risk_score: 0,
    avg_interaction_steps: 0,
  },
  distribution: {
    policy_strategy: {},
  },
  sessions: [],
};

const EMPTY_ADAPTIVE_INTELLIGENCE = {
  window: { event_count: 0, hours: 24 },
  policy_summary: {
    total_sessions: 0,
    avg_policy_risk_score: 0,
    dominant_strategy: null,
    strategy_distribution: {},
  },
  top_countries: [],
  top_paths: [],
  tactic_matrix: [],
  risk_series: [],
  high_risk_sessions: [],
};

const Dashboard = () => {
  const REAL_ONLY_PARAMS = { params: { include_training: false } };
  const [stats, setStats] = useState({
    summary: { total: 0, critical: 0, blocked: 0 },
    feed: [],
    trap_distribution: {}
  });
  const [severityData, setSeverityData] = useState([]);
  const [mitreData, setMitreData] = useState([]);
  const [httpTrapFeed, setHttpTrapFeed] = useState([]);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [globeData, setGlobeData] = useState([]);
  const [arcsData, setArcsData] = useState([]);
  const [predictions, setPredictions] = useState(null);
  const [healthData, setHealthData] = useState({
    resources: { cpu: null, memory: null },
    neural_hive: { latency_ms: null },
    integrity: { trust_index: null, siem_sync: null }
  });
  const [opsReadiness, setOpsReadiness] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState('');
  const [adaptiveMetrics, setAdaptiveMetrics] = useState(EMPTY_ADAPTIVE_METRICS);
  const [adaptiveIntelligence, setAdaptiveIntelligence] = useState(EMPTY_ADAPTIVE_INTELLIGENCE);
  const [selectedTimelineSession, setSelectedTimelineSession] = useState("");
  const [sessionTimeline, setSessionTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const latencyMs = Number(healthData.neural_hive?.latency_ms);
  const latencyScore = Number.isFinite(latencyMs) ? Math.max(0, 100 - (latencyMs / 10)) : null;
  const avgPolicyRisk = Number(adaptiveMetrics.summary?.avg_policy_risk_score || 0);
  const policyStrategyEntries = Object.entries(adaptiveMetrics.distribution?.policy_strategy || {}).sort((a, b) => Number(b[1]) - Number(a[1]));
  const dominantPolicyStrategy = policyStrategyEntries[0]?.[0] || "none";
  const totalPolicyStrategySessions = policyStrategyEntries.reduce((acc, [, value]) => acc + Number(value || 0), 0);
  const topRiskSessions = [...(adaptiveMetrics.sessions || [])]
    .sort((a, b) => Number(b.policy_risk_score || 0) - Number(a.policy_risk_score || 0))
    .slice(0, 5);
  const topCountries = adaptiveIntelligence.top_countries || [];
  const topTactics = adaptiveIntelligence.tactic_matrix || [];
  const readinessChecks = opsReadiness?.checks || [];
  const readinessPassCount = readinessChecks.filter((item) => item.status === "pass").length;
  const readinessScore = readinessChecks.length ? Math.round((readinessPassCount / readinessChecks.length) * 100) : null;
  const readinessTone = opsReadiness?.status === "ready" ? "#3fb950" : "#d29922";
  const readinessLabel = opsReadiness?.status === "ready" ? "ROLL_OUT_READY" : "ATTENTION_NEEDED";
  const readinessActions = (opsReadiness?.next_actions || []).slice(0, 3);

  const loadAdaptiveTimeline = async (sessionId) => {
    const safeSessionId = String(sessionId || "").trim();
    if (!safeSessionId) {
      setSelectedTimelineSession("");
      setSessionTimeline([]);
      return;
    }
    setTimelineLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/deception/adaptive/timeline/${encodeURIComponent(safeSessionId)}`, REAL_ONLY_PARAMS);
      const payload = res.data || {};
      setSelectedTimelineSession(safeSessionId);
      setSessionTimeline(payload.timeline || []);
    } catch (err) {
      console.error("Fetch adaptive timeline failed", err);
      setSelectedTimelineSession(safeSessionId);
      setSessionTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  const fetchData = async () => {
    const errors = [];
    let candidateTimelineSession = selectedTimelineSession;
    setRefreshing(true);
    setLoadError('');
    try {
      const res = await axios.get(`${API_BASE}/dashboard/stats`, REAL_ONLY_PARAMS);
      const data = {
        summary: res.data.summary || { total: 0, critical: 0, blocked: 0 },
        feed: res.data.feed || [],
        trap_distribution: res.data.trap_distribution || {},
        mitre_distribution: res.data.mitre_distribution || {}
      };
      setStats(data);

      // Globe Data
      const points = data.feed.filter(e => e.geo).map(e => ({
        ...(stableGeoLatLng(e.geo || e.country || e.ip || "Unknown", e.ip || e.session_id || e.id)),
        size: e.severity === 'high' ? 0.5 : 0.2,
        color: e.severity === 'high' ? '#f85149' : '#58a6ff',
        label: `${e.cmd || e.event_type} (${e.geo})`
      }));
      setGlobeData(points);

      // 3D Arcs: Attacks landing on Honeypot (Central Europe baseline)
      const arcs = points.map(p => ({
        startLat: p.lat,
        startLng: p.lng,
        endLat: 51.5074, // London/Center of honeypot cluster
        endLng: -0.1278,
        color: p.color
      }));
      setArcsData(arcs);

      // Separate HTTP trap events for the trap panel
      const traps = (data.feed || []).filter(e => e.event_type === 'http_probe' || e.url_path);
      setHttpTrapFeed(traps.slice(0, 20));

      const sev = { high: 0, medium: 0, low: 0 };
      data.feed.forEach(e => sev[e.severity] = (sev[e.severity] || 0) + 1);
      setSeverityData([
        { name: 'Critical', value: sev.high },
        { name: 'Medium', value: sev.medium },
        { name: 'Low', value: sev.low }
      ]);

      // MITRE Distribution
      setMitreData(Object.keys(data.mitre_distribution).map(t => ({ name: t, value: data.mitre_distribution[t] })));
    } catch (err) {
      errors.push("dashboard");
      console.error("Fetch stats failed", err);
    }

    try {
      const healthRes = await axios.get(`${API_BASE}/intelligence/health`, REAL_ONLY_PARAMS);
      setHealthData(healthRes.data || {});
    } catch (err) {
      errors.push("health");
      console.error("Fetch health failed", err);
    }

    try {
      const predRes = await axios.get(`${API_BASE}/intelligence/predict`);
      setPredictions(predRes.data || null);
    } catch (err) {
      errors.push("predictions");
      console.error("Fetch predictions failed", err);
    }

    try {
      const readinessRes = await axios.get(`${API_BASE}/ops/readiness`);
      setOpsReadiness(readinessRes.data || null);
    } catch (err) {
      errors.push("readiness");
      console.error("Fetch ops readiness failed", err);
      setOpsReadiness(null);
    }

    try {
      const adaptiveRes = await axios.get(`${API_BASE}/deception/adaptive/metrics`);
      const payload = adaptiveRes.data || {};
      const sessions = payload.sessions || [];
      setAdaptiveMetrics({
        profile_mode: payload.profile_mode || "adaptive",
        summary: payload.summary || EMPTY_ADAPTIVE_METRICS.summary,
        distribution: payload.distribution || EMPTY_ADAPTIVE_METRICS.distribution,
        sessions,
      });
      if (!candidateTimelineSession && sessions.length > 0) {
        candidateTimelineSession = String(
          [...sessions].sort((a, b) => Number(b.policy_risk_score || 0) - Number(a.policy_risk_score || 0))[0]?.session_id || ""
        );
      }
    } catch (err) {
      errors.push("adaptive_metrics");
      if (err?.response?.status !== 401) {
        console.error("Fetch adaptive metrics failed", err);
      }
      setAdaptiveMetrics(EMPTY_ADAPTIVE_METRICS);
    }

    try {
      const intelRes = await axios.get(`${API_BASE}/deception/adaptive/intelligence`, REAL_ONLY_PARAMS);
      const intelPayload = intelRes.data || {};
      setAdaptiveIntelligence({
        window: intelPayload.window || EMPTY_ADAPTIVE_INTELLIGENCE.window,
        policy_summary: intelPayload.policy_summary || EMPTY_ADAPTIVE_INTELLIGENCE.policy_summary,
        top_countries: intelPayload.top_countries || [],
        top_paths: intelPayload.top_paths || [],
        tactic_matrix: intelPayload.tactic_matrix || [],
        risk_series: intelPayload.risk_series || [],
        high_risk_sessions: intelPayload.high_risk_sessions || [],
      });
      if (!candidateTimelineSession && (intelPayload.high_risk_sessions || []).length > 0) {
        candidateTimelineSession = String(intelPayload.high_risk_sessions[0]?.session_id || "");
      }
    } catch (err) {
      errors.push("adaptive_intel");
      if (err?.response?.status !== 401) {
        console.error("Fetch adaptive intelligence failed", err);
      }
      setAdaptiveIntelligence(EMPTY_ADAPTIVE_INTELLIGENCE);
    }

    if (candidateTimelineSession) {
      await loadAdaptiveTimeline(candidateTimelineSession);
    } else {
      setSessionTimeline([]);
    }
    setLoadError(errors.includes("dashboard") ? "Unable to refresh dashboard telemetry right now. Check auth or backend state, then try refresh." : "");
    setLastUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();

    // Mouse tracking for interactive effects
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);

    const ws = createManagedWebSocket(
      `${WS_BASE}/ws/incidents`,
      {
        onMessage: (event) => {
          const data = safeParseJson(event.data);
          if (!data || isSyntheticEvent(data)) return;
          setStats(prev => ({
            ...prev,
            summary: {
              ...prev.summary,
              total: (prev.summary?.total || 0) + 1,
              critical: data.severity === 'high' ? (prev.summary?.critical || 0) + 1 : (prev.summary?.critical || 0)
            },
            feed: [data, ...(prev.feed || []).slice(0, 49)]
          }));
          if (data.url_path || data.event_type === 'http_probe') {
            setHttpTrapFeed(prev => [data, ...prev.slice(0, 19)]);
          }
        },
        onError: (err) => console.error("WS Message Error", err),
      },
      { reconnect: true }
    );

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      ws.close();
    };
  }, []);

  const blockAdversary = async (ip) => {
    if (!window.confirm(`Autonomous Response: Block IP ${ip}?`)) return;
    try {
      const res = await axios.post(`${API_BASE}/soc/block-ip`, { ip, reason: "Manual SOC Intervention" });
      if (res.data.status === "success") {
        alert(res.data.message);
        setStats(prev => ({ ...prev, summary: { ...prev.summary, blocked: ((prev.summary?.blocked) || 0) + 1 } }));
      }
    } catch (err) {
      alert("Block failed: " + (err.response?.data?.message || err.message));
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };


  const getSeverityBadge = (sev) => {
    const styles = {
      high: { bg: 'rgba(248,81,73,0.15)', color: '#f85149', label: 'CRITICAL' },
      medium: { bg: 'rgba(210,153,34,0.15)', color: '#d29922', label: 'MEDIUM' },
      low: { bg: 'rgba(56,139,253,0.15)', color: '#3fb950', label: 'BASELINE' }
    };
    const s = styles[sev] || styles.low;
    return (
      <span style={{
        background: s.bg, color: s.color, padding: '2px 8px', borderRadius: '4px',
        fontSize: '10px', fontWeight: '900', border: `1px solid ${s.color}30`,
        letterSpacing: '0.5px'
      }}>
        {s.label}
      </span>
    );
  };

  const siemSyncRate = healthData.integrity?.siem_sync ?? "N/A";
  const policyRiskTrend =
    avgPolicyRisk >= 80 ? "CRITICAL" :
      avgPolicyRisk >= 55 ? "HIGH" :
        avgPolicyRisk >= 30 ? "MEDIUM" : "LOW";

  return (
    <div style={{ 
      padding: isFullscreen ? '20px' : '40px 60px',
      background: '#010409',
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Interactive background overlay */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(88, 166, 255, 0.05) 0%, transparent 50%)`,
        pointerEvents: 'none',
        zIndex: 0
      }} />

      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '32px',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Activity size={24} color="#58a6ff" />
            <h1 className="text-gradient-blue" style={{
              margin: 0, fontSize: '2.5rem', fontWeight: '950',
              letterSpacing: '-1px',
              transform: `translateX(${mousePosition.x * 0.01}px)`
            }}>
              NEURAL_COMMAND_HUB
            </h1>
          </div>
          <p style={{ margin: 0, color: '#8b949e', fontSize: '15px', fontWeight: '500' }}>Autonomous threat telemetry and cognitive defense coordination</p>
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <button
            onClick={fetchData}
            style={{
              background: 'rgba(63, 185, 80, 0.12)',
              border: '1px solid rgba(63, 185, 80, 0.3)',
              color: '#3fb950',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            className="interactive-glow"
          >
            {refreshing ? 'REFRESHING' : 'REFRESH DATA'}
          </button>
          <button
            onClick={toggleFullscreen}
            style={{
              background: 'rgba(88, 166, 255, 0.1)',
              border: '1px solid rgba(88, 166, 255, 0.3)',
              color: '#58a6ff',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            className="interactive-glow"
          >
            {isFullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN'}
          </button>
          {lastUpdatedAt && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid #30363d',
              background: 'rgba(22, 27, 34, 0.72)',
              color: '#8b949e',
              fontSize: '11px',
              fontWeight: '800'
            }}>
              LAST_SYNC :: {lastUpdatedAt}
            </div>
          )}
          <div className="premium-glass active-node-indicator" style={{
            padding: '12px 24px', borderRadius: '30px',
            fontSize: '12px', fontWeight: '900', color: '#58a6ff',
            display: 'flex', alignItems: 'center', gap: '12px'
          }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#58a6ff', boxShadow: '0 0 10px #58a6ff' }} />
            SIEM_CONNECTED :: {healthData.integrity?.siem_sync == null ? 'UNKNOWN' : (healthData.integrity?.siem_sync === '100%' ? 'SPLUNK_HEC_01' : 'SYNC_DEGRADED')}
          </div>
        </div>
      </motion.header>

      {loadError && (
        <div style={{
          marginBottom: '24px',
          padding: '14px 18px',
          borderRadius: '14px',
          border: '1px solid rgba(248,81,73,0.24)',
          background: 'rgba(248,81,73,0.08)',
          color: '#ffb4a8',
          fontSize: '13px',
          fontWeight: '700',
          position: 'relative',
          zIndex: 1
        }}>
          {loadError}
        </div>
      )}

      {/* ENHANCED UNIVERSAL SPLUNK SEARCH */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'rgba(22, 27, 34, 0.8)',
          border: '1px solid #30363d',
          borderRadius: '16px',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          marginBottom: '40px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(20px)',
          position: 'relative',
          zIndex: 1,
          transform: `translateY(${mousePosition.y * 0.01}px)`
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#58a6ff' }}>
          <Search size={22} />
          <span style={{ fontWeight: '900', fontSize: '13px', letterSpacing: '1px' }}>SPLUNK&gt;</span>
        </div>
        <input
          type="text"
          placeholder="| pivot CyberSentinel_Honeypot count(Event) by mitre_tactic, severity"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#f0f6fc',
            fontSize: '15px',
            fontFamily: "'JetBrains Mono', monospace"
          }}
        />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            style={{ 
              background: '#21262d', 
              border: '1px solid #30363d', 
              color: '#8b949e', 
              padding: '8px 16px', 
              borderRadius: '10px', 
              fontSize: '12px', 
              fontWeight: '800',
              transition: 'all 0.3s ease'
            }}
            className="magnetic-btn"
          >
            Presets
          </button>
          <button 
            style={{ 
              background: '#1f6feb', 
              border: 'none', 
              color: '#fff', 
              padding: '8px 24px', 
              borderRadius: '10px', 
              fontSize: '12px', 
              fontWeight: '900', 
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            className="btn-hover magnetic-btn"
          >
            SEARCH
          </button>
        </div>
      </motion.div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        <KPICard label="TOTAL INTERACTIONS" value={stats.summary.total} color="#3fb950" icon={<Activity size={20} />} trend="+12.4%" border="neon-border-green" />
        <KPICard label="CRITICAL THREATS" value={stats.summary.critical} color="#f85149" icon={<AlertTriangle size={20} />} trend="WARNING" border="neon-border-red" />
        <KPICard label="SIEM SYNC RATE" value={siemSyncRate} color="#0ea5e9" icon={<Wifi size={20} />} trend="LIVE" border="neon-border-blue" />
        <KPICard label="ADAPTIVE RISK" value={avgPolicyRisk.toFixed(1)} color="#ff7b72" icon={<BrainCircuit size={20} />} trend={policyRiskTrend} border="neon-border-red" />
        <KPICard label="AUTO-BLOCKED" value={stats.summary.blocked} color="#d29922" icon={<Shield size={20} />} trend="AUTONOMOUS" border="neon-border-orange" />
      </div>

      {opsReadiness && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card"
          style={{ borderRadius: '20px', overflow: 'hidden', marginBottom: '32px' }}
        >
          <div style={{
            padding: '20px 28px',
            borderBottom: '1px solid #30363d',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            background: 'rgba(255,255,255,0.02)'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: '#8b949e', fontWeight: '800', letterSpacing: '0.08em' }}>OPS READINESS</div>
              <h3 style={{ margin: '6px 0 0', fontSize: '18px', fontWeight: '900', color: '#f0f6fc' }}>
                {readinessLabel} {readinessScore != null ? `:: ${readinessScore}%` : ""}
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <ReadinessMetric label="Sites" value={opsReadiness.coverage?.sites_total ?? 0} />
              <ReadinessMetric label="Events" value={opsReadiness.coverage?.events_total ?? 0} />
              <ReadinessMetric label="Canaries" value={opsReadiness.coverage?.canary_tokens_total ?? 0} />
              <ReadinessMetric label="Latest event" value={opsReadiness.coverage?.latest_event_at ? 'SEEN' : 'NONE'} />
            </div>
          </div>

          <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '12px', fontWeight: '800' }}>Readiness checks</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                {readinessChecks.map((item) => (
                  <ReadinessCheckCard key={item.key} item={item} />
                ))}
              </div>
            </div>

            <div style={{
              border: '1px solid #30363d',
              borderRadius: '16px',
              padding: '18px',
              background: 'rgba(255,255,255,0.02)',
              display: 'grid',
              gap: '14px'
            }}>
              <div>
                <div style={{ fontSize: '12px', color: '#8b949e', fontWeight: '800', marginBottom: '8px' }}>Next actions</div>
                {readinessActions.length === 0 ? (
                  <div style={{ color: readinessTone, fontWeight: '800', fontSize: '13px' }}>No blocking readiness actions right now.</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '18px', color: '#e6edf3', display: 'grid', gap: '8px', fontSize: '13px' }}>
                    {readinessActions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Link to="/sites" style={readinessActionStyle}>CONFIGURE SITES</Link>
                <Link to="/deception" style={readinessActionStyle}>REVIEW DECEPTION</Link>
                <Link to="/telemetry" style={readinessActionStyle}>OPEN TELEMETRY</Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Globe & Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '24px', marginBottom: '40px' }}>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card"
          style={{ borderRadius: '20px', overflow: 'hidden', height: '450px', position: 'relative' }}
        >
          <div style={{ position: 'absolute', top: '24px', left: '24px', zIndex: 5 }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <GlobeIcon size={20} color="#58a6ff" /> Global Threat Mesh
            </h3>
            <div style={{ fontSize: '10px', color: '#8b949e', fontWeight: '800', marginTop: '4px' }}>ACTIVE_ATTACK_VECTORS_REALTIME</div>
          </div>

          <ThreatGlobe globeData={globeData} arcsData={arcsData} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card"
          style={{ padding: '32px', borderRadius: '20px' }}
        >
          <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Target size={20} color="#ff7b72" /> MITRE ATT&CK Tactics
          </h3>
          <div style={{ height: '300px' }}>
            <MitreDonutChart mitreData={mitreData} />
          </div>
        </motion.div>
      </div>

      {/* Risk, Health & Forecast Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '40px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card"
          style={{ padding: '32px', borderRadius: '20px' }}
        >
          <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={20} color="#d29922" /> Risk Profile
          </h3>
          <div style={{ height: '180px' }}>
            <SeverityDonutChart severityData={severityData} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card"
          style={{ padding: '32px', borderRadius: '20px', background: 'rgba(56,139,253,0.03)' }}
        >
          <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu size={20} color="#58a6ff" /> Neural Performance
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <HealthBar label="AI Inference" value={latencyScore} color="#58a6ff" />
            <HealthBar label="Intelligence Load" value={healthData.resources?.cpu} color="#3fb950" />
            <HealthBar label="Neural Memory" value={healthData.resources?.memory} color="#3fb950" />
            <HealthBar label="Trust Index" value={healthData.integrity?.trust_index} color="#d29922" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card"
          style={{ padding: '32px', borderRadius: '20px', background: 'rgba(63,185,80,0.03)' }}
        >
          <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp size={20} color="#3fb950" /> Threat Forecast
          </h3>
          <div style={{ height: '140px' }}>
            <ForecastSparkChart forecast={predictions?.forecast || []} />
          </div>
          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '10px', color: '#8b949e', fontWeight: '800' }}>AI_CONFIDENCE: </span>
            <span style={{ fontSize: '10px', color: '#3fb950', fontWeight: '900' }}>{predictions?.confidence ?? 0}%</span>
          </div>
        </motion.div>
      </div>
      {/* Adaptive policy matrix */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
        style={{ borderRadius: '20px', overflow: 'hidden', marginBottom: '24px' }}
      >
        <div style={{
          padding: '20px 32px',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(88,166,255,0.04)'
        }}>
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '12px', color: '#58a6ff' }}>
            <BrainCircuit size={18} color="#58a6ff" /> Adaptive Deception Policy Matrix
          </h4>
          <span style={{ fontSize: '11px', color: '#8b949e', fontWeight: '700' }}>
            PROFILE_MODE: {String(adaptiveMetrics.profile_mode || "adaptive").toUpperCase()}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', padding: '24px 32px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '10px', fontWeight: '700' }}>Policy Strategy Distribution</div>
            {policyStrategyEntries.length === 0 ? (
              <div style={{ color: '#484f58', fontSize: '12px' }}>No adaptive sessions yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {policyStrategyEntries.map(([strategy, count]) => {
                  const safeCount = Number(count || 0);
                  const ratio = totalPolicyStrategySessions > 0 ? (safeCount / totalPolicyStrategySessions) * 100 : 0;
                  return (
                    <div key={strategy}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
                        <span style={{ color: '#e6edf3', fontWeight: '700' }}>{String(strategy).replaceAll('_', ' ')}</span>
                        <span style={{ color: '#58a6ff', fontWeight: '800' }}>{safeCount}</span>
                      </div>
                      <div style={{ height: '8px', borderRadius: '999px', background: '#1f2937', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(4, ratio)}%`, height: '100%', background: 'linear-gradient(90deg, #1f6feb, #58a6ff)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '10px', fontWeight: '700' }}>
              Top Risk Sessions ({dominantPolicyStrategy === "none" ? "N/A" : dominantPolicyStrategy.replaceAll('_', ' ')})
            </div>
            <div style={{ fontSize: '10px', color: '#6e7681', marginBottom: '8px' }}>
              Click a session to inspect adaptive timeline.
            </div>
            <div style={{ border: '1px solid #30363d', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#161b22', color: '#8b949e' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Session</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Policy</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {topRiskSessions.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: '10px', color: '#484f58' }}>No session telemetry yet.</td>
                    </tr>
                  ) : (
                    topRiskSessions.map((session) => (
                      <tr key={session.session_id} style={{ borderTop: '1px solid #21262d' }}>
                        <td style={{ padding: '8px', color: '#e6edf3', fontFamily: "'JetBrains Mono', monospace" }}>
                          <button
                            type="button"
                            onClick={() => loadAdaptiveTimeline(session.session_id)}
                            style={{
                              background: selectedTimelineSession === session.session_id ? 'rgba(88,166,255,0.18)' : 'transparent',
                              border: selectedTimelineSession === session.session_id ? '1px solid rgba(88,166,255,0.4)' : '1px solid transparent',
                              color: '#e6edf3',
                              borderRadius: '6px',
                              padding: '4px 6px',
                              cursor: 'pointer',
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '11px'
                            }}
                          >
                            {String(session.session_id || "").slice(0, 14)}
                          </button>
                        </td>
                        <td style={{ padding: '8px', color: '#58a6ff' }}>
                          {String(session.policy_strategy || "n/a").replaceAll('_', ' ')}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#ff7b72', fontWeight: '800' }}>
                          {Number(session.policy_risk_score || 0).toFixed(1)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Global adaptive intelligence */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
        style={{ borderRadius: '20px', overflow: 'hidden', marginBottom: '24px' }}
      >
        <div style={{
          padding: '20px 32px',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(46,160,67,0.06)'
        }}>
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#3fb950' }}>
            Global Adaptive Intelligence
          </h4>
          <span style={{ fontSize: '11px', color: '#8b949e', fontWeight: '700' }}>
            LAST {adaptiveIntelligence.window?.hours || 24}H EVENTS: {adaptiveIntelligence.window?.event_count || 0}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', padding: '24px 32px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '10px', fontWeight: '700' }}>Country Risk Index</div>
            {topCountries.length === 0 ? (
              <div style={{ color: '#484f58', fontSize: '12px' }}>No country telemetry in current window.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {topCountries.slice(0, 8).map((row) => (
                  <div key={row.country}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
                      <span style={{ color: '#e6edf3', fontWeight: '700' }}>{row.country}</span>
                      <span style={{ color: '#ff7b72', fontWeight: '800' }}>{Number(row.risk_index || 0).toFixed(1)}</span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '999px', background: '#1f2937', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(4, Number(row.risk_index || 0))}%`, height: '100%', background: 'linear-gradient(90deg, #f85149, #ff7b72)' }} />
                    </div>
                    <div style={{ fontSize: '10px', color: '#8b949e', marginTop: '3px' }}>
                      events={row.events} critical={row.critical_events} avg_score={row.avg_score}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '10px', fontWeight: '700' }}>MITRE Tactic Pressure</div>
            {topTactics.length === 0 ? (
              <div style={{ color: '#484f58', fontSize: '12px' }}>No tactic matrix available yet.</div>
            ) : (
              <div style={{ border: '1px solid #30363d', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#161b22', color: '#8b949e' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Tactic</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Severity</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topTactics.slice(0, 8).map((row, index) => (
                      <tr key={`${row.tactic}-${row.severity}-${index}`} style={{ borderTop: '1px solid #21262d' }}>
                        <td style={{ padding: '8px', color: '#e6edf3' }}>{row.tactic}</td>
                        <td style={{ padding: '8px', color: '#58a6ff' }}>{row.severity}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#d29922', fontWeight: '800' }}>{row.events}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '10px', fontWeight: '700' }}>
              Adaptive Session Timeline {selectedTimelineSession ? `(${String(selectedTimelineSession).slice(0, 16)})` : ""}
            </div>
            <div style={{ border: '1px solid #30363d', borderRadius: '12px', maxHeight: '290px', overflowY: 'auto', padding: '10px' }}>
              {timelineLoading ? (
                <div style={{ color: '#8b949e', fontSize: '12px' }}>Loading timeline...</div>
              ) : sessionTimeline.length === 0 ? (
                <div style={{ color: '#484f58', fontSize: '12px' }}>Select a risk session to inspect event-by-event progression.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[...sessionTimeline].reverse().slice(0, 12).map((item) => (
                    <div key={`${item.index}-${item.ts}`} style={{ border: '1px solid #21262d', borderRadius: '8px', padding: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10px', color: '#8b949e' }}>{item.ts || 'n/a'}</span>
                        <span style={{ fontSize: '10px', color: '#ff7b72', fontWeight: '800' }}>
                          risk={Number(item.policy_risk_score || 0).toFixed(1)}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#58a6ff', marginBottom: '4px', fontWeight: '700' }}>
                        {item.policy_strategy || 'progressive_disclosure'} | {item.event_type || 'unknown'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#e6edf3', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {item.cmd || ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* HTTP Honeypot Trap Network — Real-World Attack Surface */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
        style={{ borderRadius: '20px', overflow: 'hidden', marginBottom: '24px' }}
      >
        <div style={{
          padding: '20px 32px', borderBottom: '1px solid #30363d',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(248,81,73,0.03)'
        }}>
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '12px', color: '#f85149' }}>
            <Target size={18} color="#f85149" /> HTTP Honeypot Trap Network
            <span style={{ fontSize: '11px', background: 'rgba(248,81,73,0.15)', color: '#f85149', padding: '2px 10px', borderRadius: '12px', border: '1px solid rgba(248,81,73,0.3)' }}>
              LIVE
            </span>
          </h4>
          <span style={{ fontSize: '11px', color: '#484f58', fontWeight: '700' }}>Real attackers &amp; bots hitting your honeypot surface</span>
        </div>

        <div className="premium-scroll" style={{ maxHeight: '280px', overflowY: 'auto' }}>
          {httpTrapFeed.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#484f58' }}>
              <Target size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
              <p style={{ fontSize: '14px' }}>Traps armed. Waiting for real-world attackers...</p>
              <p style={{ fontSize: '11px', marginTop: '4px' }}>Try: <code style={{ background: '#21262d', padding: '2px 6px', borderRadius: '4px' }}>curl http://your-domain/.env</code></p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {httpTrapFeed.map((ev, i) => {
                const trapCfg = TRAP_CONFIG[ev.url_path] || { color: '#8b949e', label: 'PROBE', icon: '🌐' };
                return (
                  <motion.div
                    key={ev.id || i}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                      padding: '14px 32px', borderBottom: '1px solid #21262d',
                      display: 'flex', alignItems: 'center', gap: '16px',
                      borderLeft: `3px solid ${trapCfg.color}40`
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>{trapCfg.icon}</span>
                    <span style={{ color: '#58a6ff', fontSize: '11px', minWidth: '75px', fontFamily: "monospace", fontWeight: '700' }}>
                      {new Date(ev.ts).toLocaleTimeString()}
                    </span>
                    <span style={{
                      background: `${trapCfg.color}20`, color: trapCfg.color,
                      padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '900',
                      border: `1px solid ${trapCfg.color}40`, minWidth: '70px', textAlign: 'center'
                    }}>{trapCfg.label}</span>
                    <code style={{ fontFamily: 'monospace', fontSize: '13px', color: trapCfg.color, fontWeight: '700' }}>
                      {ev.http_method || 'GET'} {ev.url_path || ev.cmd}
                    </code>
                    <span style={{ fontSize: '11px', color: '#8b949e', flex: 1 }}>
                      from <strong style={{ color: '#e6edf3' }}>{ev.ip}</strong>
                      {ev.geo && <span style={{ marginLeft: '6px' }}>🌍 {ev.geo}</span>}
                    </span>
                    {ev.attacker_type && (
                      <span style={{
                        fontSize: '10px', background: 'rgba(88,166,255,0.1)', color: '#58a6ff',
                        padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(88,166,255,0.2)',
                        whiteSpace: 'nowrap', fontWeight: '700'
                      }}>{ev.attacker_type}</span>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </motion.div>

      {/* Live Incident Stream */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
        style={{ borderRadius: '20px', overflow: 'hidden' }}
      >
        <div style={{
          padding: '24px 32px', borderBottom: '1px solid #30363d',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Zap size={20} color="#3fb950" /> Live Hyper-Incident Stream
          </h4>
          <Link to="/forensics/detail" style={{ color: '#58a6ff', fontSize: '13px', textDecoration: 'none', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSearch size={16} /> ENTER_FORENSICS_LAB <ChevronRight size={16} />
          </Link>
        </div>

        <div className="premium-scroll" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {stats.feed.length === 0 ? (
            <div style={{ padding: '80px', textAlign: 'center', color: '#484f58' }}>
              <Shield size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
              <p style={{ fontSize: '16px', fontWeight: '600', color: '#e6edf3' }}>NO_THREATS_DETECTED :: SYSTEM_LISTENING</p>
              <p style={{ fontSize: '12px', maxWidth: '56ch', margin: '10px auto 0', lineHeight: 1.7 }}>
                Wire a site, inject simulator traffic, or arm more deception surfaces if you want the dashboard to show a stronger live narrative.
              </p>
              <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <Link to="/sites" style={readinessActionStyle}>ADD SITE</Link>
                <Link to="/simulator" style={readinessActionStyle}>RUN SIMULATOR</Link>
                <Link to="/deception" style={readinessActionStyle}>ARM DECEPTION</Link>
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {stats.feed.map((ev, i) => (
                <motion.div
                  key={ev.id || `${ev.ts}-${i}`}
                  initial={{ opacity: 0, x: -50, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  exit={{ opacity: 0, x: 50 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="feed-item"
                  style={{
                    padding: '16px 32px', borderBottom: '1px solid #21262d',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1, minWidth: 0 }}>
                    <span style={{ color: '#58a6ff', fontSize: '11px', minWidth: '80px', fontFamily: "'JetBrains Mono', monospace", fontWeight: '700' }}>
                      {new Date(ev.ts).toLocaleTimeString()}
                    </span>
                    {getSeverityBadge(ev.severity)}
                    {/* Event type badge */}
                    <span style={{
                      fontSize: '9px', padding: '1px 6px', borderRadius: '3px', fontWeight: '900',
                      background: ev.url_path ? 'rgba(210,153,34,0.15)' : 'rgba(63,185,80,0.1)',
                      color: ev.url_path ? '#d29922' : '#3fb950',
                      border: `1px solid ${ev.url_path ? 'rgba(210,153,34,0.3)' : 'rgba(63,185,80,0.2)'}`,
                      flexShrink: 0
                    }}>
                      {ev.url_path ? 'HTTP' : 'SHELL'}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#e6edf3', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>
                        {ev.cmd || ev.event_type || 'SYSTEM_EVENT'}
                      </span>
                      {ev.ip && <span style={{ fontSize: '10px', color: '#484f58', fontFamily: "monospace" }}>IP: {ev.ip} {ev.attacker_type ? `· ${ev.attacker_type}` : ''}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      {ev.reputation !== undefined && (
                        <div style={{ fontSize: '9px', fontWeight: '900', color: ev.reputation > 50 ? '#f85149' : '#3fb950', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid currentColor' }}>
                          ABUSE_SCORE: {ev.reputation}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => blockAdversary(ev.ip)}
                          style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: '#f85149', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '800', cursor: 'pointer' }}
                        >BLOCK</button>
                        <Link to={`/forensics/detail?id=${ev.id}`}>
                          <button style={{ background: 'none', border: '1px solid #30363d', color: '#8b949e', padding: '6px', borderRadius: '6px', cursor: 'pointer', transition: '0.2s' }} className="btn-hover"><ChevronRight size={16} /></button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const KPICard = ({ label, value, color, icon, trend, border }) => (
  <motion.div
    whileHover={{ y: -5 }}
    className={`glass-card ${border}`}
    style={{ padding: '28px', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
      <div style={{ color: color }}>{icon}</div>
      <span style={{ color: '#8b949e', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800' }}>{label}</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
      <div className="stats-value" style={{ fontSize: '2.5rem', fontWeight: '950', color: '#fff' }}>{value}</div>
      <div style={{ fontSize: '10px', fontWeight: '900', color: color, background: `${color}15`, padding: '2px 8px', borderRadius: '4px' }}>{trend}</div>
    </div>
  </motion.div>
);

const readinessActionStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '10px',
  textDecoration: 'none',
  border: '1px solid rgba(88,166,255,0.24)',
  background: 'rgba(88,166,255,0.08)',
  color: '#58a6ff',
  fontSize: '11px',
  fontWeight: '900',
  letterSpacing: '0.04em'
};

const readinessStateStyles = {
  pass: { border: '1px solid rgba(63,185,80,0.24)', background: 'rgba(63,185,80,0.08)', color: '#3fb950', label: 'PASS' },
  warn: { border: '1px solid rgba(210,153,34,0.24)', background: 'rgba(210,153,34,0.08)', color: '#d29922', label: 'WARN' },
  fail: { border: '1px solid rgba(248,81,73,0.24)', background: 'rgba(248,81,73,0.08)', color: '#f85149', label: 'FAIL' },
};

const ReadinessMetric = ({ label, value }) => (
  <div style={{
    minWidth: '92px',
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid #30363d',
    background: 'rgba(255,255,255,0.03)',
    display: 'grid',
    gap: '4px'
  }}>
    <span style={{ fontSize: '10px', color: '#8b949e', fontWeight: '800', letterSpacing: '0.05em' }}>{label}</span>
    <strong style={{ fontSize: '14px', color: '#f0f6fc' }}>{value}</strong>
  </div>
);

const ReadinessCheckCard = ({ item }) => {
  const tone = readinessStateStyles[item.status] || readinessStateStyles.warn;
  return (
    <div style={{
      borderRadius: '14px',
      padding: '14px',
      ...tone
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
        <strong style={{ fontSize: '12px', color: tone.color }}>{String(item.key || '').replaceAll('_', ' ').toUpperCase()}</strong>
        <span style={{ fontSize: '10px', fontWeight: '900', color: tone.color }}>{tone.label}</span>
      </div>
      <div style={{ color: '#e6edf3', fontSize: '12px', lineHeight: 1.6 }}>{item.summary}</div>
    </div>
  );
};


const HealthBar = ({ label, value, color }) => {
  const displayValue = Number.isFinite(value) ? value : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '800' }}>
        <span style={{ color: '#8b949e' }}>{label}</span>
        <span style={{ color: color }}>{displayValue == null ? 'N/A' : `${displayValue}%`}</span>
      </div>
      <div style={{ height: '4px', background: '#21262d', borderRadius: '2px', overflow: 'hidden' }}>
        {displayValue != null && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${displayValue}%` }}
            style={{ height: '100%', background: color }}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;


