import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { API_BASE } from './apiConfig';
import { motion, AnimatePresence } from './utils/motionLite';
import {
    Globe, Search, Shield, AlertTriangle, CheckCircle, XCircle, Wifi,
    ExternalLink, Zap, Activity, Lock, Eye, Clock, BarChart3,
    AlertCircle, Database, Copy, RefreshCw, Link2
} from 'lucide-react';

const SCAN_HISTORY_KEY = 'urlScanHistory';
const DEFAULT_QUICK_ACCESS_URLS = ['https://example.com', 'https://openai.com', 'https://github.com'];

type ScanIoc = {
    type?: string;
    value?: string;
    note?: string;
};

type ScanScores = {
    phishing_probability?: number;
    malware_probability?: number;
    legitimacy_score?: number;
};

type ScanResult = {
    url: string;
    risk_score: number;
    domain?: string;
    ip?: string;
    country?: string;
    registrar?: string;
    domain_age?: string;
    http_status?: number | string;
    redirect_count?: number;
    content_type?: string;
    is_phishing?: boolean;
    has_malware?: boolean;
    is_safe?: boolean;
    has_ssl?: boolean;
    ai_scores?: ScanScores;
    ai_analysis?: string;
    security_headers?: Record<string, string | undefined>;
    iocs?: ScanIoc[];
};

type ScanHistoryEntry = {
    url: string;
    result: ScanResult;
    ts: string;
};

type UrlScanErrorResponse = {
    detail?: string;
};

type UrlScannerTab = 'overview' | 'ai_analysis' | 'headers' | 'iocs';

const UrlScanner = () => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [error, setError] = useState('');
    const [history, setHistory] = useState<ScanHistoryEntry[]>(() => {
        try {
            const parsed = JSON.parse(localStorage.getItem(SCAN_HISTORY_KEY) || '[]');
            return Array.isArray(parsed) ? parsed as ScanHistoryEntry[] : [];
        } catch {
            return [];
        }
    });
    const [activeTab, setActiveTab] = useState<UrlScannerTab>('overview');
    const [copied, setCopied] = useState(false);

    const saveToHistory = (urlToStore: string, scanResult: ScanResult) => {
        const entry: ScanHistoryEntry = { url: urlToStore, result: scanResult, ts: new Date().toISOString() };
        const updated = [entry, ...history].slice(0, 20);
        setHistory(updated);
        localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated));
    };

    const handleScan = async () => {
        const trimmed = url.trim();
        if (!trimmed) return;
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const res = await axios.post<ScanResult>(`${API_BASE}/intel/url-scan`, { url: trimmed });
            setResult(res.data);
            saveToHistory(trimmed, res.data);
            setActiveTab('overview');
        } catch (e) {
            const message = axios.isAxiosError<UrlScanErrorResponse>(e)
                ? e.response?.data?.detail || e.message
                : e instanceof Error
                    ? e.message
                    : 'Scan failed. Backend may be unreachable.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const copyReport = () => {
        if (result) {
            void navigator.clipboard.writeText(JSON.stringify(result, null, 2));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const getRiskColor = (score: number) => {
        if (score >= 75) return '#f85149';
        if (score >= 45) return '#d29922';
        if (score >= 20) return '#e3b341';
        return '#3fb950';
    };

    const getRiskLabel = (score: number) => {
        if (score >= 75) return 'CRITICAL';
        if (score >= 45) return 'HIGH';
        if (score >= 20) return 'MEDIUM';
        return 'SAFE';
    };

    const tabs: UrlScannerTab[] = ['overview', 'ai_analysis', 'headers', 'iocs'];
    const quickAccessUrls = useMemo(() => {
        const uniqueRecent: string[] = [];
        for (const item of history) {
            const candidate = String(item?.url || '').trim();
            if (!candidate || uniqueRecent.includes(candidate)) continue;
            uniqueRecent.push(candidate);
            if (uniqueRecent.length >= 4) break;
        }
        return uniqueRecent.length > 0 ? uniqueRecent : DEFAULT_QUICK_ACCESS_URLS;
    }, [history]);

    return (
        <div style={{ padding: '40px 60px', color: '#e6edf3', fontFamily: "'Roboto', sans-serif", minHeight: '100vh', background: '#010409' }}>
            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}
            >
                <div>
                    <h1 style={{
                        margin: 0, fontSize: '2.5rem', fontWeight: '900',
                        background: 'linear-gradient(135deg, #58a6ff, #d2a8ff)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                    }}>
                        URL_INTELLIGENCE_SCANNER
                    </h1>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                        <div style={{ fontSize: '11px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Globe size={14} color="#58a6ff" /> DEEP WEB THREAT ANALYSIS
                        </div>
                        <div style={{ fontSize: '11px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Zap size={14} color="#d2a8ff" /> AI PHISHING DETECTION
                        </div>
                        <div style={{ fontSize: '11px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Shield size={14} color="#3fb950" /> MALWARE FINGERPRINTING
                        </div>
                    </div>
                </div>
                <div style={{ padding: '8px 20px', background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.3)', borderRadius: '24px', color: '#58a6ff', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={14} />
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3fb950', animation: 'blink 2s infinite' }} />
                    SCANNER ONLINE
                </div>
            </motion.header>

            {/* Search Bar */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{ marginBottom: '40px', background: 'rgba(22,27,34,0.8)', border: '1px solid #30363d', borderRadius: '24px', padding: '32px', backdropFilter: 'blur(10px)' }}
            >
                <div style={{ marginBottom: '16px', fontSize: '12px', color: '#8b949e', fontWeight: '800', letterSpacing: '1px' }}>
                    ENTER TARGET URL FOR ANALYSIS
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#0d1117', border: '1px solid #30363d', borderRadius: '14px', padding: '0 20px', gap: '12px' }}>
                        <Link2 size={18} color="#58a6ff" />
                        <input
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleScan()}
                            placeholder="https://example.com or http://suspicious-site.xyz/malware"
                            style={{
                                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                                color: '#e6edf3', fontSize: '15px', padding: '18px 0',
                                fontFamily: 'monospace', fontWeight: '600'
                            }}
                        />
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleScan}
                        disabled={loading}
                        style={{
                            padding: '18px 36px', background: loading ? '#21262d' : 'linear-gradient(135deg, #1f6feb, #388bfd)',
                            border: 'none', borderRadius: '14px', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                            fontWeight: '900', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px',
                            whiteSpace: 'nowrap', letterSpacing: '0.5px'
                        }}
                    >
                        {loading ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={18} />}
                        {loading ? 'SCANNING...' : 'DEEP SCAN'}
                    </motion.button>
                </div>

                {/* Quick access badges */}
                <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {quickAccessUrls.map(q => (
                        <button key={q} onClick={() => setUrl(q)} style={{
                            background: 'rgba(88,166,255,0.05)', border: '1px solid #30363d', color: '#8b949e',
                            borderRadius: '8px', padding: '6px 14px', fontSize: '11px', cursor: 'pointer',
                            fontFamily: 'monospace', transition: '0.2s'
                        }}>
                            {q}
                        </button>
                    ))}
                </div>
            </motion.div>

            {error && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ marginBottom: '24px', padding: '20px 24px', background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: '16px', display: 'flex', gap: '12px', alignItems: 'center', color: '#f85149' }}
                >
                    <AlertCircle size={20} /> {error}
                </motion.div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '32px' }}>
                {/* Main Result Area */}
                <div>
                    <AnimatePresence mode="wait">
                        {loading && (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{ background: 'rgba(22,27,34,0.8)', border: '1px solid #30363d', borderRadius: '24px', padding: '80px 40px', textAlign: 'center' }}
                            >
              <div style={{ fontSize: '40px', marginBottom: '24px' }}>SCAN</div>
                                <div style={{ fontSize: '18px', fontWeight: '900', marginBottom: '12px', background: 'linear-gradient(135deg, #58a6ff, #d2a8ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                    NEURAL SCAN IN PROGRESS
                                </div>
                                <div style={{ color: '#8b949e', fontSize: '13px', marginBottom: '32px' }}>Analyzing DNS, headers, content, and AI threat patterns...</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px', margin: '0 auto' }}>
                                    {['Resolving DNS & WHOIS', 'Fingerprinting SSL Certificate', 'Analyzing HTTP Headers', 'Running AI Phishing Model', 'Cross-referencing IOCs'].map((step, i) => (
                                        <motion.div key={step} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.3 }}
                                            style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '12px', color: '#58a6ff', fontFamily: 'monospace' }}
                                        >
                                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: '12px', height: '12px', border: '1px solid #58a6ff', borderTopColor: 'transparent', borderRadius: '50%' }} />
                                            {step}
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {result && !loading && (
                            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                                {/* Risk Score Banner */}
                                <div style={{
                                    background: `linear-gradient(135deg, rgba(${result.risk_score >= 75 ? '248,81,73' : result.risk_score >= 45 ? '210,153,34' : '63,185,80'},0.08), rgba(22,27,34,0.8))`,
                                    border: `1px solid ${getRiskColor(result.risk_score)}40`,
                                    borderRadius: '24px', padding: '32px', marginBottom: '24px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: `${getRiskColor(result.risk_score)}20`, border: `3px solid ${getRiskColor(result.risk_score)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', boxShadow: `0 0 30px ${getRiskColor(result.risk_score)}40` }}>
                                            <div style={{ fontSize: '24px', fontWeight: '900', color: getRiskColor(result.risk_score) }}>{result.risk_score}</div>
                                            <div style={{ fontSize: '8px', color: getRiskColor(result.risk_score) }}>RISK</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '24px', fontWeight: '900', color: getRiskColor(result.risk_score) }}>{getRiskLabel(result.risk_score)}</div>
                                            <div style={{ color: '#8b949e', fontSize: '13px', marginTop: '4px', fontFamily: 'monospace' }}>{result.url}</div>
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  {result.is_phishing && <span style={{ padding: '4px 12px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: '20px', fontSize: '11px', color: '#f85149', fontWeight: '800' }}>PHISHING</span>}
                  {result.has_malware && <span style={{ padding: '4px 12px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: '20px', fontSize: '11px', color: '#f85149', fontWeight: '800' }}>MALWARE</span>}
                  {result.is_safe && <span style={{ padding: '4px 12px', background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)', borderRadius: '20px', fontSize: '11px', color: '#3fb950', fontWeight: '800' }}>SAFE</span>}
                  {result.has_ssl && <span style={{ padding: '4px 12px', background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.3)', borderRadius: '20px', fontSize: '11px', color: '#58a6ff', fontWeight: '800' }}>SSL</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={copyReport} style={{ padding: '12px 20px', background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.2)', borderRadius: '12px', color: '#58a6ff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '800' }}>
                                        <Copy size={16} /> {copied ? 'COPIED!' : 'EXPORT'}
                                    </button>
                                </div>

                                {/* Tabs */}
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                                    {tabs.map(tab => (
                                        <button key={tab} onClick={() => setActiveTab(tab)} style={{
                                            padding: '10px 20px', borderRadius: '10px', border: '1px solid',
                                            borderColor: activeTab === tab ? '#58a6ff' : '#30363d',
                                            background: activeTab === tab ? 'rgba(88,166,255,0.1)' : 'transparent',
                                            color: activeTab === tab ? '#58a6ff' : '#8b949e',
                                            cursor: 'pointer', fontWeight: '800', fontSize: '12px', letterSpacing: '0.5px',
                                            transition: '0.2s'
                                        }}>
                                            {tab.replace('_', ' ').toUpperCase()}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Content */}
                                <AnimatePresence mode="wait">
                                    <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                        {activeTab === 'overview' && (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                {[
                                                    { label: 'Domain', value: result.domain, icon: Globe },
                                                    { label: 'IP Address', value: result.ip || 'N/A', icon: Wifi },
                                                    { label: 'Country', value: result.country || 'Unknown', icon: Activity },
                                                    { label: 'Registrar', value: result.registrar || 'Unknown', icon: Database },
                                                    { label: 'Domain Age', value: result.domain_age || 'Unknown', icon: Clock },
                                                    { label: 'HTTP Status', value: result.http_status || 'N/A', icon: BarChart3 },
                                                    { label: 'Redirects', value: result.redirect_count !== undefined ? `${result.redirect_count} redirect(s)` : 'N/A', icon: ExternalLink },
                                                    { label: 'Content Type', value: result.content_type || 'N/A', icon: Eye },
                                                ].map(({ label, value, icon: Icon }) => (
                                                    <div key={label} style={{ background: 'rgba(22,27,34,0.8)', border: '1px solid #30363d', borderRadius: '16px', padding: '20px 24px', display: 'flex', gap: '14px', alignItems: 'center' }}>
                                                        <div style={{ padding: '10px', background: '#161b22', borderRadius: '10px' }}>
                                                            <Icon size={18} color="#58a6ff" />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '10px', color: '#484f58', fontWeight: '800', letterSpacing: '0.5px' }}>{label.toUpperCase()}</div>
                                                            <div style={{ fontSize: '14px', fontWeight: '700', fontFamily: 'monospace', marginTop: '4px', color: '#e6edf3' }}>{value}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {activeTab === 'ai_analysis' && (
                                            <div style={{ background: 'rgba(22,27,34,0.8)', border: '1px solid #30363d', borderRadius: '20px', padding: '32px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                                    <Zap size={20} color="#d2a8ff" />
                                                    <h3 style={{ margin: 0, fontWeight: '900', color: '#d2a8ff' }}>AI THREAT ANALYSIS</h3>
                                                </div>
                                                {/* Threat Radar */}
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
                                                    {[
                                                        { label: 'Phishing Prob.', value: result.ai_scores?.phishing_probability || 0, color: '#f85149' },
                                                        { label: 'Malware Prob.', value: result.ai_scores?.malware_probability || 0, color: '#d29922' },
                                                        { label: 'Legitimacy', value: result.ai_scores?.legitimacy_score || 0, color: '#3fb950' },
                                                    ].map(({ label, value, color }) => (
                                                        <div key={label} style={{ background: '#0d1117', borderRadius: '16px', padding: '20px', textAlign: 'center', border: '1px solid #21262d' }}>
                                                            <div style={{ fontSize: '32px', fontWeight: '900', color }}>{value}%</div>
                                                            <div style={{ fontSize: '11px', color: '#8b949e', fontWeight: '800', marginTop: '6px', letterSpacing: '0.5px' }}>{label.toUpperCase()}</div>
                                                            <div style={{ height: '4px', background: '#21262d', borderRadius: '2px', marginTop: '12px' }}>
                                                                <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: '2px', transition: '0.8s' }} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div style={{ background: '#0d1117', borderRadius: '16px', padding: '24px', border: '1px solid #21262d', lineHeight: '1.8', color: '#8b949e', fontSize: '14px', fontFamily: 'sans-serif', whiteSpace: 'pre-wrap' }}>
                                                    {result.ai_analysis || 'No AI analysis available.'}
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'headers' && (
                                            <div style={{ background: 'rgba(22,27,34,0.8)', border: '1px solid #30363d', borderRadius: '20px', padding: '32px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                                    <Lock size={20} color="#58a6ff" />
                                                    <h3 style={{ margin: 0, fontWeight: '900' }}>HTTP HEADERS & SECURITY</h3>
                                                </div>
                                                {result.security_headers && Object.keys(result.security_headers).length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        {Object.entries(result.security_headers).map(([k, v]) => (
                                                            <div key={k} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '14px 20px', background: '#0d1117', borderRadius: '12px', border: '1px solid #21262d' }}>
                                                                <CheckCircle size={16} color="#3fb950" style={{ marginTop: '2px', flexShrink: 0 }} />
                                                                <div>
                                                                    <div style={{ fontSize: '12px', color: '#58a6ff', fontFamily: 'monospace', fontWeight: '800' }}>{k}</div>
                                                                    <div style={{ fontSize: '12px', color: '#8b949e', fontFamily: 'monospace', marginTop: '4px' }}>{v || 'MISSING'}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div style={{ textAlign: 'center', color: '#484f58', padding: '40px' }}>No header data available.</div>
                                                )}
                                            </div>
                                        )}

                                        {activeTab === 'iocs' && (
                                            <div style={{ background: 'rgba(22,27,34,0.8)', border: '1px solid #30363d', borderRadius: '20px', padding: '32px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                                    <AlertTriangle size={20} color="#d29922" />
                                                    <h3 style={{ margin: 0, fontWeight: '900' }}>INDICATORS OF COMPROMISE</h3>
                                                </div>
                                                {result.iocs && result.iocs.length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        {result.iocs.map((ioc, i) => (
                                                            <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '16px 20px', background: 'rgba(248,81,73,0.04)', border: '1px solid rgba(248,81,73,0.2)', borderRadius: '12px' }}>
                                                                <XCircle size={16} color="#f85149" />
                                                                <div>
                                                                    <div style={{ fontSize: '11px', color: '#f85149', fontWeight: '800' }}>{ioc.type?.toUpperCase()}</div>
                                                                    <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#e6edf3', marginTop: '4px' }}>{ioc.value}</div>
                                                                    {ioc.note && <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '2px' }}>{ioc.note}</div>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div style={{ textAlign: 'center', color: '#3fb950', padding: '40px', fontSize: '16px', fontWeight: '700' }}>
                  No Indicators of Compromise Detected
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </motion.div>
                        )}

                        {!result && !loading && !error && (
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                style={{ background: 'rgba(22,27,34,0.5)', border: '1px dashed #30363d', borderRadius: '24px', padding: '80px 40px', textAlign: 'center' }}
                            >
                                <Globe size={60} color="#30363d" style={{ marginBottom: '24px' }} />
                                <div style={{ fontSize: '20px', fontWeight: '900', color: '#484f58', marginBottom: '12px' }}>NO TARGET SELECTED</div>
                                <div style={{ color: '#30363d', fontSize: '14px' }}>Enter a URL above to begin deep threat analysis and AI-powered scanning.</div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Sidebar: History */}
                <div>
                    <div style={{ background: 'rgba(22,27,34,0.8)', border: '1px solid #30363d', borderRadius: '24px', padding: '28px', backdropFilter: 'blur(10px)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                            <Clock size={16} color="#8b949e" />
                            <span style={{ fontSize: '12px', fontWeight: '800', color: '#8b949e', letterSpacing: '1px' }}>SCAN HISTORY</span>
                        </div>
                        {history.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#484f58', fontSize: '13px', padding: '24px 0' }}>No recent scans</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {history.map((h, i) => (
                                    <motion.div
                                        key={i}
                                        whileHover={{ x: 3 }}
                                        onClick={() => { setUrl(h.url); setResult(h.result); }}
                                        style={{ padding: '14px 16px', background: '#0d1117', borderRadius: '12px', border: '1px solid #21262d', cursor: 'pointer', transition: '0.2s' }}
                                    >
                                        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#e6edf3', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '6px' }}>
                                            {h.url}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '10px', fontWeight: '900', color: getRiskColor(h.result?.risk_score || 0) }}>
                    * {getRiskLabel(h.result?.risk_score || 0)} ({h.result?.risk_score || 0})
                                            </span>
                                            <span style={{ fontSize: '10px', color: '#484f58' }}>
                                                {new Date(h.ts).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {/* Stats Widget */}
                        <div style={{ marginTop: '24px', padding: '20px', background: 'linear-gradient(135deg, rgba(31,111,235,0.1), rgba(210,168,255,0.05))', borderRadius: '16px', border: '1px solid rgba(88,166,255,0.1)' }}>
                            <div style={{ fontSize: '10px', color: '#8b949e', fontWeight: '800', marginBottom: '16px', letterSpacing: '1px' }}>SESSION STATS</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <span style={{ color: '#8b949e' }}>Total Scans</span>
                                    <span style={{ color: '#58a6ff', fontWeight: '900' }}>{history.length}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <span style={{ color: '#8b949e' }}>Threats Found</span>
                                    <span style={{ color: '#f85149', fontWeight: '900' }}>{history.filter(h => h.result?.risk_score >= 45).length}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <span style={{ color: '#8b949e' }}>Safe Sites</span>
                                    <span style={{ color: '#3fb950', fontWeight: '900' }}>{history.filter(h => h.result?.risk_score < 20).length}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UrlScanner;


