import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE, WS_BASE } from './apiConfig';
import { Shield, AlertTriangle, Download, Search, FileText, Activity } from 'lucide-react';
import { isSyntheticEvent } from './utils/eventUtils';
import { createManagedWebSocket, safeParseJson } from './utils/realtime';

const AuditLog = () => {
    const REAL_ONLY_PARAMS = { params: { include_training: false } };
    const [logs, setLogs] = useState([]);
    const [filter, setFilter] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await axios.get(`${API_BASE}/audit/logs`, REAL_ONLY_PARAMS);
                setLogs(res.data);
            } catch (err) {
                console.error("Failed to fetch audit logs", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();

        const ws = createManagedWebSocket(
            `${WS_BASE}/ws/incidents`,
            {
                onMessage: (event) => {
                    const data = safeParseJson(event.data);
                    if (!data || isSyntheticEvent(data)) return;
                    setLogs(prev => {
                        if (prev.find(e => e.id === data.id)) return prev;
                        return [data, ...prev.slice(0, 99)];
                    });
                },
                onError: (err) => console.error("WS Audit Flow Error", err),
            },
            { reconnect: true }
        );

        return () => ws.close();
    }, []);

    const filteredLogs = logs.filter(log =>
    (log.cmd?.toLowerCase().includes(filter.toLowerCase()) ||
        log.ip?.includes(filter) ||
        log.deception_mode?.toLowerCase().includes(filter.toLowerCase()))
    );

    return (
        <div className="premium-scroll" style={{ color: '#e6edf3', padding: '40px 60px', fontFamily: "'Roboto', sans-serif" }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                <div>
                    <h1 className="text-gradient-red" style={{ margin: 0, fontSize: '2.8rem', fontWeight: '950', letterSpacing: '-1.5px' }}>
                        SYSTEM_AUDIT_LOGS
                    </h1>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                        <div style={{ fontSize: '11px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Shield size={14} color="#f85149" /> SECURITY MONITORING
                        </div>
                        <div style={{ fontSize: '11px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={14} color="#58a6ff" /> STRATEGY TRANSITIONS - ADMINISTRATIVE ACTIONS
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div className="premium-glass" style={{ padding: '10px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(48,54,61,0.5)' }}>
                        <Activity size={14} color="#3fb950" className="animate-pulse" />
                        <span style={{ fontSize: '11px', color: '#3fb950', fontWeight: '950', letterSpacing: '1px' }}>{logs.length} ENTRIES</span>
                    </div>
                    <button className="premium-glass card-hover-translate" style={{
                        border: '1px solid rgba(88,166,255,0.2)', color: '#58a6ff', padding: '10px 20px',
                        borderRadius: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
                        cursor: 'pointer', fontWeight: '800', background: 'transparent', transition: '0.3s'
                    }}>
                        <Download size={16} /> Export Logs
                    </button>
                </div>
            </header>

            <div className="premium-glass" style={{ borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid rgba(48,54,61,0.5)', display: 'flex', gap: '16px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e' }} />
                        <input
                            type="text"
                            placeholder="Search by command, IP, or deception mode..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            style={{
                                width: '100%', background: 'rgba(1,4,9,0.4)', border: '1px solid rgba(48,54,61,0.5)',
                                borderRadius: '12px', padding: '10px 10px 10px 40px', color: '#e6edf3',
                                fontSize: '13px', outline: 'none', fontFamily: "'Roboto', sans-serif"
                            }}
                        />
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: 'rgba(22, 27, 34, 0.5)', color: '#8b949e', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                <th style={{ padding: '16px 20px', fontWeight: '800' }}>Timestamp</th>
                                <th style={{ padding: '16px 20px', fontWeight: '800' }}>Event Source</th>
                                <th style={{ padding: '16px 20px', fontWeight: '800' }}>Action/Command</th>
                                <th style={{ padding: '16px 20px', fontWeight: '800' }}>Deception Mode</th>
                                <th style={{ padding: '16px 20px', fontWeight: '800' }}>Risk</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map((log, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(48,54,61,0.3)', fontSize: '13px', transition: '0.2s' }}>
                                    <td style={{ padding: '16px 20px', color: '#8b949e', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                                        {new Date(log.ts || log.timestamp_utc || log.timestamp || Date.now()).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                                width: '8px', height: '8px', borderRadius: '50%',
                                                background: log.severity === 'high' ? '#f85149' : '#3fb950',
                                                boxShadow: `0 0 6px ${log.severity === 'high' ? '#f85149' : '#3fb950'}`
                                            }}></div>
                                            <span style={{ fontWeight: '700' }}>{log.ip}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <code style={{ background: 'rgba(22,27,34,0.6)', padding: '4px 10px', borderRadius: '8px', color: '#a5d6ff', fontSize: '12px', border: '1px solid rgba(48,54,61,0.3)' }}>
                                            {log.cmd || "System Init"}
                                        </code>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <span style={{
                                            fontSize: '10px', fontWeight: '950', padding: '3px 10px', borderRadius: '20px', letterSpacing: '0.5px',
                                            background: log.deception_mode === 'ENTRAPMENT' ? 'rgba(248,81,73,0.1)' : 'rgba(88,166,255,0.1)',
                                            color: log.deception_mode === 'ENTRAPMENT' ? '#f85149' : '#58a6ff',
                                            border: `1px solid ${log.deception_mode === 'ENTRAPMENT' ? '#f8514930' : '#58a6ff30'}`
                                        }}>
                                            {log.deception_mode}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 20px', color: log.risk_score > 70 ? '#f85149' : '#e6edf3', fontWeight: '900', fontSize: '14px' }}>
                                        {log.risk_score ? log.risk_score.toFixed(1) : "0.0"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {loading && (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#8b949e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                            <Activity size={18} className="animate-pulse" /> Loading incident logs...
                        </div>
                    )}
                    {!loading && filteredLogs.length === 0 && (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#484f58' }}>
                            <AlertTriangle size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                            <div style={{ fontSize: '14px', fontWeight: '700' }}>No matching audit entries found.</div>
                            <div style={{ fontSize: '12px', marginTop: '4px' }}>Try adjusting your search query above.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuditLog;


