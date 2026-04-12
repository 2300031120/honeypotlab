import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from './apiConfig';
import { ArrowLeft, Zap, Globe as GlobeIcon, FileSearch, Activity, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { AttackTimeline } from "./components/charts/AttackTimeline";
import { GeographicHeatmap } from "./components/charts/GeographicHeatmap";
import { TTPAnalysis } from "./components/charts/TTPAnalysis";
import { SeverityDonutChart, MitreDonutChart } from "./components/charts/SignalCharts";

type DashboardFeedEvent = {
  id?: string | number;
  ts?: string | number | null;
  url_path?: string;
  cmd?: string;
  event_type?: string | null;
  severity?: "high" | "medium" | "low" | string;
  geo?: string;
  country?: string;
  ip?: string | null;
  session_id?: string | number | null;
  http_method?: string;
  attacker_type?: string;
  reputation?: number;
  mitre_tactic?: string;
  mitre_technique?: string;
  score?: number;
};

type DashboardStats = {
  summary: {
    total: number;
    critical: number;
    blocked: number;
  };
  feed: DashboardFeedEvent[];
  trap_distribution: Record<string, number>;
  mitre_distribution?: Record<string, number>;
  demo_mode?: boolean;
};

const Analytics = () => {
  const [stats, setStats] = useState<DashboardStats>({
    summary: { total: 0, critical: 0, blocked: 0 },
    feed: [],
    trap_distribution: {},
    demo_mode: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API_BASE}/telemetry/public/demo`, {
        params: { limit: 100, hours: 24, include_training: false }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const severityData = Object.entries(stats.trap_distribution).map(([name, value]) => {
    const severity = name.toLowerCase().includes('env') || name.toLowerCase().includes('config') || name.toLowerCase().includes('git') ? 'high' :
                     name.toLowerCase().includes('admin') || name.toLowerCase().includes('phpmyadmin') ? 'high' :
                     name.toLowerCase().includes('actuator') ? 'medium' : 'low';
    const color = severity === 'high' ? '#f85149' : severity === 'medium' ? '#d29922' : '#3fb950';
    return { name, value, color };
  });

  const mitreData = Object.entries(stats.mitre_distribution || {}).map(([name, value]) => ({
    name,
    value,
    color: '#58a6ff'
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100vh' }}>
        <div className="text-muted">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link to="/dashboard" style={{ color: '#e6edf3', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#e6edf3' }}>
            Advanced Analytics
          </h1>
          <div style={{ fontSize: '14px', color: '#8b949e', marginTop: '4px' }}>
            Comprehensive threat analysis and visualization
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Activity size={20} color="#58a6ff" />
            <span style={{ fontSize: '12px', color: '#8b949e', fontWeight: '700' }}>TOTAL EVENTS</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#e6edf3' }}>{stats.summary.total}</div>
        </div>

        <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Shield size={20} color="#f85149" />
            <span style={{ fontSize: '12px', color: '#8b949e', fontWeight: '700' }}>CRITICAL</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#f85149' }}>{stats.summary.critical}</div>
        </div>

        <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Zap size={20} color="#3fb950" />
            <span style={{ fontSize: '12px', color: '#8b949e', fontWeight: '700' }}>BLOCKED</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#3fb950' }}>{stats.summary.blocked}</div>
        </div>
      </div>

      {/* Attack Timeline */}
      <div className="glass-card" style={{ padding: '32px', borderRadius: '20px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap size={20} color="#d29922" /> Attack Timeline
        </h3>
        <AttackTimeline events={stats.feed.slice(0, 50)} height={200} />
      </div>

      {/* Geographic Distribution */}
      <div className="glass-card" style={{ padding: '32px', borderRadius: '20px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <GlobeIcon size={20} color="#42b8ff" /> Geographic Distribution
        </h3>
        <GeographicHeatmap events={stats.feed.slice(0, 100)} height={300} />
      </div>

      {/* TTP Analysis */}
      <div className="glass-card" style={{ padding: '32px', borderRadius: '20px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileSearch size={20} color="#a371f7" /> MITRE ATT&CK Pattern Analysis
        </h3>
        <TTPAnalysis events={stats.feed.slice(0, 100)} height={400} />
      </div>

      {/* Severity Distribution */}
      <div className="glass-card" style={{ padding: '32px', borderRadius: '20px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Shield size={20} color="#d29922" /> Severity Distribution
        </h3>
        <div style={{ height: '200px' }}>
          <SeverityDonutChart severityData={severityData} />
        </div>
      </div>

      {/* MITRE Tactics */}
      <div className="glass-card" style={{ padding: '32px', borderRadius: '20px' }}>
        <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileSearch size={20} color="#58a6ff" /> MITRE ATT&CK Tactics
        </h3>
        <div style={{ height: '200px' }}>
          <MitreDonutChart mitreData={mitreData} />
        </div>
      </div>
    </div>
  );
};

export default Analytics;
