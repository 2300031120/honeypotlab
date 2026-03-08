import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./apiConfig";
import {
  Shield, TrendingUp, Users, DollarSign,
  BarChart2, Globe, Lock, ChevronRight,
  Activity, ArrowUpRight, Zap
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Landing() {
  const REAL_ONLY_PARAMS = { params: { include_training: false } };
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([{ name: "--:--", value: 0 }]);
  const [summary, setSummary] = useState({ total: 0, critical: 0, blocked: 0, regions: 0, active: 0 });

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await axios.get(`${API_BASE}/dashboard/stats`, REAL_ONLY_PARAMS);
        const payload = res.data || {};
        const feed = Array.isArray(payload.feed) ? payload.feed : [];
        const geoDistribution = payload.geo_distribution || {};
        const hourBuckets = {};

        for (const item of feed) {
          const ts = item?.timestamp ? new Date(item.timestamp) : null;
          if (!ts || Number.isNaN(ts.getTime())) {
            continue;
          }
          const hour = `${String(ts.getHours()).padStart(2, "0")}:00`;
          hourBuckets[hour] = (hourBuckets[hour] || 0) + 1;
        }

        const nextChartData = Object.keys(hourBuckets)
          .sort()
          .map((hour) => ({ name: hour, value: hourBuckets[hour] }));
        setChartData(nextChartData.length > 0 ? nextChartData : [{ name: "--:--", value: 0 }]);
        setSummary({
          total: Number(payload.summary?.total || 0),
          critical: Number(payload.summary?.critical || 0),
          blocked: Number(payload.summary?.blocked || 0),
          regions: Object.keys(geoDistribution).length,
          active: feed.length,
        });
      } catch (err) {
        console.error("Landing stats fetch failed", err);
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#010409' }}>
        <div className="animate-pulse-soft" style={{ textAlign: 'center' }}>
          <Shield size={48} color="#58a6ff" />
          <p style={{ marginTop: '20px', fontSize: '12px', color: '#8b949e', letterSpacing: '2px' }}>LOADING SECURE INSTANCE...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page" style={{ padding: '0 0 80px 0' }}>
      <div className="cyber-grid" />

      {/* Top Nav */}
      <nav className="top-navigation">
        <div className="nav-logo">
          <Shield size={20} color="#58a6ff" style={{ marginRight: '10px' }} />
          <span>FINANCE_CORE_v4.2</span>
        </div>
        <div className="nav-links" style={{ gap: '24px' }}>
          <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#8b949e' }}>
            <span>Markets</span>
            <span>Portfolio</span>
            <span>Analytics</span>
          </div>
              <Link to="/auth/login" className="premium-glass" style={{
            padding: '6px 16px',
            borderRadius: '8px',
            textDecoration: 'none',
            color: '#e6edf3',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Lock size={14} /> Admin Access
          </Link>
        </div>
      </nav>

      {/* Hero Decoy */}
      <header style={{ padding: '120px 60px 40px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '60px', alignItems: 'center' }}>
          <div>
            <h1 className="text-gradient-blue" style={{ fontSize: '3.5rem', fontWeight: '900', lineHeight: '1.1', marginBottom: '24px' }}>
              REVOLUTIONIZING <br />ENTERPRISE CAPITAL
            </h1>
            <p style={{ fontSize: '1.1rem', color: '#8b949e', maxWidth: '500px', marginBottom: '40px' }}>
              Advanced algorithmic trading and portfolio management for high-net-worth institutions. Powered by zero-trust fiscal architecture.
            </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button className="premium-glass neon-glow-blue" style={{ padding: '12px 24px', borderRadius: '12px', border: '1px solid #58a6ff', color: '#e6edf3', fontWeight: '700', cursor: 'pointer' }}>
                View Institutional Portfolio
              </button>
              <button style={{ background: 'transparent', border: 'none', color: '#58a6ff', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                Technical Documents <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="premium-glass" style={{ borderRadius: '24px', padding: '32px', border: '1px solid #30363d' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#8b949e', textTransform: 'uppercase' }}>Daily Growth</div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#3fb950' }}>{summary.total} <ArrowUpRight size={20} /></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: '#8b949e', textTransform: 'uppercase' }}>Critical Events</div>
                <div style={{ fontSize: '24px', fontWeight: '900' }}>{summary.critical}</div>
              </div>
            </div>
            <div style={{ height: '200px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3fb950" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3fb950" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke="#3fb950" fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </header>

      {/* Metrics Grid */}
      <section style={{ maxWidth: '1400px', margin: '40px auto', padding: '0 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
          <MetricBox icon={<Globe color="#58a6ff" />} label="Region Coverage" value={`${summary.regions} Regions`} />
          <MetricBox icon={<Users color="#d2a8ff" />} label="Live Feed Size" value={`${summary.active} Events`} />
          <MetricBox icon={<DollarSign color="#3fb950" />} label="Threat Events" value={`${summary.total}`} />
          <MetricBox icon={<Zap color="#f1e05a" />} label="Blocked IPs" value={`${summary.blocked}`} />
        </div>
      </section>

      {/* Footer Info */}
      <footer style={{ marginTop: '80px', borderTop: '1px solid #21262d', padding: '40px 60px', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: '#484f58', display: 'flex', justifyContent: 'center', gap: '40px' }}>
          <span>© 2024 FINANCE CORE ARCHITECTURE. ALL RIGHTS RESERVED.</span>
          <span>SYSTEM_STATUS: <span style={{ color: '#3fb950' }}>NOMINAL</span></span>
          <span>COMPLIANCE_LEVEL: ISO/SEC 27001</span>
        </div>
      </footer>
    </div>
  );
}

const MetricBox = ({ icon, label, value }) => (
  <div className="premium-glass card-hover-translate" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
    <div style={{ background: 'rgba(255,255,255,0.03)', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: '800' }}>{value}</div>
    </div>
  </div>
);
