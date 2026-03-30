// @ts-nocheck
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE, WS_BASE } from './apiConfig';
import { Search, Zap, Target, Shield, Lock, Crosshair, Activity, Globe, ChevronRight, CheckCircle, AlertCircle, Layers } from 'lucide-react';
import { isSyntheticEvent } from './utils/eventUtils';
import { createManagedWebSocket, safeParseJson } from './utils/realtime';

const MitreMapping = () => {
    const REAL_ONLY_PARAMS = { params: { include_training: false } };
    const [tactics, setTactics] = useState([
        { id: 'TA0001', name: 'Reconnaissance', icon: <Search size={24} />, description: 'Information gathering for target selection.', techniques: ['Active Scanning', 'Search Victim-Owned Websites'], active: false },
        { id: 'TA0002', name: 'Initial Access', icon: <Zap size={24} />, description: 'Vectors used to gain a foothold.', techniques: ['Exploit Public-Facing Application', 'Valid Accounts'], active: false },
        { id: 'TA0007', name: 'Discovery', icon: <Target size={24} />, description: 'Knowledge gathering about the environment.', techniques: ['System Network Configuration Discovery', 'Process Discovery'], active: false },
        { id: 'TA0004', name: 'Privilege Escalation', icon: <Shield size={24} />, description: 'Result of techniques to gain higher-level permissions.', techniques: ['Abuse Elevation Control Mechanism', 'Sudo Caching'], active: false },
        { id: 'TA0003', name: 'Persistence', icon: <Lock size={24} />, description: 'Techniques to maintain access across restarts.', techniques: ['Account Manipulation', 'Create Account'], active: false },
        { id: 'TA0010', name: 'Exfiltration', icon: <Crosshair size={24} />, description: 'Stealing data from the target network.', techniques: ['Exfiltration Over Web Service', 'Archive Collected Data'], active: false }
    ]);

    const [commandMappings, setCommandMappings] = useState([]);

    const fetchData = async () => {
        try {
            const res = await axios.get(`${API_BASE}/mapping/mitre`, REAL_ONLY_PARAMS);
            const data = res.data || {};

            // Flatten data for the mapping log
            const allMappings = [];
            Object.keys(data).forEach(tactic => {
                if (Array.isArray(data[tactic])) {
                    data[tactic].forEach(ev => {
                        allMappings.push({
                            ...ev,
                            tactic: tactic
                        });
                    });
                }
            });

            setCommandMappings(allMappings.sort((a, b) => new Date(b?.timestamp || 0) - new Date(a?.timestamp || 0)));

            // Update active tactics
            const seenStages = new Set(Object.keys(data));
            setTactics(prev => prev.map(t => ({
                ...t,
                active: seenStages.has(t.name)
            })));
        } catch (err) {
            console.error("MITRE Fetch failed", err);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Polling for aggregate sync

        // WebSocket "Neural Link" for instant tactic mapping
        const ws = createManagedWebSocket(
            `${WS_BASE}/ws/incidents`,
            {
                onMessage: (event) => {
                    const data = safeParseJson(event.data);
                    if (!data || isSyntheticEvent(data)) return;

                    const newIncident = {
                        cmd: data.cmd || 'LOG_ENTRY',
                        tactic: data.mitre_tactic || 'Unknown',
                        technique: data.mitre_technique || 'General Behavior',
                        severity: data.severity
                    };
                    setCommandMappings(prev => [newIncident, ...prev.slice(0, 19)]);

                    if (data.mitre_tactic) {
                        setTactics(prev => prev.map(t => ({
                            ...t,
                            active: t.active || t.name === data.mitre_tactic
                        })));
                    }
                },
                onError: (err) => console.error("WS MITRE Flow Error", err),
            },
            { reconnect: true }
        );

        return () => {
            clearInterval(interval);
            ws.close();
        };
    }, []);

    return (
        <div className="premium-scroll" style={{ padding: '40px 60px', color: '#e6edf3', fontFamily: "'Roboto', sans-serif" }}>
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 className="text-gradient-blue" style={{ margin: 0, fontSize: '2.8rem', fontWeight: '950', letterSpacing: '-1.5px' }}>
                        MITRE_ATT&CK_ALIGNMENT
                    </h1>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                        <div style={{ fontSize: '11px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Layers size={14} color="#58a6ff" /> ADVERSARY TACTIC CLASSIFICATION
                        </div>
                        <div style={{ fontSize: '11px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Target size={14} color="#f85149" /> TECHNIQUE ALIGNMENT ENGINE
                        </div>
                    </div>
                </div>
                <div className="premium-glass neon-glow-blue" style={{ padding: '12px 24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(88,166,255,0.2)' }}>
                    <Activity size={14} color="#58a6ff" className="animate-pulse" />
                    <span style={{ fontSize: '11px', fontWeight: '950', color: '#58a6ff', letterSpacing: '2px' }}>SENSORS_ACTIVE</span>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                {tactics.map((t, i) => (
                    <div key={i} className={`premium-glass card-hover-translate ${t.active ? 'neon-glow-green' : ''}`} style={{
                        borderRadius: '20px', padding: '24px', transition: '0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        position: 'relative', overflow: 'hidden',
                        border: `1px solid ${t.active ? 'rgba(63,185,80,0.25)' : 'rgba(48,54,61,0.5)'}`
                    }}>
                        {t.active && (
                            <div style={{ position: 'absolute', top: '12px', right: '12px', background: '#238636', color: 'white', fontSize: '10px', fontWeight: '950', padding: '3px 10px', borderRadius: '20px', letterSpacing: '1px' }}>
                                DETECTED
                            </div>
                        )}
                        <div style={{ color: t.active ? '#3fb950' : '#484f58', marginBottom: '16px' }}>{t.icon}</div>
                        <h2 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '8px' }}>{t.name}</h2>
                        <div style={{ fontSize: '12px', color: '#58a6ff', fontWeight: '800', marginBottom: '12px', letterSpacing: '0.5px' }}>{t.id}</div>
                        <p style={{ fontSize: '13px', color: '#8b949e', marginBottom: '20px', lineHeight: '1.5' }}>{t.description}</p>

                        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#58a6ff', letterSpacing: '1.5px', marginBottom: '10px', fontWeight: '950' }}>Techniques Observed</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {t.techniques.map((tec, j) => (
                                <span key={j} className="premium-glass" style={{
                                    padding: '4px 12px', borderRadius: '20px', fontSize: '11px',
                                    border: `1px solid ${t.active ? '#58a6ff30' : 'rgba(48,54,61,0.5)'}`,
                                    color: t.active ? '#58a6ff' : '#484f58', fontWeight: '600'
                                }}>
                                    {tec}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <section className="premium-glass" style={{ borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(48,54,61,0.5)', background: 'rgba(22, 27, 34, 0.5)' }}>
                    <h3 className="text-gradient-blue" style={{ margin: 0, fontSize: '15px', fontWeight: '900' }}>Heuristic Mapping Log</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(48,54,61,0.5)', color: '#8b949e' }}>
                                <th style={{ padding: '16px 24px', fontWeight: '800', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>Intercepted Command</th>
                                <th style={{ padding: '16px 24px', fontWeight: '800', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>Detected Tactic</th>
                                <th style={{ padding: '16px 24px', fontWeight: '800', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>Mapped Technique</th>
                                <th style={{ padding: '16px 24px', fontWeight: '800', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>Severity Index</th>
                            </tr>
                        </thead>
                        <tbody>
                            {commandMappings.map((m, i) => (
                                <tr key={i} style={{ borderBottom: i === commandMappings.length - 1 ? 'none' : '1px solid rgba(48,54,61,0.3)', transition: '0.2s' }}>
                                    <td style={{ padding: '16px 24px', fontFamily: "'JetBrains Mono', monospace", color: '#d2a8ff', fontWeight: '500' }}>{m.cmd}</td>
                                    <td style={{ padding: '16px 24px', fontWeight: '700' }}>{m.tactic}</td>
                                    <td style={{ padding: '16px 24px', color: '#8b949e' }}>{m.technique}</td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '950',
                                            background: m.severity === 'critical' ? 'rgba(248,81,73,0.1)' : m.severity === 'high' ? 'rgba(248,81,73,0.1)' : 'rgba(210,153,34,0.1)',
                                            color: m.severity === 'critical' || m.severity === 'high' ? '#f85149' : '#d29922',
                                            border: `1px solid ${m.severity === 'critical' || m.severity === 'high' ? '#f8514930' : '#d2992230'}`,
                                            textTransform: 'uppercase', letterSpacing: '0.5px'
                                        }}>
                                            {m.severity}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default MitreMapping;



