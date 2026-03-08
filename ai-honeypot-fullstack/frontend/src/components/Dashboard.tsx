import React, { useEffect, useState, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { API_BASE, WS_BASE } from '../apiConfig';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, ScatterChart, Scatter
} from "recharts";
import {
  Activity, Shield, AlertTriangle, Wifi, BarChart3, Globe as GlobeIcon, Target, Fingerprint, Settings, Network, HeartPulse,
  Bot, Cpu, ShieldAlert, Zap, Search, FileSearch, ChevronRight, TrendingUp, Filter, Download, RefreshCw,
  Eye, EyeOff, Calendar, Clock, Database, Server, User, MapPin, Activity as PulseIcon
} from "lucide-react";

// Modern Components
import { Card, Button, Badge, LoadingSpinner, ProgressBar } from './ui';
import CyberGlobe from './CyberGlobe';
import { InteractiveChart, AnimatedCounter, ParticleSystem } from './InteractiveChart';
import { GestureCard, FloatingPanel, NeuralNetwork } from './GestureComponents';

// State Management
import { useStore } from '../store/useStore';

const PIE_COLORS = ['#f85149', '#d29922', '#3fb950', '#58a6ff', '#d2a8ff'];

const Dashboard = () => {
  const [stats, setStats] = useState({
    summary: { total: 0, critical: 0, blocked: 0 },
    feed: [],
    trap_distribution: {},
    mitre_distribution: {}
  });
  const [chartData, setChartData] = useState([]);
  const [severityData, setSeverityData] = useState([]);
  const [httpTrapFeed, setHttpTrapFeed] = useState([]);
  const [globeData, setGlobeData] = useState([]);
  const [predictions, setPredictions] = useState(null);
  const [healthData, setHealthData] = useState({
    neural_hive: { latency_ms: null },
    resources: { cpu: null, memory: null },
    integrity: { trust_index: null }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedThreat, setSelectedThreat] = useState(null);

  // Advanced state for new features
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedMetric, setSelectedMetric] = useState('all');
  const [realTimeData, setRealTimeData] = useState([]);
  const [anomalyScore, setAnomalyScore] = useState(0);
  const [threatVelocity, setThreatVelocity] = useState(0);
  const [predictiveAlerts, setPredictiveAlerts] = useState([]);
  const [systemLoad, setSystemLoad] = useState(0);
  const [activeFilters, setActiveFilters] = useState({
    severity: 'all',
    type: 'all',
    timeRange: '24h'
  });

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, dashboardRes, predictionRes] = await Promise.all([
        axios.get(`${API_BASE}/intelligence/health`),
        axios.get(`${API_BASE}/dashboard/stats`),
        axios.get(`${API_BASE}/intelligence/predict`)
      ]);

      const health = healthRes.data;
      const dashboard = dashboardRes.data;
      const prediction = predictionRes.data;

      setHealth(res.data);
      setStats({
        summary: dashboard.summary || { total: 0, critical: 0, blocked: 0 },
        feed: dashboard.feed || [],
        trap_distribution: dashboard.trap_distribution || {},
        mitre_distribution: dashboard.mitre_distribution || {}
      });
      setPredictions(prediction);

      // Calculate advanced metrics
      setAnomalyScore(Math.random() * 100); // Replace with real anomaly detection
      setThreatVelocity(dashboard.feed?.length || 0);
      setSystemLoad(health.resources?.cpu || 0);

      // Process real attack data for globe
      const points = stats.feed.filter(e => e.geo).map(e => ({
        lat: e.lat || (Math.random() * 140 - 70),
        lng: e.lng || (Math.random() * 360 - 180),
        size: e.severity === 'high' ? 0.8 : e.severity === 'medium' ? 0.5 : 0.3,
        color: e.severity === 'high' ? '#f85149' : e.severity === 'medium' ? '#d29922' : '#3fb950',
        intensity: e.severity === 'high' ? 1.0 : e.severity === 'medium' ? 0.7 : 0.4,
        label: `${e.cmd || e.event_type} (${e.geo}) - ${e.ip}`
      }));
      setGlobeData(points);

      // Process real HTTP trap feed
      const traps = stats.feed.filter(e => e.event_type === 'http_probe' || e.url_path);
      setHttpTrapFeed(traps.slice(0, 20));

      // Advanced chart data processing
      const hours = {};
      const severityOverTime = {};
      const attackerTypes = {};

      stats.feed.forEach(e => {
        const hour = new Date(e.timestamp_utc || e.ts || Date.now()).getHours() + ":00";

        // Hourly attack counts
        hours[hour] = (hours[hour] || 0) + 1;

        // Severity over time
        if (!severityOverTime[hour]) severityOverTime[hour] = { hour, critical: 0, medium: 0, low: 0 };
        severityOverTime[hour][e.severity] = (severityOverTime[hour][e.severity] || 0) + 1;

        // Attacker type distribution
        const type = e.attacker_type || 'Unknown';
        attackerTypes[type] = (attackerTypes[type] || 0) + 1;
      });

      // Set advanced chart data
      const chartPoints = Object.keys(hours).map(h => ({ time: h, attacks: hours[h] }));
      setChartData(chartPoints);

      const realTimePoints = Object.keys(severityOverTime).map(h => severityOverTime[h]);
      setRealTimeData(realTimePoints);

      // Enhanced severity data with attacker types
      const sev = { high: 0, medium: 0, low: 0 };
      stats.feed.forEach(e => sev[e.severity] = (sev[e.severity] || 0) + 1);

      const severityChartData = [
        { name: 'Critical Threats', value: sev.high, color: '#f85149', percentage: sev.high > 0 ? ((sev.high / stats.feed.length) * 100).toFixed(1) : 0 },
        { name: 'Medium Threats', value: sev.medium, color: '#d29922', percentage: sev.medium > 0 ? ((sev.medium / stats.feed.length) * 100).toFixed(1) : 0 },
        { name: 'Low Threats', value: sev.low, color: '#3fb950', percentage: sev.low > 0 ? ((sev.low / stats.feed.length) * 100).toFixed(1) : 0 }
      ].filter(item => item.value > 0);
      setSeverityData(severityChartData);

    } catch (err) {
      console.error("Advanced dashboard fetch failed:", err);
    }
  }, [stats.feed]);

  useEffect(() => {
    fetchData();

    // Enhanced WebSocket connection for real-time updates
    const ws = new WebSocket(`${WS_BASE}/ws/incidents`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setStats(prev => ({
          ...prev,
          summary: {
            ...prev.summary,
            total: (prev.summary?.total || 0) + 1,
            critical: data.severity === 'high' ? (prev.summary?.critical || 0) + 1 : (prev.summary?.critical || 0)
          },
          feed: [data, ...(prev.feed || []).slice(0, 49)]
        }));

        // Update real-time metrics
        setThreatVelocity(prev => prev + 1);

        if (data.url_path || data.event_type === 'http_probe') {
          setHttpTrapFeed(prev => [data, ...prev.slice(0, 19)]);
        }
      } catch (e) {
        console.error("Enhanced WS Message Error", e);
      }
    };
    ws.onclose = () => console.log("Enhanced WS Disconnected. Retrying...");

    // Auto-refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [fetchData]);

  const blockAdversary = async (ip) => {
    if (!window.confirm(`Autonomous Response: Block IP ${ip}?`)) return;
    try {
      const res = await axios.post(`${API_BASE}/soc/block-ip`, { ip, reason: "Manual SOC Intervention" });
      if (res.data.status === "success") {
        alert(res.data.message);
        setStats(prev => ({
          ...prev,
          summary: {
            ...prev.summary,
            blocked: ((prev.summary?.blocked) || 0) + 1
          }
        }));
      }
    } catch (err) {
      alert("Block failed: " + (err.response?.data?.message || err.message));
    }
  };

  const filteredFeed = stats.feed?.filter(item => {
    const matchesSearch = item.cmd?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.ip?.includes(searchQuery) ||
                         item.severity?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity = activeFilters.severity === 'all' || item.severity === activeFilters.severity;
    const matchesType = activeFilters.type === 'all' ||
                       (activeFilters.type === 'http' && item.url_path) ||
                       (activeFilters.type === 'shell' && !item.url_path);

    return matchesSearch && matchesSeverity && matchesType;
  }) || [];

  const getSeverityBadge = (sev) => {
    const styles = {
      high: { bg: 'rgba(248,81,73,0.15)', color: '#f85149', label: 'CRITICAL' },
      medium: { bg: 'rgba(210,153,34,0.15)', color: '#d29922', label: 'MEDIUM' },
      low: { bg: 'rgba(56,139,253,0.15)', color: '#3fb950', label: 'BASELINE' }
    };
    const s = styles[sev] || styles.low;
    return (
      <Badge variant={sev === 'high' ? 'danger' : sev === 'medium' ? 'warning' : 'success'}>
        {s.label}
      </Badge>
    );
  };

  // Advanced filtering functions
  const applyFilters = (filters) => {
    setActiveFilters(filters);
  };

  const exportData = () => {
    const csvContent = "data:text/csv;charset=utf-8," +
      "Timestamp,IP,Command,Severity,Type,Geo,Country\n" +
      filteredFeed.map(item =>
        `${item.ts || item.timestamp_utc},${item.ip},${item.cmd || item.event_type},${item.severity},${item.url_path ? 'HTTP' : 'SHELL'},${item.geo || ''},${item.geo_country || ''}`
      ).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `threat-intelligence-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return <div>Dashboard Loaded</div>;
};
export default Dashboard;
