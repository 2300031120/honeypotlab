import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE, WS_BASE } from './apiConfig';
import {
    Shield, Zap, Activity, Layers, Brain, Target,
    CheckCircle2, AlertTriangle, RefreshCw, Play,
    Eye, Crosshair, Lock, Globe, Server, Database,
    Copy, ExternalLink, AlertCircle, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { isSyntheticEvent } from './utils/eventUtils';
import { createManagedWebSocket, safeParseJson } from './utils/realtime';

const PROFILE_CONFIG = {
  defensive: { color: '#58a6ff', label: 'Low Noise - Passive monitoring, minimal deception traces' },
  balanced: { color: '#d29922', label: 'Adaptive - Mix of real-sounding traps and gradual escalation' },
  aggressive: { color: '#f85149', label: 'Proactive Entrapment - Maximum honey, aggressive fingerprinting' }
};

const SEVERITY_COLORS = { high: '#f85149', medium: '#d29922', low: '#3fb950', critical: '#f85149' };

const DeceptionConfig = () => {
    const REAL_ONLY_PARAMS = { params: { include_training: false } };
    const [status, setStatus] = useState(null);
    const [honeytokens, setHoneytokens] = useState([]);
    const [canaryTokens, setCanaryTokens] = useState([]);
    const [liveFeed, setLiveFeed] = useState([]);
    const [activeProfile, setActiveProfile] = useState('balanced');
    const [protocols, setProtocols] = useState({
        credential_injection: true,
        honeyfile_generation: true,
        ai_adaptive: true,
        decoy_services: false,
    });
    const [deploying, setDeploying] = useState(false);
    const [deployMsg, setDeployMsg] = useState(null);
    const [autoModeSaving, setAutoModeSaving] = useState(false);
    const [autoTuning, setAutoTuning] = useState(false);
    const [autoMode, setAutoMode] = useState(false);
    const [posture, setPosture] = useState(null);
    const [protocolRuntime, setProtocolRuntime] = useState(null);
    const [protocolMetrics, setProtocolMetrics] = useState(null);
    const [protocolAlerts, setProtocolAlerts] = useState([]);
    const [runtimeToggleBusy, setRuntimeToggleBusy] = useState({});
    const [generating, setGenerating] = useState(false);
    const [newTokenLabel, setNewTokenLabel] = useState('');
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    const fetchAll = useCallback(async () => {
        try {
            const [statusRes, tokenRes, canaryRes, feedRes, runtimeRes, metricsRes, alertsRes] = await Promise.all([
                axios.get(`${API_BASE}/deception/status`),
                axios.get(`${API_BASE}/deception/honeytokens`),
                axios.get(`${API_BASE}/deception/canary-tokens`),
                axios.get(`${API_BASE}/deception/live-feed`, REAL_ONLY_PARAMS),
                axios.get(`${API_BASE}/protocols/status`).catch(() => ({ data: null })),
                axios.get(`${API_BASE}/protocols/metrics`).catch(() => ({ data: null })),
                axios.get(`${API_BASE}/protocols/alerts`).catch(() => ({ data: null })),
            ]);
            setStatus(statusRes.data);
            setHoneytokens(tokenRes.data);
            setCanaryTokens(canaryRes.data);
            setLiveFeed(feedRes.data);
            setProtocolRuntime(runtimeRes?.data || null);
            setProtocolMetrics(metricsRes?.data?.metrics || null);
            setProtocolAlerts(alertsRes?.data?.alerts || []);
            setActiveProfile(statusRes.data.active_profile || 'balanced');
            setProtocols(statusRes.data.protocols || {
                credential_injection: true,
                honeyfile_generation: true,
                ai_adaptive: true,
                decoy_services: false,
            });
            setAutoMode(Boolean(statusRes.data.auto_mode));
            setPosture(statusRes.data.posture || null);
        } catch (err) {
            console.error("Deception fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
        const interval = setInterval(fetchAll, 15000);
        const ws = createManagedWebSocket(
            `${WS_BASE}/ws/incidents`,
            {
                onMessage: (event) => {
                    const data = safeParseJson(event.data);
                    if (!data || isSyntheticEvent(data)) return;
                    setLiveFeed(prev => [data, ...prev.slice(0, 19)]);
                    if (data.severity === 'high') {
                        setStatus(prev => prev ? {
                            ...prev,
                            stats: { ...prev.stats, critical_threats: (prev.stats.critical_threats || 0) + 1, total_intercepts: (prev.stats.total_intercepts || 0) + 1 }
                        } : prev);
                    }
                },
            },
            { reconnect: true }
        );
        return () => { clearInterval(interval); ws.close(); };
    }, [fetchAll]);

    const handleDeploy = async () => {
        setDeploying(true);
        setDeployMsg(null);
        try {
            const res = await axios.post(`${API_BASE}/deception/deploy`, {
                profile: activeProfile,
                protocols
            });
            setDeployMsg({ type: 'success', text: res.data.message });
            fetchAll();
        } catch (err) {
            setDeployMsg({ type: 'error', text: err.response?.data?.detail || 'Deploy failed.' });
        } finally {
            setDeploying(false);
        }
    };

    const handleAutoModeToggle = async () => {
        const next = !autoMode;
        setAutoModeSaving(true);
        try {
            const res = await axios.post(`${API_BASE}/deception/auto-mode`, { enabled: next });
            setAutoMode(Boolean(res.data.auto_mode));
            if (res.data.result?.profile) setActiveProfile(res.data.result.profile);
            if (res.data.result?.protocols) setProtocols(res.data.result.protocols);
            if (res.data.result?.posture) setPosture(res.data.result.posture);
            setDeployMsg({
                type: 'success',
                text: next ? 'Auto-mode enabled. Dynamic posture tuning active.' : 'Auto-mode disabled. Manual profile control restored.'
            });
            fetchAll();
        } catch (err) {
            setDeployMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to update auto mode.' });
        } finally {
            setAutoModeSaving(false);
        }
    };

    const handleRunAutotune = async () => {
        setAutoTuning(true);
        try {
            const res = await axios.post(`${API_BASE}/deception/autotune`);
            if (res.data?.profile) setActiveProfile(res.data.profile);
            if (res.data?.protocols) setProtocols(res.data.protocols);
            if (res.data?.posture) setPosture(res.data.posture);
            setDeployMsg({
                type: 'success',
                text: `Auto-tune complete. Active profile: ${(res.data?.profile || activeProfile).toUpperCase()}.`
            });
            fetchAll();
        } catch (err) {
            setDeployMsg({ type: 'error', text: err.response?.data?.detail || 'Auto-tune failed.' });
        } finally {
            setAutoTuning(false);
        }
    };

    const handleGenerateCanary = async () => {
        if (!newTokenLabel.trim()) return;
        setGenerating(true);
        try {
            const res = await axios.post(`${API_BASE}/deception/canary-tokens/generate`, {
                type: 'URL',
                label: newTokenLabel.trim()
            });
            setCanaryTokens(prev => [res.data, ...prev]);
            setNewTokenLabel('');
        } catch (err) {
            console.error("Canary generation error:", err);
        } finally {
            setGenerating(false);
        }
    };

    const toggleProtocol = async (proto, currentStatus) => {
        try {
            const newStatus = !currentStatus;
            setProtocols(prev => ({ ...prev, [proto]: newStatus }));
            await axios.post(`${API_BASE}/deception/protocols/toggle`, {
                protocol: proto,
                active: newStatus
            });
        } catch (err) {
            console.error("Protocol toggle error:", err);
            // Revert on failure
            setProtocols(prev => ({ ...prev, [proto]: currentStatus }));
        }
    };

    const handleRuntimeModuleToggle = async (moduleName, currentEnabled) => {
        setRuntimeToggleBusy(prev => ({ ...prev, [moduleName]: true }));
        try {
            const nextEnabled = !currentEnabled;
            const res = await axios.post(`${API_BASE}/protocols/${moduleName}/toggle`, {
                enabled: nextEnabled
            });
            setDeployMsg({
                type: 'success',
                text: `Runtime module ${moduleName.toUpperCase()} ${nextEnabled ? 'enabled' : 'disabled'}.`
            });
            if (res.data?.module) {
                setProtocolRuntime(prev => {
                    const current = prev || { summary: {}, modules: {} };
                    const nextModules = { ...(current.modules || {}), [moduleName]: res.data.module };
                    const nextSummary = {
                        ...(current.summary || {}),
                        registered: Object.keys(nextModules).length,
                        enabled: Object.values(nextModules).filter(m => m?.enabled).length,
                        running: Object.values(nextModules).filter(m => m?.running).length,
                        unhealthy: Object.entries(nextModules).filter(([, m]) => !m?.healthy).map(([name]) => name)
                    };
                    return { ...current, summary: nextSummary, modules: nextModules };
                });
            }
            fetchAll();
        } catch (err) {
            setDeployMsg({
                type: 'error',
                text: err.response?.data?.detail || `Failed to toggle runtime module ${moduleName}.`
            });
        } finally {
            setRuntimeToggleBusy(prev => ({ ...prev, [moduleName]: false }));
        }
    };

    const Switch = ({ active, onClick, label }) => (
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <div
                onClick={onClick}
                style={{
                    width: '40px', height: '20px',
                    background: active ? '#238636' : '#30363d',
                    borderRadius: '10px', position: 'relative', cursor: 'pointer',
                    transition: '0.3s', border: `1px solid ${active ? '#3fb950' : '#484f58'}`
                }}
            >
                <div style={{
                    width: '14px', height: '14px', background: 'white', borderRadius: '50%',
                    position: 'absolute', top: '2px', left: active ? '22px' : '2px',
                    transition: '0.3s', boxShadow: active ? '0 0 8px #3fb950' : 'none'
                }} />
            </div>
            <span style={{ fontSize: '13px', color: active ? '#e6edf3' : '#8b949e' }}>{label}</span>
        </label>
    );

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#8b949e' }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginRight: '12px' }} />
            Loading Deception Engine...
        </div>
    );

    const s = status?.stats || {};
    const em = status?.escalation_matrix || [];
    const p = posture || status?.posture || {};
    const runtimeSummary = protocolRuntime?.summary || {};
    const runtimeModules = Object.entries(protocolRuntime?.modules || {});
    const runtimePersistence = protocolRuntime?.persistence || {};
    const runtimeMetrics = protocolMetrics?.protocols || {};
    const runtimeAlertCount = protocolAlerts.length;
    const runtimeMaxP95 = Object.values(runtimeMetrics).reduce((max, item) => {
        const value = Number(item?.p95_latency_ms || 0);
        return value > max ? value : max;
    }, 0);

    return (
        <div style={{ padding: '40px 60px', color: '#e6edf3', fontFamily: "'Roboto', sans-serif" }}>
            {/* Header */}
            <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '900', background: 'linear-gradient(135deg, #e6edf3, #f85149)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        DECEPTION CONTROL ENGINE
                    </h1>
                    <p style={{ color: '#8b949e', margin: '6px 0 0', fontSize: '13px' }}>
            Real-time adaptive honeypot management - All data from live threat intercepts
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(63,185,80,0.1)', border: '1px solid #3fb95050', borderRadius: '8px', padding: '8px 16px' }}>
                    <div style={{ width: '8px', height: '8px', background: '#3fb950', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
                    <span style={{ color: '#3fb950', fontSize: '12px', fontWeight: '800' }}>DECEPTION ACTIVE</span>
                </div>
            </div>

            {/* Live Stats Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '28px' }}>
                {[
                    { label: 'Total Intercepts', value: s.total_intercepts || 0, color: '#e6edf3', icon: <Eye size={14} /> },
                    { label: 'Critical Threats', value: s.critical_threats || 0, color: '#f85149', icon: <AlertTriangle size={14} /> },
                    { label: 'HTTP Trap Hits', value: s.http_trap_hits || 0, color: '#d29922', icon: <Target size={14} /> },
                    { label: 'Shell Sessions', value: s.shell_sessions || 0, color: '#58a6ff', icon: <Activity size={14} /> },
                    { label: 'Blocked IPs', value: s.blocked_ips || 0, color: '#3fb950', icon: <Shield size={14} /> },
                    { label: 'Breadcrumb Score', value: `${s.breadcrumb_score || 0}/10`, color: '#d2a8ff', icon: <Brain size={14} /> },
                ].map((stat, i) => (
                    <div key={i} style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '10px', padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8b949e', marginBottom: '6px', fontSize: '11px' }}>
                            {stat.icon} {stat.label}
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: '900', color: stat.color }}>
                            {stat.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Escalation Matrix */}
            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
                <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
            LIVE ESCALATION MATRIX - ADVERSARY JOURNEY STAGES
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    {em.map((phase, i) => {
                        const colors = ['#3fb950', '#58a6ff', '#d29922', '#f85149'];
                        return (
                            <div key={i} style={{
                                background: phase.active ? `rgba(${i === 0 ? '63,185,80' : i === 1 ? '88,166,255' : i === 2 ? '210,153,34' : '248,81,73'}, 0.06)` : '#161b22',
                                border: `1px solid ${phase.active ? colors[i] + '40' : '#21262d'}`,
                                borderRadius: '10px', padding: '16px', textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '11px', fontWeight: '900', color: phase.active ? colors[i] : '#484f58', marginBottom: '6px', letterSpacing: '1px' }}>
                                    {phase.phase}
                                </div>
                                <div style={{ fontSize: '28px', fontWeight: '900', color: phase.active ? colors[i] : '#30363d' }}>
                                    {phase.count}
                                </div>
                                <div style={{ fontSize: '10px', color: '#484f58' }}>events</div>
                                <div style={{ marginTop: '8px', display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '9px', fontWeight: '800', background: phase.active ? `${colors[i]}20` : '#0d1117', color: phase.active ? colors[i] : '#484f58' }}>
                                    {phase.active ? 'ACTIVE' : 'INACTIVE'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#0d1117', padding: '4px', borderRadius: '10px', width: 'fit-content', border: '1px solid #21262d' }}>
                {['overview', 'honeytokens', 'canary-tokens', 'live-feed'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{
                        background: activeTab === tab ? '#161b22' : 'transparent',
                        border: activeTab === tab ? '1px solid #30363d' : '1px solid transparent',
                        color: activeTab === tab ? '#e6edf3' : '#8b949e',
                        padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                        textTransform: 'capitalize'
                    }}>
                        {tab.replace('-', ' ')}
                    </button>
                ))}
            </div>

            {/* Tab: Overview - Profile + Protocol Controls */}
            {activeTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
                    <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '12px', padding: '24px' }}>
                        <div style={{ marginBottom: '20px', background: '#010409', border: '1px solid #21262d', borderRadius: '10px', padding: '14px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Dynamic Auto Mode</div>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: autoMode ? '#3fb950' : '#8b949e' }}>
                                        {autoMode ? 'Adaptive tuning enabled' : 'Manual tuning enabled'}
                                    </div>
                                </div>
                                <Switch active={autoMode} onClick={handleAutoModeToggle} label={autoModeSaving ? 'Saving...' : 'Auto'} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '8px' }}>
                                    <div style={{ color: '#8b949e', fontSize: '10px' }}>Dynamic Index</div>
                                    <div style={{ color: '#f59e0b', fontWeight: '800', fontSize: '14px' }}>{p.dynamic_index ?? 0}</div>
                                </div>
                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '8px' }}>
                                    <div style={{ color: '#8b949e', fontSize: '10px' }}>Sample Size</div>
                                    <div style={{ color: '#58a6ff', fontWeight: '800', fontSize: '14px' }}>{p.sample_size ?? 0}</div>
                                </div>
                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '8px' }}>
                                    <div style={{ color: '#8b949e', fontSize: '10px' }}>Recommended</div>
                                    <div style={{ color: PROFILE_CONFIG[p.recommended_profile || activeProfile]?.color || '#e6edf3', fontWeight: '800', fontSize: '12px', textTransform: 'uppercase' }}>
                                        {p.recommended_profile || activeProfile}
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleRunAutotune} disabled={autoTuning} style={{
                                width: '100%', padding: '10px 12px', borderRadius: '8px',
                                border: '1px solid #58a6ff50', background: autoTuning ? '#161b22' : 'rgba(88,166,255,0.1)',
                                color: '#58a6ff', cursor: autoTuning ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '800'
                            }}>
                                {autoTuning ? 'Auto-tuning...' : 'Run Auto-Tune Now'}
                            </button>
                        </div>

                        <h3 style={{ margin: '0 0 20px', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Brain size={16} color="#d2a8ff" /> AI Deception Profile Selection
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                            {Object.entries(PROFILE_CONFIG).map(([id, cfg]) => (
                                <div key={id} onClick={() => setActiveProfile(id)} style={{
                                    padding: '16px', borderRadius: '10px', cursor: 'pointer',
                                    background: activeProfile === id ? 'rgba(88,166,255,0.04)' : 'transparent',
                                    border: `1px solid ${activeProfile === id ? cfg.color : '#30363d'}`,
                                    transition: '0.2s', display: 'flex', alignItems: 'center', gap: '14px'
                                }}>
                                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${cfg.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {activeProfile === id && <div style={{ width: '7px', height: '7px', background: cfg.color, borderRadius: '50%' }} />}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: '800', color: activeProfile === id ? '#e6edf3' : '#8b949e', textTransform: 'uppercase' }}>{id}</div>
                                        <div style={{ fontSize: '11px', color: '#484f58', marginTop: '3px' }}>{cfg.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Layers size={16} color="#58a6ff" /> Active Protocols
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#010409', padding: '16px', borderRadius: '10px', border: '1px solid #21262d' }}>
                            <Switch active={protocols.credential_injection} onClick={() => toggleProtocol('credential_injection', protocols.credential_injection)} label="Credential Decoy Injection (Honeytokens in /etc/passwd, SSH)" />
                            <Switch active={protocols.honeyfile_generation} onClick={() => toggleProtocol('honeyfile_generation', protocols.honeyfile_generation)} label="Honey-File Generation (Decoy DB dumps, SSH keys, .env files)" />
                            <Switch active={protocols.ai_adaptive} onClick={() => toggleProtocol('ai_adaptive', protocols.ai_adaptive)} label="AI Adaptive Responses (Dynamic shell persona per attacker)" />
                            <Switch active={protocols.decoy_services} onClick={() => toggleProtocol('decoy_services', protocols.decoy_services)} label="Decoy Service Simulation (FTP/SMTP lures on high ports)" />
                        </div>

                        <AnimatePresence>
                            {deployMsg && (
                                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{
                                    marginTop: '16px', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '700',
                                    background: deployMsg.type === 'success' ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
                                    border: `1px solid ${deployMsg.type === 'success' ? '#3fb950' : '#f85149'}`,
                                    color: deployMsg.type === 'success' ? '#3fb950' : '#f85149',
                                    display: 'flex', alignItems: 'center', gap: '8px'
                                }}>
                                    {deployMsg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                    {deployMsg.text}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button onClick={handleDeploy} disabled={deploying} style={{
                            width: '100%', marginTop: '20px', padding: '16px', borderRadius: '10px',
                            background: deploying ? '#21262d' : 'linear-gradient(180deg, #238636, #1a6328)',
                            border: '1px solid #3fb950', color: 'white', fontWeight: '900', fontSize: '14px',
                            cursor: deploying ? 'not-allowed' : 'pointer', letterSpacing: '1px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                        }}>
                            {deploying ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Deploying Deception Stack...</> : <><Play size={16} /> DEPLOY DECEPTION STACK</>}
                        </button>
                    </div>

                    {/* Tactic Distribution */}
                    <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '12px', padding: '24px' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Target size={16} color="#f85149" /> Adversary Tactic Distribution
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {Object.entries(status?.tactic_distribution || {}).sort((a, b) => b[1] - a[1]).map(([tactic, count], i) => {
                                const total = Object.values(status?.tactic_distribution || {}).reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                const colors = ['#f85149', '#d29922', '#58a6ff', '#3fb950', '#d2a8ff', '#79c0ff', '#ffa657'];
                                return (
                                    <div key={tactic}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                            <span style={{ color: colors[i % colors.length] }}>{tactic}</span>
                                            <span style={{ color: '#8b949e' }}>{count} events ({pct}%)</span>
                                        </div>
                                        <div style={{ background: '#161b22', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
                                                style={{ height: '100%', background: colors[i % colors.length], borderRadius: '4px' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ marginTop: '24px', padding: '14px', background: '#010409', border: '1px solid #21262d', borderRadius: '10px' }}>
                            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '6px' }}>LAST ACTIVITY</div>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: '#e6edf3' }}>
                                {status?.last_activity ? new Date(status.last_activity).toLocaleString() : 'No activity yet'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '8px' }}>
                                Profile: <span style={{ color: PROFILE_CONFIG[activeProfile]?.color, fontWeight: '800' }}>{activeProfile.toUpperCase()}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>
                                Auto-Mode: <span style={{ color: autoMode ? '#3fb950' : '#d29922', fontWeight: '800' }}>{autoMode ? 'ON' : 'OFF'}</span>
                      {' '}- Dynamic Index: <span style={{ color: '#58a6ff', fontWeight: '800' }}>{p.dynamic_index ?? 0}</span>
                            </div>
                        </div>

                        <div style={{ marginTop: '16px', padding: '14px', background: '#010409', border: '1px solid #21262d', borderRadius: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <Server size={14} color="#58a6ff" />
                                <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                    Protocol Runtime Health
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '12px' }}>
                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '8px' }}>
                                    <div style={{ color: '#8b949e', fontSize: '10px' }}>Registered</div>
                                    <div style={{ color: '#e6edf3', fontWeight: '800', fontSize: '14px' }}>{runtimeSummary.registered ?? runtimeModules.length}</div>
                                </div>
                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '8px' }}>
                                    <div style={{ color: '#8b949e', fontSize: '10px' }}>Enabled</div>
                                    <div style={{ color: '#3fb950', fontWeight: '800', fontSize: '14px' }}>{runtimeSummary.enabled ?? 0}</div>
                                </div>
                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '8px' }}>
                                    <div style={{ color: '#8b949e', fontSize: '10px' }}>Running</div>
                                    <div style={{ color: '#58a6ff', fontWeight: '800', fontSize: '14px' }}>{runtimeSummary.running ?? 0}</div>
                                </div>
                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '8px' }}>
                                    <div style={{ color: '#8b949e', fontSize: '10px' }}>Alerts</div>
                                    <div style={{ color: runtimeAlertCount > 0 ? '#f85149' : '#3fb950', fontWeight: '800', fontSize: '14px' }}>{runtimeAlertCount}</div>
                                </div>
                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '8px' }}>
                                    <div style={{ color: '#8b949e', fontSize: '10px' }}>Max P95 ms</div>
                                    <div style={{ color: runtimeMaxP95 > 1200 ? '#f85149' : '#58a6ff', fontWeight: '800', fontSize: '14px' }}>{Math.round(runtimeMaxP95)}</div>
                                </div>
                            </div>

                            {runtimeModules.length === 0 ? (
                                <div style={{ fontSize: '12px', color: '#8b949e' }}>Runtime status unavailable.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {runtimeModules.map(([name, module]) => {
                                        const isBusy = Boolean(runtimeToggleBusy[name]);
                                        const healthyColor = module?.healthy ? '#3fb950' : '#f85149';
                                        return (
                                            <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', border: '1px solid #30363d', background: '#0d1117', borderRadius: '8px', padding: '8px 10px' }}>
                                                <div>
                                                    <div style={{ fontSize: '12px', color: '#e6edf3', fontWeight: '700', textTransform: 'uppercase' }}>{name}</div>
                                                    <div style={{ fontSize: '10px', color: '#8b949e' }}>
                        {module?.host}:{module?.port} - sessions {module?.active_sessions ?? 0}
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: '#8b949e' }}>
                        p95 {Math.round(Number(runtimeMetrics?.[name]?.p95_latency_ms || 0))} ms - errs {runtimeMetrics?.[name]?.errors_total ?? 0}
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: healthyColor, fontWeight: '700' }}>
                                                        {module?.healthy ? 'HEALTHY' : 'UNHEALTHY'}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRuntimeModuleToggle(name, Boolean(module?.enabled))}
                                                    disabled={isBusy}
                                                    style={{
                                                        minWidth: '74px',
                                                        borderRadius: '6px',
                                                        border: `1px solid ${module?.enabled ? '#f8514950' : '#3fb95050'}`,
                                                        background: module?.enabled ? 'rgba(248,81,73,0.08)' : 'rgba(63,185,80,0.08)',
                                                        color: module?.enabled ? '#f85149' : '#3fb950',
                                                        fontSize: '11px',
                                                        fontWeight: '800',
                                                        padding: '6px 8px',
                                                        cursor: isBusy ? 'not-allowed' : 'pointer'
                                                    }}
                                                >
                                                    {isBusy ? '...' : module?.enabled ? 'DISABLE' : 'ENABLE'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div style={{ marginTop: '10px', fontSize: '10px', color: '#8b949e' }}>
                                State file: <code style={{ color: '#79c0ff' }}>{runtimePersistence.state_file || 'N/A'}</code>
                      {' '}- Loaded: <span style={{ color: runtimePersistence.state_loaded ? '#3fb950' : '#d29922' }}>{runtimePersistence.state_loaded ? 'YES' : 'NO'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab: Honeytokens */}
            {activeTab === 'honeytokens' && (
                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '15px', fontWeight: '700' }}>HTTP Trap Tokens</div>
                <div style={{ fontSize: '12px', color: '#8b949e' }}>Real URLs from database - triggered by actual attacker requests</div>
                        </div>
                        <span style={{ background: 'rgba(248,81,73,0.1)', color: '#f85149', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800', border: '1px solid #f8514930' }}>
                            {honeytokens.filter(t => t.status === 'TRIGGERED').length} TRIGGERED
                        </span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#161b22', color: '#8b949e', fontSize: '11px', textTransform: 'uppercase' }}>
                                {['Trap URL', 'Status', 'Hits', 'Unique Attackers', 'Severity', 'Last Triggered'].map(h => (
                                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {honeytokens.map((t, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #21262d' }}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <code style={{ color: '#79c0ff', background: '#161b22', padding: '2px 8px', borderRadius: '4px', fontSize: '13px' }}>{t.path}</code>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: '10px', fontSize: '10px', fontWeight: '800',
                                            background: t.status === 'TRIGGERED' ? 'rgba(248,81,73,0.1)' : 'rgba(63,185,80,0.08)',
                                            color: t.status === 'TRIGGERED' ? '#f85149' : '#3fb950',
                                            border: `1px solid ${t.status === 'TRIGGERED' ? '#f8514930' : '#3fb95030'}`
                                        }}>{t.status}</span>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontWeight: '700', color: t.hits > 0 ? '#f85149' : '#484f58' }}>{t.hits}</td>
                                    <td style={{ padding: '12px 16px', color: '#8b949e' }}>{t.unique_attackers}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{ color: SEVERITY_COLORS[t.severity] || '#8b949e', fontWeight: '800', fontSize: '11px' }}>
                                            {(t.severity || 'N/A').toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', color: '#8b949e', fontSize: '12px' }}>
                          {t.last_hit ? new Date(t.last_hit).toLocaleString() : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Tab: Canary Tokens */}
            {activeTab === 'canary-tokens' && (
                <div>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                        <input
                            value={newTokenLabel}
                            onChange={e => setNewTokenLabel(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleGenerateCanary()}
                            placeholder="Canary label (e.g. 'AWS Credentials Doc', 'DB Password File')"
                            style={{ flex: 1, background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
                        />
                        <button onClick={handleGenerateCanary} disabled={generating || !newTokenLabel.trim()} style={{
                            background: 'linear-gradient(180deg, #238636, #1a6328)', border: '1px solid #3fb950',
                            color: 'white', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px',
                            display: 'flex', alignItems: 'center', gap: '8px', opacity: generating ? 0.7 : 1
                        }}>
                            <Crosshair size={14} /> {generating ? 'Generating...' : 'Generate Canary URL'}
                        </button>
                    </div>
                    <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', color: '#8b949e', fontSize: '12px' }}>
                        <AlertCircle size={13} style={{ color: '#d29922', marginRight: '8px', verticalAlign: 'middle' }} />
                        <strong style={{ color: '#d29922' }}>How it works:</strong> Generate unique URLs and embed them in decoy documents, emails, or config files. When an attacker accesses the URL, you get an alert with their IP, User-Agent, and timestamp.
                    </div>
                    {canaryTokens.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: '#484f58' }}>
                            <Crosshair size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
                            <div>No canary tokens generated yet.</div>
                            <div style={{ fontSize: '12px', marginTop: '4px' }}>Create one above to start canary tracking.</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {canaryTokens.map((t, i) => (
                                <div key={i} style={{
                                    background: '#0d1117', border: `1px solid ${t.triggered ? '#f8514940' : '#30363d'}`,
                                    borderRadius: '10px', padding: '16px 20px',
                                    display: 'flex', alignItems: 'center', gap: '16px'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>{t.label}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <code style={{ color: '#58a6ff', fontSize: '12px', background: '#161b22', padding: '3px 8px', borderRadius: '4px' }}>{t.url}</code>
                                            <button onClick={() => navigator.clipboard.writeText(t.url)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b949e' }}>
                                                <Copy size={13} />
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{
                                            padding: '4px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: '800',
                                            background: t.triggered ? 'rgba(248,81,73,0.1)' : 'rgba(63,185,80,0.08)',
                                            color: t.triggered ? '#f85149' : '#3fb950',
                                            border: `1px solid ${t.triggered ? '#f8514930' : '#3fb95030'}`
                                        }}>
                          {t.triggered ? '[TRIGGERED]' : '[ARMED]'}
                                        </span>
                                        {t.triggered_by && (
                                            <div style={{ marginTop: '6px', fontSize: '11px', color: '#8b949e' }}>
                          by {t.triggered_by.ip} - {new Date(t.triggered_by.time).toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Tab: Live Feed */}
            {activeTab === 'live-feed' && (
                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '8px', height: '8px', background: '#f85149', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
                        <div style={{ fontWeight: '700' }}>LIVE DECEPTION EVENT FEED</div>
            <div style={{ fontSize: '12px', color: '#8b949e', marginLeft: 'auto' }}>Auto-refreshes every 15s - WebSocket connected</div>
                    </div>
                    {liveFeed.map((event, i) => (
                        <div key={i} style={{ padding: '14px 20px', borderBottom: '1px solid #21262d', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                            <div style={{ marginTop: '2px' }}>
                                {event.severity === 'high' ? <AlertTriangle size={14} color="#f85149" /> : event.event_type === 'canary_trigger' ? <Crosshair size={14} color="#d2a8ff" /> : <Zap size={14} color="#58a6ff" />}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: '700', fontSize: '13px', color: '#e6edf3' }}>{event.ip || 'N/A'}</span>
                                    {event.geo && <span style={{ fontSize: '11px', color: '#8b949e' }}>{event.geo}</span>}
                                    {event.tactic && <span style={{ fontSize: '11px', background: 'rgba(88,166,255,0.1)', color: '#58a6ff', padding: '1px 8px', borderRadius: '10px', border: '1px solid #58a6ff20' }}>{event.tactic}</span>}
                                    <span style={{
                                        fontSize: '11px', padding: '1px 8px', borderRadius: '10px', fontWeight: '800',
                                        background: event.severity === 'high' ? 'rgba(248,81,73,0.1)' : event.severity === 'medium' ? 'rgba(210,153,34,0.1)' : 'rgba(63,185,80,0.1)',
                                        color: SEVERITY_COLORS[event.severity] || '#8b949e',
                                        border: `1px solid ${SEVERITY_COLORS[event.severity] || '#8b949e'}30`
                                    }}>{(event.severity || 'low').toUpperCase()}</span>
                                </div>
                                <code style={{ fontSize: '12px', color: '#a5d6ff', background: '#161b22', padding: '2px 8px', borderRadius: '4px' }}>
                                    {event.url_path || event.cmd || 'System Event'}
                                </code>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#484f58', fontSize: '11px' }}>
                                <Clock size={10} /> {new Date(event.ts).toLocaleTimeString()}
                            </div>
                        </div>
                    ))}
                    {liveFeed.length === 0 && (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#484f58' }}>
                            <Activity size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                            <div>No deception events captured yet.</div>
                            <div style={{ fontSize: '12px', marginTop: '4px' }}>Try accessing a honeypot endpoint to trigger an event.</div>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
            `}</style>
        </div>
    );
};

export default DeceptionConfig;


