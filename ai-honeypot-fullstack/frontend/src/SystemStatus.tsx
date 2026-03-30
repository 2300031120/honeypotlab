// @ts-nocheck
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE, WS_BASE } from './apiConfig';
import { Activity, Clock, RefreshCcw, Cpu, HardDrive, Wifi, Shield, Bell, CheckCircle2, Database, Brain } from 'lucide-react';
import { createManagedWebSocket, safeParseJson } from './utils/realtime';

const SystemStatus = () => {
    const REAL_ONLY_PARAMS = { params: { include_training: false } };
    const [stats, setStats] = useState({
        cpu: null,
        memory: null,
        latency: null,
        threads: null,
        uptime: "Initializing..."
    });
    const [components, setComponents] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [metrics, setMetrics] = useState({ total_incidents: 0, critical_hits: 0 });

    const fetchData = async () => {
        try {
            const res = await axios.get(`${API_BASE}/system/status`, REAL_ONLY_PARAMS);
            setStats({
                cpu: res.data.cpu,
                memory: res.data.memory,
                latency: res.data.latency,
                threads: res.data.threads,
                uptime: res.data.uptime
            });
            setComponents(res.data.components);
            setNotifications(res.data.notifications || []);
            setMetrics(res.data.metrics || { total_incidents: 0, critical_hits: 0 });
        } catch (err) {
            console.error("System Status Fetch failed", err);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);

        const ws = createManagedWebSocket(
            `${WS_BASE}/ws/system`,
            {
                onMessage: (event) => {
                    const data = safeParseJson(event.data);
                    if (!data) return;
                    setStats(prev => ({
                        ...prev,
                        cpu: data.cpu,
                        memory: data.memory,
                        latency: data.latency
                    }));
                },
                onError: (err) => console.error("WS System Pulse Flow Error", err),
            },
            { reconnect: true }
        );

        return () => {
            clearInterval(interval);
            ws.close();
        };
    }, []);

    const componentIconMap = {
        database: Database,
        wifi: Wifi,
        activity: Activity,
        brain: Brain,
    };

    return (
        <div className="premium-scroll" style={{ color: '#e6edf3', padding: '40px 60px', fontFamily: "'Manrope', sans-serif" }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                <div>
                    <h1 className="text-gradient-green" style={{ margin: 0, fontSize: '2.8rem', fontWeight: '950', letterSpacing: '-1.5px' }}>
                        SYSTEM_PULSE_MONITOR
                    </h1>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                        <div style={{ fontSize: '11px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Activity size={14} color="#3fb950" /> INFRASTRUCTURE HEALTH: {stats.cpu == null || stats.memory == null ? 'UNKNOWN' : (stats.cpu > 90 || stats.memory > 90 ? 'DEGRADED' : 'OPTIMAL')}
                        </div>
                        <div style={{ fontSize: '11px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={14} color="#8b949e" /> SYSTEM UPTIME: {stats.uptime}
                        </div>
                    </div>
                </div>
                <div className="premium-glass neon-glow-blue" style={{ padding: '12px 20px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(88,166,255,0.2)' }}>
                    <RefreshCcw size={14} color="#58a6ff" className="animate-pulse" />
                    <span style={{ fontSize: '11px', color: '#58a6ff', fontWeight: '950', letterSpacing: '2px' }}>AUTO-SYNC ON</span>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '40px' }}>
                {[
                    { label: 'CPU LOAD', val: stats.cpu == null ? 'N/A' : `${stats.cpu}%`, icon: <Cpu />, color: '#58a6ff' },
                    { label: 'MEM UTILIZATION', val: stats.memory == null ? 'N/A' : `${stats.memory}%`, icon: <HardDrive />, color: '#d2a8ff' },
                    { label: 'NET LATENCY', val: stats.latency == null ? 'N/A' : `${stats.latency} ms`, icon: <Wifi />, color: '#3fb950' },
                    { label: 'ACTIVE THREADS', val: stats.threads == null ? 'N/A' : `${stats.threads}`, icon: <Activity />, color: '#f1e05a' }
                ].map((stat, i) => (
                    <div key={i} className="premium-glass card-hover-translate" style={{ borderRadius: '24px', padding: '24px', border: '1px solid rgba(56, 189, 248, 0.1)', transition: '0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                        <div style={{ color: stat.color, marginBottom: '16px' }}>{stat.icon}</div>
                        <div style={{ fontSize: '10px', color: '#8b949e', fontWeight: '950', marginBottom: '4px', letterSpacing: '1.5px' }}>{stat.label}</div>
                        <div style={{ fontSize: '24px', fontWeight: '950' }}>{stat.val}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px' }}>
                <section className="premium-glass" style={{ borderRadius: '24px', padding: '32px', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
                    <h3 className="text-gradient-green" style={{ margin: '0 0 24px', fontSize: '16px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Shield size={20} color="#3fb950" /> COMPONENT CLUSTER STATUS
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {components.map((comp, i) => (
                            <div key={i} className="premium-glass card-hover-translate" style={{
                                borderRadius: '16px', padding: '20px',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                border: '1px solid rgba(48,54,61,0.5)', transition: '0.3s'
                            }}>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                    <div style={{ color: '#484f58' }}>
                                        {React.createElement(componentIconMap[String(comp.icon || '').toLowerCase()] || Activity, { size: 16 })}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px' }}>{comp.name}</div>
                                        <div style={{ fontSize: '10px', color: '#3fb950', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontWeight: '700' }}>
                                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#3fb950', boxShadow: '0 0 6px #3fb950' }} /> {comp.status.toUpperCase()}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '14px', fontWeight: '900' }}>{comp.load == null ? 'N/A' : comp.load}</div>
                                    <div style={{ fontSize: '9px', color: '#484f58', fontWeight: '800', letterSpacing: '1px' }}>LOAD</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    <section className="premium-glass" style={{ borderRadius: '24px', padding: '32px', flex: 1, border: '1px solid rgba(56, 189, 248, 0.1)' }}>
                        <h3 className="text-gradient-purple" style={{ margin: '0 0 24px', fontSize: '14px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Bell size={18} color="#d2a8ff" /> SYSTEM NOTIFICATIONS
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {notifications.length === 0 ? (
                                <div className="premium-glass" style={{ padding: '12px 16px', borderRadius: '12px', border: '1px dashed rgba(48,54,61,0.5)', fontSize: '12px', color: '#8b949e' }}>
                                    No recent notifications.
                                </div>
                            ) : notifications.map((n, i) => (
                                <div key={i} className="premium-glass" style={{
                                    padding: '12px 16px', borderRadius: '12px',
                                    borderLeft: `3px solid ${n.severity === 'high' ? '#f85149' : n.severity === 'medium' ? '#d29922' : '#3fb950'}`,
                                    fontSize: '12px'
                                }}>
                                    {n.msg}
                                </div>
                            ))}
                        </div>

                        <div className="premium-glass" style={{ marginTop: '30px', padding: '20px', borderRadius: '16px', border: '1px dashed rgba(48,54,61,0.5)', textAlign: 'center' }}>
                            <CheckCircle2 size={32} color="#3fb950" style={{ marginBottom: '12px' }} />
                            <div style={{ fontSize: '14px', fontWeight: '900' }}>
                                {metrics.critical_hits > 0 ? 'CRITICAL EVENTS DETECTED' : 'NO CRITICAL EVENTS'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#484f58', marginTop: '4px' }}>
                                Total events: {metrics.total_incidents}
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default SystemStatus;


