// @ts-nocheck
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE, WS_BASE } from './apiConfig';
import {
    ReactFlow,
    Background,
    Controls,
    Handle,
    Position,
    useNodesState,
    useEdgesState,
    addEdge,
    BaseEdge,
    getBezierPath,
} from '@xyflow/react';
import { motion, AnimatePresence } from './utils/motionLite';
import { getEventDate, getEventTimestampValue, isSyntheticEvent, stableHexFromText } from './utils/eventUtils';
import { createManagedWebSocket, safeParseJson } from './utils/realtime';
import {
    Search, Zap, Shield, Lock, Database, AlertCircle,
    Terminal, Activity, TrendingUp, Info, ChevronRight,
    X, Target, Fingerprint, Map, Network, Sparkles,
    Play, Pause, RotateCcw
} from 'lucide-react';

// --- Custom Node Component ---
const AttackNode = ({ data, selected }) => {
    const { label, sub, icon: Icon, tactic, risk, isEscalation, status } = data;

    const glowClass = useMemo(() => {
        if (status === 'blocked') return 'glow-green';
        if (risk === 'critical') return 'glow-red';
        if (risk === 'high') return 'glow-orange';
        if (risk === 'medium') return 'glow-yellow';
        return 'glow-blue';
    }, [risk, status]);

    return (
        <div className={`node-container ${glowClass} ${selected ? 'selected' : ''}`} style={{
            minWidth: '180px',
            border: selected ? '2px solid white' : undefined,
            boxShadow: selected ? `0 0 20px white` : undefined
        }}>
            {isEscalation && (
                <div className="escalation-badge">ESCALATION</div>
            )}

            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{
                    padding: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    color: status === 'blocked' ? '#3fb950' : (risk === 'critical' ? '#f85149' : (risk === 'medium' ? '#d29922' : '#58a6ff'))
                }}>
                    <Icon size={18} />
                </div>
                <div>
                    <div style={{ fontSize: '12px', fontWeight: '800', marginBottom: '2px', color: '#e6edf3' }}>{label}</div>
                    <div style={{ fontSize: '10px', color: '#8b949e', textTransform: 'uppercase' }}>{sub}</div>
                </div>
            </div>

            {tactic && (
                <div className="tactic-badge">
                    <Map size={10} />
                    <span className="tag">TACTIC: {tactic}</span>
                </div>
            )}

            <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
            <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
        </div>
    );
};

// --- Custom Edge Component ---
const AttackEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }) => {
    const [edgePath] = getBezierPath({
        sourceX, sourceY, sourcePosition, targetPosition, targetX, targetY,
    });

    const edgeColor = useMemo(() => {
        if (data.risk === 'critical') return '#f85149';
        if (data.risk === 'high') return '#f78166';
        if (data.risk === 'medium') return '#d29922';
        return '#58a6ff';
    }, [data.risk]);

    return (
        <BaseEdge
            path={edgePath}
            stroke={edgeColor}
            strokeWidth={data.isActive ? 3 : 1.5}
            className={data.isActive ? 'edge-path' : ''}
            style={{ filter: `drop-shadow(0 0 4px ${edgeColor}40)` }}
        />
    );
};

const nodeTypes = { attack: AttackNode };
const edgeTypes = { attack: AttackEdge };

const AttackGraph = () => {
    const REAL_ONLY_PARAMS = { params: { include_training: false } };
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [stats, setStats] = useState({ total: 0, critical: 0 });

    // Replay State
    const [isReplaying, setIsReplaying] = useState(false);
    const [replayProgress, setReplayProgress] = useState(100);
    const [allEvents, setAllEvents] = useState([]);
    const timerRef = useRef();

    useEffect(() => {
        void import('@xyflow/react/dist/style.css');
    }, []);

    const normalizeEvent = useCallback((event, seed = '') => {
        const timestamp = getEventTimestampValue(event) || new Date().toISOString();
        const sessionId = event?.session_id || `${event?.ip || 'unknown'}-${String(timestamp).slice(0, 16)}-${seed || 'evt'}`;
        const cmd = event?.cmd || event?.url_path || event?.event_type || 'N/A';
        const score = Number(event?.score ?? event?.risk_score ?? event?.risk ?? 0);
        return {
            ...event,
            session_id: sessionId,
            ts: timestamp,
            timestamp_utc: timestamp,
            cmd,
            score: Number.isFinite(score) ? score : 0,
            country: event?.country || event?.geo || event?.geo_country || 'UNK',
            severity: event?.severity || 'low',
            ai_stage: event?.ai_stage || event?.ai_metadata?.stage || 'Discovery',
            ai_intent: event?.ai_intent || event?.ai_metadata?.intent || 'Discovery',
            ai_explanation: event?.ai_explanation || event?.analysis || event?.ai_metadata?.thought || 'Behavioral inference in progress',
            ai_metadata: event?.ai_metadata || {},
        };
    }, []);

    const derivedMetrics = useMemo(() => {
        const total = allEvents.length;
        const critical = allEvents.filter((event) => String(event.severity).toLowerCase() === 'high').length;
        const uniqueIps = new Set(allEvents.map((event) => event.ip).filter(Boolean)).size;
        const avgScore = total > 0 ? allEvents.reduce((acc, event) => acc + Number(event.score || 0), 0) / total : 0;
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const recentEvents = allEvents.filter((event) => {
            const eventDate = getEventDate(event);
            return eventDate ? eventDate.getTime() >= oneHourAgo : false;
        });
        const criticalRate = total > 0 ? Math.round((critical / total) * 100) : 0;
        const compromiseProbability = Math.min(95, Math.round((criticalRate * 0.6) + (avgScore * 0.4)));
        const defenseEffectiveness = Math.max(5, Math.min(99, 100 - compromiseProbability + Math.round((stats.blocked || 0) / 2)));
        const complexityScore = (1 + (avgScore / 15) + (uniqueIps / 12));
        return {
            recentEvents: recentEvents.length,
            criticalRate,
            compromiseProbability,
            defenseEffectiveness,
            complexityScore: complexityScore.toFixed(1),
            momentum: recentEvents.length >= 10 ? 'INCREASING' : recentEvents.length >= 4 ? 'STABLE' : 'LOW',
            latencyMs: Math.round(120 + Math.min(300, total * 2)),
        };
    }, [allEvents, stats.blocked]);

    const runSimulation = useCallback((nodesToSim, edgesToSim) => {
        setNodes(nodesToSim.map((node) => ({
            ...node,
            position: {
                x: Number.isFinite(node.x) ? node.x : 0,
                y: Number.isFinite(node.y) ? node.y : 0,
            }
        })));
        setEdges(edgesToSim);
    }, [setNodes, setEdges]);

    const buildGraph = useCallback((feed, progressLimit = 100) => {
        const limitedFeed = feed.slice(0, Math.ceil((feed.length * progressLimit) / 100));
        const orderedFeed = [...limitedFeed].sort((a, b) => {
            const aTime = getEventDate(a)?.getTime() || 0;
            const bTime = getEventDate(b)?.getTime() || 0;
            return aTime - bTime;
        });

        const sessions = {};
        orderedFeed.forEach(event => {
            const sid = event.session_id || event.ip;
            if (!sessions[sid]) sessions[sid] = [];
            sessions[sid].push(event);
        });

        const sessionIds = Object.keys(sessions).slice(0, 8);
        const laneSpacing = 260;
        const rowSpacing = 170;
        const originX = 140;
        const rootX = originX + (Math.max(sessionIds.length - 1, 0) * laneSpacing) / 2;

        const newNodes = [{
            id: 'root',
            type: 'attack',
            x: rootX, y: 40,
            data: { label: 'Neural Defense Hub', sub: 'SYSTEM_STABLE', icon: Shield, risk: 'low', status: 'active' }
        }];
        const newEdges = [];

        sessionIds.forEach((sid, sIdx) => {
            const sessionEvents = sessions[sid].sort((a, b) => {
                const aTime = getEventDate(a)?.getTime() || 0;
                const bTime = getEventDate(b)?.getTime() || 0;
                return aTime - bTime;
            });
            const laneX = originX + (sIdx * laneSpacing);
            sessionEvents.forEach((event, eIdx) => {
                const eventIdentifier = event.id || stableHexFromText(`${sid}|${event.ip}|${event.cmd}|${event.ts}|${eIdx}`, 12);
                const nodeId = `event-${eventIdentifier}`;
                const normalizedSeverity = String(event.severity || 'low').toLowerCase();
                const riskLevel =
                    normalizedSeverity === 'high'
                        ? 'critical'
                        : normalizedSeverity === 'medium'
                            ? 'high'
                            : 'medium';
                newNodes.push({
                    id: nodeId,
                    type: 'attack',
                    x: laneX + (eIdx % 2 === 0 ? -18 : 18),
                    y: 190 + (eIdx * rowSpacing),
                    data: {
                        label: event.cmd || 'N/A',
                        sub: `${event.ip || 'UNKNOWN'} | ${event.country || event.geo || 'UNK'}`,
                        icon: (event.ai_stage === 'Initial Access' ? Target : (event.ai_stage === 'Execution' ? Zap : Activity)),
                        tactic: event.ai_stage,
                        risk: riskLevel,
                        status: normalizedSeverity === 'high' ? 'active' : 'idle',
                        ai_metadata: {
                            intent: event.ai_metadata?.intent || event.ai_intent,
                            confidence: event.ai_metadata?.confidence || event.confidence || event.ai_confidence || 85,
                            thought: event.ai_metadata?.thought || event.ai_explanation,
                            mode: event.ai_metadata?.mode || event.deception_mode,
                            entropy: event.ai_metadata?.entropy || event.entropy || 0.12,
                        }
                    }
                });

                if (eIdx === 0) {
                    newEdges.push({ id: `edge-root-${nodeId}`, source: 'root', target: nodeId, type: 'attack', data: { risk: riskLevel, isActive: true } });
                } else {
                    const prevEvent = sessionEvents[eIdx - 1];
                    const prevNodeId = `event-${prevEvent.id || stableHexFromText(`${sid}|${prevEvent.ip}|${prevEvent.cmd}|${prevEvent.ts}|${eIdx - 1}`, 12)}`;
                    newEdges.push({ id: `edge-${prevNodeId}-${nodeId}`, source: prevNodeId, target: nodeId, type: 'attack', data: { risk: riskLevel, isActive: true } });
                }
            });
        });

        runSimulation(newNodes, newEdges);
    }, [runSimulation]);

    const fetchAttackData = useCallback(async () => {
        try {
            const res = await axios.get(`${API_BASE}/dashboard/stats`, REAL_ONLY_PARAMS);
            const feed = Array.isArray(res.data.feed) ? res.data.feed.map((event, idx) => normalizeEvent(event, `stats-${idx}`)) : [];
            setAllEvents(feed);
            setStats(res.data.summary || { total: 0, critical: 0, blocked: 0 });
            buildGraph(feed, replayProgress);
        } catch (err) { console.error("Graph Sync Error:", err); }
    }, [buildGraph, normalizeEvent, replayProgress]);

    useEffect(() => {
        fetchAttackData();
        const ws = createManagedWebSocket(
            `${WS_BASE}/ws/incidents`,
            {
                onMessage: (event) => {
                    const data = safeParseJson(event.data);
                    if (!data || isSyntheticEvent(data)) return;

                    const normalized = normalizeEvent(data, 'ws');
                    setAllEvents(prev => {
                        const merged = [...prev, normalized];
                        const dedup = new Map();
                        merged.forEach((entry) => {
                            const key = `${entry.id || ''}|${entry.session_id}|${entry.ts}`;
                            dedup.set(key, entry);
                        });
                        return Array.from(dedup.values()).slice(-300);
                    });
                    setStats(prev => ({
                        ...prev,
                        total: (prev.total || 0) + 1,
                        critical: String(normalized.severity).toLowerCase() === 'high' ? (prev.critical || 0) + 1 : (prev.critical || 0)
                    }));
                },
                onError: (err) => console.error("Graph WS parse error:", err),
            },
            { reconnect: true }
        );
        return () => ws.close();
    }, [fetchAttackData, normalizeEvent]);

    useEffect(() => {
        if (isReplaying && replayProgress < 100) {
            timerRef.current = setTimeout(() => {
                setReplayProgress(p => Math.min(100, p + 2));
            }, 100);
        } else if (replayProgress >= 100) {
            setIsReplaying(false);
        }
        return () => clearTimeout(timerRef.current);
    }, [isReplaying, replayProgress]);

    useEffect(() => {
        buildGraph(allEvents, replayProgress);
    }, [replayProgress, allEvents, buildGraph]);

    const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);
    const onNodeClick = (_, node) => setSelectedNode(node);

    const refreshTelemetry = () => {
        setReplayProgress(100);
        setIsReplaying(false);
        fetchAttackData();
    };

    return (
        <div style={{ width: '100%', height: 'calc(100vh - 80px)', color: '#e6edf3', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="cyber-grid" />

            {/* --- Elite Header Panel --- */}
            <header style={{
                padding: '32px 40px',
                borderBottom: '1px solid #30363d',
                zIndex: 100,
                background: 'rgba(1, 4, 9, 0.8)',
                backdropFilter: 'blur(10px)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <Network size={24} color="#3fb950" />
                        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '900', color: '#e6edf3' }}>Attack Graph Visualization</h1>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#8b949e' }}>Graph-based modeling of multi-stage adversary progression and lateral movement</p>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '6px 16px', borderRadius: '12px', border: '1px solid #30363d' }}>
                        <button onClick={() => setIsReplaying(!isReplaying)} style={{ background: 'none', border: 'none', color: '#58a6ff', cursor: 'pointer' }}>
                            {isReplaying ? <Pause size={18} /> : <Play size={18} />}
                        </button>
                        <input
                            type="range"
                            min="0" max="100"
                            value={replayProgress}
                            onChange={(e) => {
                                setReplayProgress(parseInt(e.target.value));
                                setIsReplaying(false);
                            }}
                            style={{ width: '150px', accentColor: '#3fb950' }}
                        />
                        <button onClick={() => { setReplayProgress(0); setIsReplaying(true); }} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer' }}>
                            <RotateCcw size={16} />
                        </button>
                        <span style={{ fontSize: '10px', color: '#8b949e', fontWeight: '900', minWidth: '35px' }}>{replayProgress}%</span>
                    </div>

                    <button
                        onClick={refreshTelemetry}
                        style={{
                            background: 'rgba(35, 134, 54, 0.1)',
                            border: '1px solid #238636',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            color: '#3fb950',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: '0.2s'
                        }}
                    >
                        <RotateCcw size={16} /> REFRESH TELEMETRY
                    </button>
                    <div style={{
                        padding: '10px 20px', background: 'rgba(63,185,80,0.1)',
                        border: '1px solid #3fb950', borderRadius: '24px',
                        color: '#3fb950', fontSize: '12px', fontWeight: '900'
                    }}>SENTINEL: ACTIVE</div>
                </div>
            </header>

            {/* --- Main Workspace --- */}
            <div style={{ flex: 1, position: 'relative' }}>
                {/* --- Velocity HUD --- */}
                <div className="velocity-hud">
                    <div className="hud-item">
                        <span style={{ color: '#8b949e' }}>ATTACK VELOCITY</span>
                        <span style={{ color: derivedMetrics.recentEvents >= 8 ? '#f85149' : '#3fb950' }}>{derivedMetrics.recentEvents}/HR</span>
                    </div>
                    <div className="hud-item" style={{ borderLeft: '3px solid #f85149' }}>
                        <span style={{ color: '#8b949e' }}>ESCALATION RATE</span>
                        <span style={{ color: derivedMetrics.criticalRate >= 35 ? '#f85149' : '#d29922' }}>{derivedMetrics.criticalRate}%</span>
                    </div>
                    <div className="hud-item" style={{ borderLeft: '3px solid #d29922' }}>
                        <span style={{ color: '#8b949e' }}>THREAT MOMENTUM</span>
                        <span style={{ color: derivedMetrics.momentum === 'INCREASING' ? '#f85149' : derivedMetrics.momentum === 'STABLE' ? '#d29922' : '#3fb950' }}>{derivedMetrics.momentum}</span>
                    </div>
                </div>

                {/* --- ReactFlow Canvas --- */}
                <div style={{ position: 'absolute', inset: 0 }}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        fitView
                        minZoom={0.1}
                        maxZoom={1.5}
                    >
                        <Background color="#161b22" size={1} />
                        <Controls />
                    </ReactFlow>
                </div>

                {/* --- AI Inference Sidebar --- */}
                <AnimatePresence>
                    {selectedNode && (
                        <motion.div
                            initial={{ x: 400 }}
                            animate={{ x: 0 }}
                            exit={{ x: 400 }}
                            className="side-panel"
                            style={{ height: 'calc(100vh - 120px)', top: '120px' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Sparkles size={20} color="#58a6ff" />
                                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', letterSpacing: '0.5px' }}>AI_INFERENCE_OVERLAY</h2>
                                </div>
                                <button
                                    onClick={() => setSelectedNode(null)}
                                    style={{ background: 'none', border: 'none', color: '#484f58', cursor: 'pointer' }}
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#484f58', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>TARGETED NODE</div>
                                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#e6edf3' }}>{selectedNode.data.label}</div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <InferenceEntry label="INTENT" value={selectedNode.data.ai_metadata?.intent || selectedNode.data.tactic || 'Discovery'} color="#d29922" />
                                    <InferenceEntry label="CONFIDENCE" value={`${selectedNode.data.ai_metadata?.confidence || 85}%`} color="#3fb950" />
                                    <InferenceEntry label="ENTROPY" value={selectedNode.data.ai_metadata?.entropy || '0.12'} color="#f85149" />
                                    <InferenceEntry label="STRATEGY" value={selectedNode.data.ai_metadata?.mode || "ADAPTIVE_DECEPTION"} color="#58a6ff" />
                                </div>

                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #30363d', borderRadius: '12px', padding: '20px' }}>
                                    <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Activity size={14} color="#3fb950" /> Behavioral Trace Logic
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{
                                            padding: '12px', background: 'rgba(1,4,9,0.4)',
                                            borderLeft: '2px solid #58a6ff', borderRadius: '0 8px 8px 0',
                                            fontSize: '11px', color: '#e6edf3', lineHeight: '1.4'
                                        }}>
                                            {selectedNode.data.ai_metadata?.thought || "Analyzing behavioral patterns for tactical intent..."}
                                        </div>
                                        <div style={{
                                            padding: '12px', background: 'rgba(1,4,9,0.4)',
                                            borderLeft: '2px solid #30363d', borderRadius: '0 8px 8px 0',
                                            fontSize: '11px', color: '#8b949e'
                                        }}>
                                            Node classification: {selectedNode.data.tactic?.toUpperCase() || 'GENERAL_ACTIVITY'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* --- Bottom Metric Panel --- */}
            <div style={{
                padding: '32px 40px',
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px',
                background: '#0d1117', borderTop: '1px solid #30363d',
                zIndex: 100
            }}>
                <MetricBox
                    label="COMPROMISE PROBABILITY"
                    value={`${derivedMetrics.compromiseProbability}%`}
                    color={derivedMetrics.compromiseProbability >= 60 ? '#f85149' : '#d29922'}
                    sub={`Live events: ${allEvents.length}`}
                />
                <MetricBox
                    label="ATTACK COMPLEXITY"
                    value={derivedMetrics.complexityScore}
                    color={Number(derivedMetrics.complexityScore) >= 6 ? '#f85149' : '#d29922'}
                    sub={`Critical ratio: ${derivedMetrics.criticalRate}%`}
                />
                <MetricBox
                    label="DEFENSE EFFECTIVENESS"
                    value={`${derivedMetrics.defenseEffectiveness}%`}
                    color={derivedMetrics.defenseEffectiveness >= 80 ? '#3fb950' : '#d29922'}
                    sub={`Blocked sources: ${stats.blocked || 0}`}
                />
                <MetricBox
                    label="AI RESPONSE LATENCY"
                    value={`${derivedMetrics.latencyMs}ms`}
                    color="#58a6ff"
                    sub="Telemetry correlation"
                />
            </div>
        </div>
    );
};

const InferenceEntry = ({ label, value, color }) => (
    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid #30363d' }}>
        <div style={{ fontSize: '9px', color: '#8b949e', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '12px', fontWeight: '800', color: color }}>{value}</div>
    </div>
);

const MetricBox = ({ label, value, color, sub }) => (
    <div style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '16px',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden'
    }}>
        <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '12px', letterSpacing: '0.5px' }}>{label}</div>
        <div style={{ fontSize: '32px', fontWeight: '950', color: color, marginBottom: '4px' }}>{value}</div>
        <div style={{ fontSize: '11px', color: '#484f58' }}>{sub}</div>
    </div>
);

export default AttackGraph;
