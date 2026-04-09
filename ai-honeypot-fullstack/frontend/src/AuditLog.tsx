import React, { useDeferredValue, useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE, WS_BASE } from './apiConfig';
import { Shield, AlertTriangle, Download, Search, FileText, Activity } from 'lucide-react';
import { isSyntheticEvent } from './utils/eventUtils';
import { createManagedWebSocket, safeParseJson } from './utils/realtime';

type AuditLogSource = 'all' | 'incident' | 'response' | 'operator';
type AuditLogSeverity = 'all' | 'low' | 'medium' | 'high';

type AuditLogEvent = {
    id?: string | number;
    ts?: string | number | null;
    timestamp_utc?: string | number | null;
    timestamp?: string | number | null;
    cmd?: string;
    ip?: string;
    deception_mode?: string;
    severity?: string;
    risk_score?: number;
    event_type?: string | null;
    session_id?: string | null;
    ua?: string | null;
    source?: string;
    action?: string | null;
    actor_username?: string | null;
    target_type?: string | null;
    target_id?: string | number | null;
};

const AUDIT_LIMIT = 150;

function buildAuditParams(search: string, severity: AuditLogSeverity, source: AuditLogSource) {
    const params: Record<string, string | number | boolean> = {
        include_training: false,
        limit: AUDIT_LIMIT,
    };

    if (search.trim()) {
        params.search = search.trim();
    }
    if (severity !== 'all') {
        params.severity = severity;
    }
    if (source !== 'all') {
        params.source = source;
    }
    return params;
}

function normalizeAuditLogEvent(log: AuditLogEvent): AuditLogEvent {
    return {
        ...log,
        source: String(log.source || 'incident').toLowerCase(),
    };
}

function getLogKey(log: AuditLogEvent) {
    return String(
        log.id ??
            `${log.ts || log.timestamp_utc || log.timestamp || ''}|${log.session_id || ''}|${log.cmd || ''}|${log.ip || ''}|${log.source || ''}`
    );
}

function matchesAuditFilters(
    log: AuditLogEvent,
    search: string,
    severity: AuditLogSeverity,
    source: AuditLogSource
) {
    const normalizedSource = String(log.source || 'incident').toLowerCase();
    if (source !== 'all' && normalizedSource !== source) {
        return false;
    }

    const normalizedSeverity = String(log.severity || '').toLowerCase();
    if (severity !== 'all' && normalizedSeverity !== severity) {
        return false;
    }

    const query = search.trim().toLowerCase();
    if (!query) {
        return true;
    }

    return [
        log.cmd,
        log.ip,
        log.deception_mode,
        log.source,
        log.action,
        log.actor_username,
        log.target_type,
        log.target_id,
    ].some((value) => String(value || '').toLowerCase().includes(query));
}

function formatTimestamp(log: AuditLogEvent) {
    const raw = log.ts || log.timestamp_utc || log.timestamp;
    const date = raw ? new Date(raw) : null;
    if (!date || Number.isNaN(date.getTime())) {
        return 'N/A';
    }
    return date.toLocaleString();
}

function getSourcePalette(source?: string) {
    switch (String(source || 'incident').toLowerCase()) {
        case 'operator':
            return { label: 'Operator', fg: '#f2cc60', bg: 'rgba(242, 204, 96, 0.12)', border: 'rgba(242, 204, 96, 0.35)' };
        case 'response':
            return { label: 'Response', fg: '#ff7b72', bg: 'rgba(248, 81, 73, 0.12)', border: 'rgba(248, 81, 73, 0.35)' };
        default:
            return { label: 'Incident', fg: '#58a6ff', bg: 'rgba(88, 166, 255, 0.12)', border: 'rgba(88, 166, 255, 0.35)' };
    }
}

const AuditLog = () => {
    const [logs, setLogs] = useState<AuditLogEvent[]>([]);
    const [filter, setFilter] = useState<string>('');
    const [severityFilter, setSeverityFilter] = useState<AuditLogSeverity>('all');
    const [sourceFilter, setSourceFilter] = useState<AuditLogSource>('all');
    const [loading, setLoading] = useState<boolean>(true);
    const [exporting, setExporting] = useState<boolean>(false);
    const deferredFilter = useDeferredValue(filter);

    useEffect(() => {
        let cancelled = false;

        const fetchLogs = async () => {
            setLoading(true);
            try {
                const res = await axios.get<AuditLogEvent[]>(`${API_BASE}/audit/logs`, {
                    params: buildAuditParams(deferredFilter, severityFilter, sourceFilter),
                });
                if (!cancelled) {
                    setLogs(res.data.map(normalizeAuditLogEvent));
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to fetch audit logs', err);
                    setLogs([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void fetchLogs();
        return () => {
            cancelled = true;
        };
    }, [deferredFilter, severityFilter, sourceFilter]);

    useEffect(() => {
        const ws = createManagedWebSocket(
            `${WS_BASE}/ws/incidents`,
            {
                onMessage: (event) => {
                    const payload = typeof event.data === 'string' ? safeParseJson<AuditLogEvent>(event.data) : null;
                    if (!payload || isSyntheticEvent(payload)) return;

                    const normalized = normalizeAuditLogEvent(payload);
                    if (!matchesAuditFilters(normalized, deferredFilter, severityFilter, sourceFilter)) {
                        return;
                    }

                    setLogs((prev) => {
                        const nextKey = getLogKey(normalized);
                        if (prev.some((entry) => getLogKey(entry) === nextKey)) {
                            return prev;
                        }
                        return [normalized, ...prev].slice(0, AUDIT_LIMIT);
                    });
                },
                onError: (err) => console.error('WS Audit Flow Error', err),
            },
            { reconnect: true }
        );

        return () => ws.close();
    }, [deferredFilter, severityFilter, sourceFilter]);

    const downloadExport = async () => {
        setExporting(true);
        try {
            const res = await axios.get(`${API_BASE}/audit/logs`, {
                params: {
                    ...buildAuditParams(deferredFilter, severityFilter, sourceFilter),
                    format: 'csv',
                },
                responseType: 'blob',
            });

            const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'cybersentinel-audit-logs.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to export audit logs', err);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="premium-scroll" style={{ color: '#e6edf3', padding: '40px 60px', fontFamily: "'Roboto', sans-serif" }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px', gap: '24px', flexWrap: 'wrap' }}>
                <div>
                    <h1 className="text-gradient-red" style={{ margin: 0, fontSize: '2.8rem', fontWeight: '950', letterSpacing: '-1.5px' }}>
                        SYSTEM_AUDIT_LOGS
                    </h1>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '10px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '11px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Shield size={14} color="#f85149" /> SECURITY MONITORING
                        </div>
                        <div style={{ fontSize: '11px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileText size={14} color="#58a6ff" /> INCIDENTS, RESPONSE EVENTS, AND OPERATOR ACTIONS
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div className="premium-glass" style={{ padding: '10px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(48,54,61,0.5)' }}>
                        <Activity size={14} color="#3fb950" className="animate-pulse" />
                        <span style={{ fontSize: '11px', color: '#3fb950', fontWeight: '950', letterSpacing: '1px' }}>{logs.length} ENTRIES</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            void downloadExport();
                        }}
                        disabled={exporting || loading}
                        className="premium-glass card-hover-translate"
                        style={{
                            border: '1px solid rgba(88,166,255,0.2)',
                            color: exporting ? '#8b949e' : '#58a6ff',
                            padding: '10px 20px',
                            borderRadius: '12px',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: exporting || loading ? 'not-allowed' : 'pointer',
                            fontWeight: '800',
                            background: 'transparent',
                            transition: '0.3s',
                            opacity: exporting || loading ? 0.7 : 1,
                        }}
                    >
                        <Download size={16} /> {exporting ? 'Exporting...' : 'Export Logs'}
                    </button>
                </div>
            </header>

            <div className="premium-glass" style={{ borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid rgba(48,54,61,0.5)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 280px', position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e' }} />
                        <input
                            type="text"
                            placeholder="Search by action, IP, operator, or target..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(1,4,9,0.4)',
                                border: '1px solid rgba(48,54,61,0.5)',
                                borderRadius: '12px',
                                padding: '10px 10px 10px 40px',
                                color: '#e6edf3',
                                fontSize: '13px',
                                outline: 'none',
                                fontFamily: "'Roboto', sans-serif",
                            }}
                        />
                    </div>
                    <select
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value as AuditLogSource)}
                        style={{
                            minWidth: '180px',
                            background: 'rgba(1,4,9,0.4)',
                            border: '1px solid rgba(48,54,61,0.5)',
                            borderRadius: '12px',
                            padding: '10px 12px',
                            color: '#e6edf3',
                            fontSize: '13px',
                            outline: 'none',
                        }}
                    >
                        <option value="all">All Sources</option>
                        <option value="incident">Incident Events</option>
                        <option value="response">Response Actions</option>
                        <option value="operator">Operator Actions</option>
                    </select>
                    <select
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value as AuditLogSeverity)}
                        style={{
                            minWidth: '160px',
                            background: 'rgba(1,4,9,0.4)',
                            border: '1px solid rgba(48,54,61,0.5)',
                            borderRadius: '12px',
                            padding: '10px 12px',
                            color: '#e6edf3',
                            fontSize: '13px',
                            outline: 'none',
                        }}
                    >
                        <option value="all">All Severities</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: 'rgba(22, 27, 34, 0.5)', color: '#8b949e', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                <th style={{ padding: '16px 20px', fontWeight: '800' }}>Timestamp</th>
                                <th style={{ padding: '16px 20px', fontWeight: '800' }}>Event Source</th>
                                <th style={{ padding: '16px 20px', fontWeight: '800' }}>Action / Command</th>
                                <th style={{ padding: '16px 20px', fontWeight: '800' }}>Deception Mode</th>
                                <th style={{ padding: '16px 20px', fontWeight: '800' }}>Risk</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => {
                                const riskScore = Number(log.risk_score || 0);
                                const sourcePalette = getSourcePalette(log.source);
                                return (
                                    <tr key={getLogKey(log)} style={{ borderBottom: '1px solid rgba(48,54,61,0.3)', fontSize: '13px', transition: '0.2s' }}>
                                        <td style={{ padding: '16px 20px', color: '#8b949e', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', whiteSpace: 'nowrap' }}>
                                            {formatTimestamp(log)}
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    <div
                                                        style={{
                                                            width: '8px',
                                                            height: '8px',
                                                            borderRadius: '50%',
                                                            background: log.severity === 'high' ? '#f85149' : log.severity === 'medium' ? '#f2cc60' : '#3fb950',
                                                            boxShadow: `0 0 6px ${log.severity === 'high' ? '#f85149' : log.severity === 'medium' ? '#f2cc60' : '#3fb950'}`,
                                                        }}
                                                    />
                                                    <span style={{ fontWeight: '700' }}>{log.ip || log.actor_username || 'Internal Workflow'}</span>
                                                    <span
                                                        style={{
                                                            fontSize: '10px',
                                                            fontWeight: '900',
                                                            letterSpacing: '0.6px',
                                                            padding: '3px 9px',
                                                            borderRadius: '999px',
                                                            color: sourcePalette.fg,
                                                            background: sourcePalette.bg,
                                                            border: `1px solid ${sourcePalette.border}`,
                                                        }}
                                                    >
                                                        {sourcePalette.label}
                                                    </span>
                                                </div>
                                                {log.actor_username && (
                                                    <div style={{ fontSize: '11px', color: '#8b949e' }}>
                                                        Actor: <span style={{ color: '#c9d1d9' }}>{log.actor_username}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <code style={{ background: 'rgba(22,27,34,0.6)', padding: '4px 10px', borderRadius: '8px', color: '#a5d6ff', fontSize: '12px', border: '1px solid rgba(48,54,61,0.3)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                    {log.cmd || 'System Init'}
                                                </code>
                                                {(log.action || log.target_type || log.target_id) && (
                                                    <div style={{ fontSize: '11px', color: '#8b949e' }}>
                                                        {[log.action, log.target_type, log.target_id].filter(Boolean).join(' / ')}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <span
                                                style={{
                                                    fontSize: '10px',
                                                    fontWeight: '950',
                                                    padding: '3px 10px',
                                                    borderRadius: '20px',
                                                    letterSpacing: '0.5px',
                                                    background: log.deception_mode === 'ENTRAPMENT' ? 'rgba(248,81,73,0.1)' : 'rgba(88,166,255,0.1)',
                                                    color: log.deception_mode === 'ENTRAPMENT' ? '#f85149' : '#58a6ff',
                                                    border: `1px solid ${log.deception_mode === 'ENTRAPMENT' ? '#f8514930' : '#58a6ff30'}`,
                                                }}
                                            >
                                                {log.deception_mode || 'UNKNOWN'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 20px', color: riskScore > 70 ? '#f85149' : '#e6edf3', fontWeight: '900', fontSize: '14px' }}>
                                            {riskScore.toFixed(1)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {loading && (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#8b949e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                            <Activity size={18} className="animate-pulse" /> Loading audit logs...
                        </div>
                    )}
                    {!loading && logs.length === 0 && (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#484f58' }}>
                            <AlertTriangle size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                            <div style={{ fontSize: '14px', fontWeight: '700' }}>No matching audit entries found.</div>
                            <div style={{ fontSize: '12px', marginTop: '4px' }}>Adjust the search, source, or severity filters and try again.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuditLog;
