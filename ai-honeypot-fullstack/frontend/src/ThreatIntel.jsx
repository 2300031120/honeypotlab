import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { API_BASE, WS_BASE } from './apiConfig';
import { Globe, Shield, Activity, AlertCircle, TrendingUp, Search, Zap, Crosshair, Network, Sparkles, User, Database } from 'lucide-react';
import { motion, AnimatePresence } from './utils/motionLite.jsx';
import { isSyntheticEvent, stableGeoPoint, stableHexFromText } from './utils/eventUtils';
import { createManagedWebSocket, safeParseJson } from './utils/realtime';

// Simplified but professional World Map SVG Paths
const WORLD_PATHS = [
    // North America
    "M146.4,142.1l-14.1,4.4l-11.4-1.1l-5.4-8.7l-9.8-1.1l-1.6-4.9l-6-3.8l0,0l-6-2.2l-3.3-3.8l-1.6-9.8l10.3-15.7l16.3-17.9l12.5-4.4l1.6,2.7l9.2,2.2l2.2-0.5l1.6,3.8l-1.6,3.3l5.4,3.3l0.5,1.1l3.3-0.5l-0.5-2.2l7.1-1.6l10.3,1.1l15.2,14.7l4.3,6.5l-1.6,4.3l-5.4,6l0.5,2.7l-4.9,3.8l-3.3,10.3l-8.7,4.3L146.4,142.1z",
    // South America
    "M210.6,346.9l-14.7,0l-14.7-6.5l-12.5-12l-10.9-15.7l-8.7-22.3l-2.7-18.5l2.2-16.8l7.6-13.6l13.6-17.9l12-3.8l16.3,13l13.6,12.5l10.3,5.4l10.9,13.6l5.4,11.4l0.5,13.6l-5.4,19l-9.8,24.4l-10.3,14.7l-15.7,18.5L210.6,346.9z",
    // Europe & Africa
    "M450.5,248.6l-11.4-1.6l-10.3-6.5l-7.6-11.4l-2.7-16.8l2.2-15.2l12.5-11.4l13.6-7.1l16.3-2.2l15.7,3.3l12.5,9.2l6.5,13.6l0,0l-2.2,20.1l-9.2,19.6l-14.1,13.6l-16.3,4.9l-11.4-1.1L450.5,248.6z M500,400l-10-10l-20-10l-15-20l-5-30l5-25l15-20l25-10l30,10l20,15l10,25l0,35l-10,30L500,400z",
    // Asia & Australia
    "M800,100l-50,20l-40,40l-20,60l10,80l30,40l60,20l70-30l40-60l10-80l-30-60L800,100z M900,350l-15,0l-10-10l-5-15l5-15l15-10l20,10l10,15l0,15L900,350z"
];

const ThreatIntel = () => {
    const REAL_ONLY_PARAMS = { params: { include_training: false } };
    const [searchIp, setSearchIp] = useState("");
    const [searchResult, setSearchResult] = useState(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [healthData, setHealthData] = useState({ integrity: { trust_index: null } });
    const [activeAttacks, setActiveAttacks] = useState([]);
    const [iocs, setIocs] = useState([]);
    const [iocLoading, setIocLoading] = useState(false);
    const trustIndex = Number.isFinite(healthData.integrity?.trust_index) ? healthData.integrity.trust_index : null;

    const mapAttackColor = (severity) => {
        if (severity === 'high') return '#f85149';
        if (severity === 'medium') return '#d29922';
        return '#58a6ff';
    };

    const buildAttackModel = (event, seed = '') => {
        const country = event?.country || event?.geo || event?.geo_country || 'Unknown';
        const actorId = event?.ip || event?.actorId || country;
        const toolId = event?.attacker_type || event?.event_type || 'Unknown Bot';
        const eventIdSource = event?.id || `${actorId}|${event?.timestamp_utc || event?.ts || seed}`;
        return {
            id: String(eventIdSource),
            from: stableGeoPoint(country || actorId, 1000, 500),
            to: { x: 500, y: 200 },
            color: mapAttackColor(event?.severity),
            actorId,
            toolId,
            country,
            ts: event?.timestamp_utc || event?.ts || new Date().toISOString(),
        };
    };

    const heatmapRings = useMemo(() => {
        return activeAttacks.slice(0, 6).map((attack, idx) => ({
            id: `heat-${attack.id}-${idx}`,
            cx: attack.from.x,
            cy: attack.from.y,
            r: 52 + ((idx * 13) % 30),
        }));
    }, [activeAttacks]);

    const handleSearch = async () => {
        if (!searchIp) return;
        setSearchLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/intelligence/reputation/${searchIp}`, REAL_ONLY_PARAMS);
            setSearchResult(res.data);
        } catch (err) {
            console.error("IP Lookup failed", err);
        } finally {
            setSearchLoading(false);
        }
    };

    const fetchIOCs = async () => {
        setIocLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/intelligence/iocs`, REAL_ONLY_PARAMS);
            setIocs(res.data);
        } catch (err) {
            console.error("IOC Fetch failed", err);
        } finally {
            setIocLoading(false);
        }
    };

    const fetchData = async () => {
        try {
            const res = await axios.get(`${API_BASE}/dashboard/stats`, REAL_ONLY_PARAMS);
            const geoData = res.data.geo_distribution || {};
            const feed = Array.isArray(res.data.feed) ? res.data.feed : [];
            let nextAttacks = feed.slice(0, 12).map((event, idx) => buildAttackModel(event, `feed-${idx}`));

            if (nextAttacks.length === 0) {
                nextAttacks = Object.entries(geoData).map(([country, count], idx) => ({
                    id: `geo-${country}-${count}-${idx}`,
                    from: stableGeoPoint(country, 1000, 500),
                    to: { x: 500, y: 200 },
                    color: '#f85149',
                    actorId: `${country} (${count})`,
                    toolId: 'Regional Cluster',
                    country,
                    ts: new Date().toISOString(),
                }));
            }
            setActiveAttacks(nextAttacks);

            // Fetch real health/trust data
            const healthRes = await axios.get(`${API_BASE}/intelligence/health`, REAL_ONLY_PARAMS);
            setHealthData(healthRes.data);
        } catch (err) {
            console.error("Threat Intel Fetch failed", err);
        }
    };

    useEffect(() => {
        fetchData();
        fetchIOCs();
        const interval = setInterval(() => {
            fetchData();
            fetchIOCs();
        }, 15000);

        // WebSocket "Neural Link" for instant trajectories
        const ws = createManagedWebSocket(
            `${WS_BASE}/ws/incidents`,
            {
                onMessage: (event) => {
                    const data = safeParseJson(event.data);
                    if (!data || isSyntheticEvent(data)) return;

                    if (data.geo || data.country || data.ip) {
                        const newAttack = buildAttackModel(data, stableHexFromText(JSON.stringify(data), 12));
                        setActiveAttacks(prev => {
                            const merged = [...prev, newAttack];
                            const dedup = new Map();
                            merged.forEach((entry) => dedup.set(entry.id, entry));
                            return Array.from(dedup.values()).slice(-12);
                        });
                    }

                    if (data.iocs && data.iocs.length > 0) {
                        setIocs(prev => {
                            const newIocs = data.iocs.map(ioc => ({
                                ...ioc,
                                ts: data.ts || data.timestamp_utc || new Date().toISOString(),
                                ip: data.ip,
                            }));
                            return [...newIocs, ...prev].slice(0, 50);
                        });
                    }
                },
                onError: (err) => console.error("WS Threat Intel Flow Error", err),
            },
            { reconnect: true }
        );

        return () => {
            clearInterval(interval);
            ws.close();
        };
    }, []);

    const ActorRelationshipGraph = ({ activeAttacks }) => {
        const [selectedEntity, setSelectedEntity] = useState(null);
        const selectionRef = useRef(null);
        selectionRef.current = selectedEntity;

        const { nodes, links } = useMemo(() => {
            const actorMap = new Map();
            const toolMap = new Map();

            activeAttacks.slice(0, 8).forEach((attack, idx) => {
                const actorId = attack.actorId || attack.ip || `Actor_${idx}`;
                const toolId = attack.toolId || attack.attacker_type || 'Unknown Bot';

                if (!actorMap.has(actorId)) {
                    actorMap.set(actorId, { id: actorId, type: 'actor', label: actorId, icon: User, color: '#f85149' });
                }
                if (!toolMap.has(toolId)) {
                    toolMap.set(toolId, { id: toolId, type: 'tool', label: toolId, icon: Database, color: '#d29922' });
                }
            });

            const target = {
                id: 'Honeypot',
                type: 'target',
                label: 'SENTINEL_ALPHA',
                icon: Shield,
                color: '#58a6ff',
                x: 200,
                y: 86,
            };

            const actors = Array.from(actorMap.values()).map((node, index, list) => ({
                ...node,
                x: 82,
                y: list.length === 1 ? 192 : 92 + ((220 / Math.max(list.length - 1, 1)) * index),
            }));

            const tools = Array.from(toolMap.values()).map((node, index, list) => ({
                ...node,
                x: 318,
                y: list.length === 1 ? 192 : 92 + ((220 / Math.max(list.length - 1, 1)) * index),
            }));

            const nextLinks = [];
            actors.forEach((actor) => {
                nextLinks.push({ id: `${actor.id}-root`, source: actor.id, target: target.id });
            });

            activeAttacks.slice(0, 8).forEach((attack, idx) => {
                const actorId = attack.actorId || attack.ip || `Actor_${idx}`;
                const toolId = attack.toolId || attack.attacker_type || 'Unknown Bot';
                if (actorMap.has(actorId) && toolMap.has(toolId)) {
                    nextLinks.push({ id: `${actorId}-${toolId}-${idx}`, source: actorId, target: toolId });
                }
            });

            return { nodes: [target, ...actors, ...tools], links: nextLinks };
        }, [activeAttacks]);

        const nodeLookup = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes]);

        return (
            <div style={{ position: 'relative' }}>
                <svg width="100%" height="400" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet">
                    <defs>
                        <linearGradient id="relationshipLink" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="rgba(248,81,73,0.45)" />
                            <stop offset="50%" stopColor="rgba(88,166,255,0.28)" />
                            <stop offset="100%" stopColor="rgba(210,153,34,0.45)" />
                        </linearGradient>
                    </defs>

                    {links.map((link) => {
                        const source = nodeLookup[link.source];
                        const target = nodeLookup[link.target];
                        if (!source || !target) return null;
                        const midX = (source.x + target.x) / 2;
                        return (
                            <path
                                key={link.id}
                                d={`M ${source.x} ${source.y} C ${midX} ${source.y}, ${midX} ${target.y}, ${target.x} ${target.y}`}
                                fill="none"
                                stroke="url(#relationshipLink)"
                                strokeWidth="1.6"
                                strokeOpacity="0.8"
                            />
                        );
                    })}

                    {nodes.map((node) => (
                        <g
                            key={node.id}
                            transform={`translate(${node.x}, ${node.y})`}
                            onClick={() => setSelectedEntity(node)}
                            style={{ cursor: 'pointer' }}
                        >
                            <circle
                                r={node.type === 'target' ? 18 : 13}
                                fill="#0d1117"
                                stroke={node.color}
                                strokeWidth={node.type === 'target' ? 2.4 : 1.8}
                            />
                            <circle
                                r={node.type === 'target' ? 30 : 22}
                                fill="none"
                                stroke={node.color}
                                strokeOpacity="0.14"
                            />
                            <text
                                x={node.type === 'actor' ? 20 : node.type === 'tool' ? -20 : 0}
                                y={4}
                                textAnchor={node.type === 'actor' ? 'start' : node.type === 'tool' ? 'end' : 'middle'}
                                fill="#8b949e"
                                style={{ fontSize: '9px', fontFamily: 'monospace' }}
                            >
                                {node.label.length > 12 ? `${node.label.slice(0, 10)}..` : node.label}
                            </text>
                        </g>
                    ))}
                </svg>
                <AnimatePresence>
                    {selectedEntity && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px', background: 'rgba(22,27,34,0.9)', border: '1px solid #30363d', padding: '12px', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {selectedEntity.icon && (
                                        <selectedEntity.icon size={14} color={selectedEntity.color} />
                                    )}
                                    <span style={{ fontSize: '12px', fontWeight: '800' }}>{selectedEntity.label}</span>
                                </div>
                                <button onClick={() => setSelectedEntity(null)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer' }}>Close</button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    return (
        <div className="premium-scroll" style={{ padding: '40px 60px', color: '#e6edf3', fontFamily: "'Manrope', sans-serif" }}>
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 className="text-gradient-blue" style={{
                        margin: 0,
                        fontSize: '2.8rem',
                        fontWeight: '950',
                        letterSpacing: '-1.5px'
                    }}>
                        THREAT_INTEL_COMMAND
                    </h1>
                    <p style={{ margin: '8px 0 0', color: '#8b949e', fontSize: '15px', fontWeight: '500' }}>High-fidelity geospatial tracking of global adversary clusters and neural attack vectors.</p>
                </div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', display: 'flex', gap: '12px' }}>
                        <input
                            type="text"
                            placeholder="Search IP Reputation..."
                            value={searchIp}
                            onChange={(e) => setSearchIp(e.target.value)}
                            className="premium-glass"
                            style={{
                                border: '1px solid rgba(56, 189, 248, 0.2)',
                                borderRadius: '12px',
                                padding: '12px 20px',
                                color: '#e6edf3',
                                fontSize: '14px',
                                width: '300px',
                                outline: 'none'
                            }}
                        />
                        <button
                            onClick={handleSearch}
                            disabled={searchLoading}
                            className="premium-glass neon-glow-blue card-hover-translate"
                            style={{
                                border: '1px solid rgba(88,166,255,0.3)',
                                borderRadius: '12px',
                                padding: '12px 24px',
                                color: '#58a6ff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontWeight: '800'
                            }}
                        >
                            {searchLoading ? <Activity size={18} className="animate-spin" /> : <Search size={18} />}
                        </button>
                    </div>
                    <div
                        className="premium-glass card-hover-translate neon-glow-green"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px',
                            padding: '12px 28px',
                            borderRadius: '20px',
                            border: '1px solid rgba(63,185,80,0.4)',
                            cursor: 'default',
                            transition: '0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                    >
                        <Zap size={20} color="#3fb950" />
                        <div style={{ fontSize: '12px', fontWeight: '900', color: '#3fb950', letterSpacing: '1px' }}>LIVE_TELEMETRY</div>
                        <div style={{ width: '40px', height: '20px', background: 'rgba(35,134,54,0.3)', borderRadius: '20px', position: 'relative', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ width: '14px', height: '14px', background: '#3fb950', borderRadius: '50%', position: 'absolute', top: '2px', left: '23px', transition: '0.3s', boxShadow: '0 0 10px #3fb950' }}></div>
                        </div>
                    </div>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '32px' }}>
                {/* Advanced SVG Map View */}
                <div className="premium-glass" style={{
                    borderRadius: '28px',
                    padding: '32px',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid rgba(56, 189, 248, 0.1)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '28px', position: 'relative', zIndex: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div className="premium-glass neon-glow-blue" style={{ padding: '10px', borderRadius: '12px' }}>
                                <Globe size={24} color="#58a6ff" />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900', letterSpacing: '0.5px' }}>ADVERSARY_LANDSCAPE</h3>
                        </div>
                        <div className="premium-glass neon-glow-green" style={{ fontSize: '11px', color: '#3fb950', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 20px', borderRadius: '30px', fontWeight: '900' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3fb950', boxShadow: '0 0 10px #3fb950', animation: 'pulse-glow 2s infinite' }}></div>
                            ACTIVE_SENSORS: 142
                        </div>
                    </div>

                    <div className="premium-glass" style={{
                        flex: 1,
                        minHeight: '520px',
                        background: 'rgba(1, 4, 9, 0.4)',
                        borderRadius: '24px', position: 'relative',
                        border: '1px solid rgba(48,54,61,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.8)'
                    }}>
                        {/* High-Fidelity World Map */}
                        <svg viewBox="0 0 1000 500" style={{ width: '100%', height: '100%' }}>
                            <defs>
                                <filter id="glow-land">
                                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                                    <feMerge>
                                        <feMergeNode in="blur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                                <filter id="glow-trajectory">
                                    <feGaussianBlur stdDeviation="4" result="blur" />
                                    <feMerge>
                                        <feMergeNode in="blur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                                <linearGradient id="land-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#161b22" />
                                    <stop offset="100%" stopColor="#0d1117" />
                                </linearGradient>
                            </defs>

                            {/* Grid Dots */}
                            <pattern id="dotPatternExpert" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                                <circle cx="1" cy="1" r="0.8" fill="#21262d" />
                            </pattern>
                            <rect width="100%" height="100%" fill="url(#dotPatternExpert)" />

                            {/* Continent Paths */}
                            {WORLD_PATHS.map((path, i) => (
                                <path
                                    key={i}
                                    d={path}
                                    fill="url(#land-gradient)"
                                    stroke="rgba(56, 189, 248, 0.15)"
                                    strokeWidth="1.2"
                                    style={{ filter: 'url(#glow-land)', transition: '0.5s' }}
                                />
                            ))}

                            {/* Threat Trajectories */}
                            {activeAttacks.map(attack => (
                                <g key={attack.id}>
                                    <path
                                        d={`M ${attack.from.x} ${attack.from.y} C ${attack.from.x} ${attack.from.y - 120}, ${attack.to.x} ${attack.to.y - 120}, ${attack.to.x} ${attack.to.y} `}
                                        fill="none"
                                        stroke={attack.color}
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        style={{ filter: 'url(#glow-trajectory)', opacity: 0.9 }}
                                        strokeDasharray="1000"
                                        strokeDashoffset="1000"
                                    >
                                        <animate attributeName="stroke-dashoffset" from="1000" to="0" dur="1.5s" fill="freeze" />
                                        <animate attributeName="opacity" values="0;1;1;0" dur="2s" fill="freeze" />
                                    </path>
                                    <circle cx={attack.from.x} cy={attack.from.y} r="5" fill={attack.color}>
                                        <animate attributeName="r" values="4;8;4" dur="1s" repeatCount="indefinite" />
                                        <animate attributeName="opacity" values="1;0.5;1" dur="1s" repeatCount="indefinite" />
                                    </circle>
                                </g>
                            ))}

                            {/* Predictive Heatmap Overlay */}
                            {heatmapRings.map((ring) => (
                                <circle
                                    key={ring.id}
                                    cx={ring.cx}
                                    cy={ring.cy}
                                    r={ring.r}
                                    fill="rgba(248, 81, 73, 0.08)"
                                    style={{ filter: 'blur(30px)' }}
                                >
                                    <animate attributeName="opacity" values="0.1;0.4;0.1" dur="4s" repeatCount="indefinite" />
                                </circle>
                            ))}

                            {/* Honeypot Node */}
                            <g transform="translate(500, 200)">
                                <circle r="50" fill="rgba(88, 166, 255, 0.08)">
                                    <animate attributeName="r" values="40;60;40" dur="5s" repeatCount="indefinite" />
                                </circle>
                                <circle r="6" fill="#58a6ff" style={{ filter: 'url(#glow-land)', boxShadow: '0 0 20px #58a6ff' }} />
                                <text y="32" textAnchor="middle" fill="#58a6ff" style={{ fontSize: '11px', fontWeight: '950', fontFamily: 'monospace', letterSpacing: '2px' }}>SENTINEL_ALPHA</text>
                            </g>
                        </svg>

                        {/* Actor Relationship Analysis Overlay */}
                        <div className="premium-glass" style={{ position: 'absolute', bottom: '24px', left: '24px', right: '24px', height: '220px', background: 'rgba(1,4,9,0.7)', border: '1px solid rgba(56, 189, 248, 0.1)', borderRadius: '20px', backdropFilter: 'blur(15px)', overflow: 'hidden' }}>
                            <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(56, 189, 248, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: '#8b949e', fontWeight: '900', letterSpacing: '2px' }}>FORENSIC_RELATIONSHIP_GRAPH</span>
                                <Sparkles size={16} color="#58a6ff" />
                            </div>
                            <ActorRelationshipGraph activeAttacks={activeAttacks} />
                        </div>

                        {/* Floating Metadata Card */}
                        <div className="premium-glass neon-glow-blue" style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(13, 17, 23, 0.95)', border: '1px solid rgba(88,166,255,0.2)', padding: '20px', borderRadius: '20px', width: '280px', backdropFilter: 'blur(15px)', zIndex: 10 }}>
                            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '16px', fontWeight: '900', letterSpacing: '1px' }}>
                                {searchResult ? `REPUTATION: ${searchResult.ip}` : 'IDENTIFIED_ACTORS (LIVE)'}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {searchResult ? (
                                    <>
                                        <div style={{ fontSize: '16px', fontWeight: '950', color: searchResult.reputation.abuse_score > 50 ? '#f85149' : '#3fb950' }}>
                                            ABUSE_SCORE: {searchResult.reputation.abuse_score}/100
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#d1d5db', fontWeight: '500' }}>
                                            TYPE: {searchResult.reputation.usage_type}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#8b949e' }}>
                                            HISTORY: {searchResult.platform_history_count} Events Recorded
                                        </div>
                                        {searchResult.is_blacklisted && (
                                            <div className="premium-glass" style={{ fontSize: '10px', color: '#f85149', fontWeight: '900', marginTop: '8px', padding: '6px', textAlign: 'center', background: 'rgba(248,81,73,0.1)', borderRadius: '8px' }}>PERMANENT_QUARANTINE_LOCKED</div>
                                        )}
                                        <button
                                            onClick={() => setSearchResult(null)}
                                            style={{ marginTop: '10px', background: 'transparent', border: '1px solid #30363d', color: '#8b949e', fontSize: '11px', padding: '6px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}
                                        >
                                            DISMISS_INTEL
                                        </button>
                                    </>
                                ) : (
                                    activeAttacks.length === 0 ? (
                                        <div style={{ fontSize: '12px', color: '#8b949e', fontStyle: 'italic' }}>No active actors in neural scan...</div>
                                    ) : (
                                        activeAttacks.slice(0, 4).map((actor, i) => (
                                            <div key={i} className="card-hover-translate" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: actor.color || '#8b949e', boxShadow: `0 0 10px ${actor.color || '#8b949e'}` }}></div>
                                                <span style={{ color: '#e6edf3', fontWeight: '600', fontFamily: 'monospace' }}>{actor.actorId || actor.ip || 'Unknown'}</span>
                                            </div>
                                        ))
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Regional Analytics Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <div className="premium-glass card-hover-translate" style={{
                        borderRadius: '24px',
                        padding: '32px',
                        position: 'relative',
                        overflow: 'hidden',
                        border: '1px solid rgba(63, 185, 80, 0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '24px' }}>
                            <div className="premium-glass neon-glow-green" style={{ padding: '10px', borderRadius: '12px' }}>
                                <Crosshair size={24} color="#3fb950" />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#3fb950', letterSpacing: '1px' }}>NETWORK_INTEGRITY</h3>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '12px' }}>
                            <div className="text-gradient-blue" style={{ fontSize: '5rem', fontWeight: '950', letterSpacing: '-5px' }}>{trustIndex == null ? 'N/A' : trustIndex}</div>
                            <div style={{ fontSize: '1.4rem', color: '#8b949e', fontWeight: '800' }}>%</div>
                        </div>
                        <div style={{ height: '10px', background: 'rgba(1, 4, 9, 0.4)', borderRadius: '10px', marginTop: '24px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                            {trustIndex != null && (
                                <div style={{ width: `${trustIndex}%`, height: '100%', background: 'linear-gradient(90deg, #238636, #3fb950)', borderRadius: '10px', boxShadow: '0 0 20px rgba(63, 185, 80, 0.5)' }}></div>
                            )}
                        </div>
                        <p style={{ fontSize: '13px', color: '#8b949e', textAlign: 'center', marginTop: '20px', lineHeight: '1.6' }}>
                            Platform integrity current state: <strong style={{ color: trustIndex > 90 ? '#3fb950' : '#f85149' }}>{trustIndex == null ? 'SCANNING...' : (trustIndex > 90 ? 'OPTIMAL' : 'DEGRADED')}</strong>.
                        </p>
                    </div>

                    <div className="premium-glass" style={{ borderRadius: '24px', padding: '32px', flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
                        <h3 className="text-gradient-blue" style={{ margin: '0 0 24px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '15px', fontWeight: '900' }}>
                            <Shield size={24} /> IOC_EXTRACTION_LAB
                        </h3>

                        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '450px', paddingRight: '12px' }} className="custom-scrollbar">
                            {iocLoading && iocs.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px', color: '#8b949e' }}>
                                    <Activity className="animate-spin" size={32} style={{ marginBottom: '16px', color: '#58a6ff' }} />
                                    <div style={{ fontWeight: '700', letterSpacing: '2px' }}>SYNCING_NEURAL_HIVE...</div>
                                </div>
                            ) : iocs.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px', color: '#8b949e', border: '1px dashed rgba(56, 189, 248, 0.2)', borderRadius: '20px' }}>
                                    No extracted intelligence in current cycle.
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(56, 189, 248, 0.1)', color: '#8b949e' }}>
                                            <th style={{ padding: '16px 10px', fontWeight: '900' }}>IDENTIFIER</th>
                                            <th style={{ padding: '16px 10px', fontWeight: '900' }}>EXTRACTED_PAYLOAD</th>
                                            <th style={{ padding: '16px 10px', fontWeight: '900' }}>ORIGIN_IP</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {iocs.map((ioc, idx) => (
                                            <tr key={idx} className="card-hover-translate" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.3s' }}>
                                                <td style={{ padding: '16px 10px' }}>
                                                    <span className="premium-glass" style={{
                                                        background: ioc.type === 'URL' ? 'rgba(88,166,255,0.1)' : ioc.type === 'IP' ? 'rgba(210,153,34,0.1)' : 'rgba(139,148,158,0.1)',
                                                        color: ioc.type === 'URL' ? '#58a6ff' : ioc.type === 'IP' ? '#d2a8ff' : '#8b949e',
                                                        padding: '4px 10px',
                                                        borderRadius: '6px',
                                                        fontSize: '10px',
                                                        fontWeight: '950',
                                                        border: `1px solid ${ioc.type === 'URL' ? 'rgba(88,166,255,0.2)' : 'rgba(210,153,34,0.2)'}`
                                                    }}>
                                                        {ioc.type}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px 10px', color: '#e6edf3', fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-all', fontWeight: '600' }}>
                                                    {ioc.value}
                                                </td>
                                                <td style={{ padding: '16px 10px', color: '#8b949e', fontWeight: '700' }}>
                                                    {ioc.ip}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="premium-glass" style={{ marginTop: '28px', padding: '20px', background: 'rgba(88, 166, 255, 0.03)', borderRadius: '20px', border: '1px solid rgba(88,166,255,0.1)' }}>
                            <div style={{ fontSize: '11px', color: '#58a6ff', fontWeight: '950', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '1px' }}>
                                <AlertCircle size={14} /> ANALYTICAL_INSIGHT
                            </div>
                            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: '1.6' }}>
                                IOCs are autonomously extracted from adversary shell flows using neural text synthesis. Data is synchronized across the global defense grid in real-time.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

};

export default ThreatIntel;


