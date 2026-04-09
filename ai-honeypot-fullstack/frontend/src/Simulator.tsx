import React, { useState, useEffect, useRef } from 'react';
import {
    Play, Terminal, Zap, Target,
    Activity, Lock, Database,
    XCircle
} from 'lucide-react';
import { motion } from './utils/motionLite';
import axios from 'axios';
import { API_BASE } from './apiConfig';

type Scenario = {
    id: number;
    title: string;
    desc: string;
    steps: string[];
    severity: 'critical' | 'high';
    icon: React.ElementType;
    color: string;
};

type SimulationLog = {
    msg: string;
    type: 'info' | 'exec' | 'error' | 'success';
    ts: string;
};

type TopologyNode = {
    id: string;
    label: string;
    type: 'attacker' | 'service' | 'core';
    x: number;
    y: number;
    radius: number;
    color: string;
};

type TopologyLink = {
    id: string;
    source: string;
    target: string;
};

const Simulator = () => {
    const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
    const [step, setStep] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState<SimulationLog[]>([]);
    const logEndRef = useRef<HTMLDivElement | null>(null);

    const scenarios: Scenario[] = [
        {
            id: 1,
            title: 'Neural Web Shell Injection',
            desc: 'Simulates a high-level exploit chain involving remote code execution and web shell persistence.',
            steps: ['Port Scan / Discovery', 'Vuln Identification', 'Payload Delivery (RCE)', 'Web Shell Installation', 'Persistence Setup'],
            severity: 'critical',
            icon: Target,
            color: '#f85149'
        },
        {
            id: 2,
            title: 'Adversary Credential Stuffing',
            desc: 'Automated replay of leaked credentials against neural authentication gateways.',
            steps: ['IP Rotation Chain', 'Auth Gateway Probing', 'Login Attempt (Batch)', 'Session Validation', 'Token Extraction'],
            severity: 'high',
            icon: Lock,
            color: '#d29922'
        },
        {
            id: 3,
            title: 'Exfiltration: S3 Bucket Leak',
            desc: 'Simulation of lateral movement and stealthy extraction of architectural data.',
            steps: ['Privilege Escalation', 'Discovery: S3 Metadata', 'Cloud DB Dump', 'Data Compression', 'Stealth DNS Tunneling'],
            severity: 'critical',
            icon: Database,
            color: '#f85149'
        }
    ];

    const topologyNodes: TopologyNode[] = [
        { id: 'Attacker_Node', label: 'ATTACKER', type: 'attacker', x: 120, y: 226, radius: 16, color: '#f85149' },
        { id: 'Web_Front', label: 'WEB_FRONT', type: 'service', x: 320, y: 132, radius: 12, color: '#58a6ff' },
        { id: 'Auth_Gateway', label: 'AUTH_GATEWAY', type: 'service', x: 520, y: 260, radius: 12, color: '#58a6ff' },
        { id: 'Honeypot_Core', label: 'HONEYPOT_CORE', type: 'core', x: 720, y: 156, radius: 20, color: '#3fb950' },
        { id: 'DB_Cluster', label: 'DB_CLUSTER', type: 'service', x: 900, y: 284, radius: 12, color: '#58a6ff' },
    ];

    const topologyLinks: TopologyLink[] = [
        { id: 'l1', source: 'Attacker_Node', target: 'Web_Front' },
        { id: 'l2', source: 'Web_Front', target: 'Auth_Gateway' },
        { id: 'l3', source: 'Auth_Gateway', target: 'Honeypot_Core' },
        { id: 'l4', source: 'Honeypot_Core', target: 'DB_Cluster' },
    ];

    const activeLinkCount = isRunning ? Math.min(step + 1, topologyLinks.length) : activeScenario ? 1 : 0;
    const activeNodeCount = isRunning ? Math.min(step + 2, topologyNodes.length) : activeScenario ? 2 : 0;
    const activeNodeIds = new Set(topologyNodes.slice(0, activeNodeCount).map((node) => node.id));
    const topologyNodeLookup = Object.fromEntries(topologyNodes.map((node) => [node.id, node])) as Record<string, TopologyNode>;

    const startSimulation = () => {
        if (!activeScenario) return;
        setIsRunning(true);
        setStep(0);
        setLogs([{
            msg: `SYSTEM_INIT: Deploying synthetic adversary model for ${activeScenario.title.toUpperCase()}`,
            type: 'info',
            ts: new Date().toLocaleTimeString()
        }]);
    };

    const stopSimulation = () => {
        setIsRunning(false);
        setLogs(prev => [...prev, {
            msg: `SIMULATION_ABORTED: Campaign terminated by operator.`,
            type: 'error',
            ts: new Date().toLocaleTimeString()
        }]);
    };

    useEffect(() => {
        if (isRunning && activeScenario && step < activeScenario.steps.length) {
            const timer = setTimeout(async () => {
                const currentPhase = activeScenario.steps[step];
                setLogs(prev => [...prev, {
                    msg: `EXECUTE [Phase 0${step + 1}]: ${currentPhase}`,
                    type: 'exec',
                    ts: new Date().toLocaleTimeString()
                }]);

                try {
                    await axios.post(`${API_BASE}/simulator/inject`, {
                        cmd: currentPhase,
                        title: activeScenario.title
                    });
                } catch (err) {
                    console.error("Simulation injection failed", err);
                }

                setStep(prev => prev + 1);
            }, 2000);
            return () => clearTimeout(timer);
        }

        if (step === activeScenario?.steps.length && isRunning) {
            setIsRunning(false);
            setLogs(prev => [...prev, {
                msg: `SIMULATION_COMPLETE: All objectives achieved. Behavior model synchronized.`,
                type: 'success',
                ts: new Date().toLocaleTimeString()
            }]);
        }

        return undefined;
    }, [isRunning, step, activeScenario]);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="premium-scroll" style={{ padding: '40px 60px', color: '#e6edf3', fontFamily: "'Roboto', sans-serif" }}>
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 className="text-gradient-blue" style={{
                        margin: 0,
                        fontSize: '2.8rem',
                        fontWeight: '950',
                        letterSpacing: '-1.5px'
                    }}>
                        NEURAL_WAR_ROOM
                    </h1>
                    <p style={{ margin: '8px 0 0', color: '#8b949e', fontSize: '15px', fontWeight: '500' }}>Simulate high-fidelity multi-stage adversary campaign models against neural defense clusters.</p>
                </div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div className="premium-glass neon-glow-blue" style={{ padding: '12px 24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(88,166,255,0.2)' }}>
                        <Activity size={18} color="#58a6ff" className="animate-pulse" />
                        <span style={{ fontSize: '11px', fontWeight: '950', color: '#58a6ff', letterSpacing: '2px' }}>SIM_ENGINE_READY</span>
                    </div>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) 2fr', gap: '32px' }}>
                {/* Scenario Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="premium-glass" style={{ padding: '24px', borderRadius: '24px', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
                        <h3 className="text-gradient-blue" style={{ margin: '0 0 20px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '900' }}>
                            <Zap size={20} /> ADVERSARY_MODELS
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {scenarios.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => !isRunning && setActiveScenario(s)}
                                    className={`premium-glass card-hover-translate ${activeScenario?.id === s.id ? 'neon-glow-blue' : ''}`}
                                    style={{
                                        padding: '20px',
                                        borderRadius: '16px',
                                        cursor: isRunning ? 'not-allowed' : 'pointer',
                                        background: activeScenario?.id === s.id ? 'rgba(88, 166, 255, 0.08)' : 'rgba(1, 4, 9, 0.3)',
                                        border: `1px solid ${activeScenario?.id === s.id ? s.color : 'rgba(48, 54, 61, 0.5)'} `,
                                        transition: '0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '12px' }}>
                                        <div className="premium-glass" style={{ padding: '8px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)' }}>
                                            <s.icon size={20} color={s.color} />
                                        </div>
                                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '900', letterSpacing: '0.3px' }}>{s.title.toUpperCase()}</h4>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#8b949e', lineHeight: '1.6', fontWeight: '500' }}>{s.desc}</p>
                                    <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '10px', color: s.color, fontWeight: '950', background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: '20px', border: `1px solid ${s.color}22` }}>
                                            {s.severity.toUpperCase()}
                                        </span>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            {[...Array(5)].map((_, i) => (
                                                <div key={i} style={{ width: '4px', height: '10px', background: i < s.id + 1 ? s.color : '#21262d', borderRadius: '2px' }}></div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={isRunning ? stopSimulation : startSimulation}
                        disabled={!activeScenario}
                        className={`premium-glass card-hover-translate ${isRunning ? 'neon-glow-red' : 'neon-glow-blue'}`}
                        style={{
                            width: '100%',
                            padding: '18px',
                            borderRadius: '16px',
                            background: isRunning ? 'linear-gradient(135deg, #f85149, #b91c1c)' : 'linear-gradient(135deg, #1f6feb, #111827)',
                            color: 'white',
                            border: 'none',
                            fontSize: '15px',
                            fontWeight: '950',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            boxShadow: isRunning ? '0 10px 30px rgba(248,81,73,0.3)' : '0 10px 30px rgba(31,111,235,0.3)',
                            letterSpacing: '2px'
                        }}
                    >
                        {isRunning ? <XCircle size={22} /> : <Play size={22} />}
                        {isRunning ? 'ABORT_CAMPAIGN' : 'DEPLOY_ADVERSARY'}
                    </button>
                </div>

                {/* Main Viewport */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    {/* Visualizer (Relationship Graph) */}
                    <div className="premium-glass" style={{
                        borderRadius: '28px',
                        height: '450px',
                        background: 'rgba(1, 4, 9, 0.4)',
                        position: 'relative',
                        border: '1px solid rgba(56, 189, 248, 0.1)',
                        overflow: 'hidden',
                        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.8)'
                    }}>
                        <div style={{ position: 'absolute', top: '24px', left: '24px', zIndex: 5, pointerEvents: 'none' }}>
                            <div style={{ fontSize: '10px', color: '#58a6ff', fontWeight: '950', letterSpacing: '2px', marginBottom: '8px' }}>NEURAL_NETWORK_TOPOLOGY</div>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#8b949e' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#58a6ff' }}></div> NODE_SENTINEL
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#8b949e' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f85149' }}></div> ACTOR_CLUSTERS
                                </div>
                            </div>
                        </div>
                        <svg viewBox="0 0 1000 450" style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
                            <defs>
                                <linearGradient id="simLinkActive" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#f85149" />
                                    <stop offset="50%" stopColor="#58a6ff" />
                                    <stop offset="100%" stopColor="#3fb950" />
                                </linearGradient>
                            </defs>

                            <g opacity="0.22">
                                {Array.from({ length: 8 }).map((_, idx) => (
                                    <line key={`grid-x-${idx}`} x1={120 + (idx * 100)} y1="40" x2={120 + (idx * 100)} y2="390" stroke="rgba(48,54,61,0.45)" />
                                ))}
                                {Array.from({ length: 4 }).map((_, idx) => (
                                    <line key={`grid-y-${idx}`} x1="60" y1={90 + (idx * 90)} x2="940" y2={90 + (idx * 90)} stroke="rgba(48,54,61,0.35)" />
                                ))}
                            </g>

                            {topologyLinks.map((link, index) => {
                                const source = topologyNodeLookup[link.source];
                                const target = topologyNodeLookup[link.target];
                                const isActive = index < activeLinkCount;
                                if (!source || !target) return null;

                                const path = `M ${source.x} ${source.y} C ${(source.x + target.x) / 2} ${source.y - 40}, ${(source.x + target.x) / 2} ${target.y - 40}, ${target.x} ${target.y}`;

                                return (
                                    <g key={link.id}>
                                        <path
                                            d={path}
                                            fill="none"
                                            stroke={isActive ? 'url(#simLinkActive)' : 'rgba(56,189,248,0.2)'}
                                            strokeWidth={isActive ? 4 : 2}
                                            strokeLinecap="round"
                                        />
                                        {isActive && (
                                            <circle r="4" fill="#58a6ff">
                                                <animateMotion dur="1.8s" repeatCount="indefinite" path={path} />
                                            </circle>
                                        )}
                                    </g>
                                );
                            })}

                            {topologyNodes.map((node, index) => {
                                const isActive = activeNodeIds.has(node.id);
                                return (
                                    <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                                        <circle
                                            r={node.radius + (isActive ? 10 : 5)}
                                            fill={isActive ? `${node.color}18` : 'rgba(22,27,34,0.4)'}
                                            stroke="none"
                                        />
                                        <circle
                                            r={node.radius}
                                            fill="#0d1117"
                                            stroke={node.color}
                                            strokeWidth={isActive ? 3 : 1.5}
                                        />
                                        {isActive && (
                                            <circle r={node.radius + 6} fill="none" stroke={node.color} strokeOpacity="0.38">
                                                <animate attributeName="r" values={`${node.radius + 4};${node.radius + 10};${node.radius + 4}`} dur="2.2s" repeatCount="indefinite" />
                                                <animate attributeName="stroke-opacity" values="0.35;0.08;0.35" dur="2.2s" repeatCount="indefinite" />
                                            </circle>
                                        )}
                                        <text x="0" y={node.radius + 22} textAnchor="middle" fill="#c9d1d9" style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 800 }}>
                                            {node.label}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>

                    {/* Elite X-TERM Console */}
                    <div className="premium-glass" style={{
                        flex: 1,
                        background: '#010409',
                        borderRadius: '24px',
                        border: '1px solid rgba(56, 189, 248, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}>
                        <div className="premium-glass" style={{ padding: '12px 24px', background: 'rgba(22, 27, 34, 0.6)', borderBottom: '1px solid rgba(48, 54, 61, 0.8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Terminal size={14} color="#58a6ff" />
                                <span style={{ fontSize: '11px', color: '#8b949e', fontWeight: '900', letterSpacing: '1px' }}>X-TERM :: NEURAL_SHELL_v4.2</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#3fb950' }}></div>
                                <div className="animate-pulse-soft" style={{ fontSize: '9px', color: '#3fb950', fontWeight: '900' }}>BUFFER_SYNCED</div>
                            </div>
                        </div>
                        <div className="custom-scrollbar" style={{ flex: 1, padding: '24px', overflowY: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', lineHeight: '1.8' }}>
                            {logs.length === 0 ? (
                                <div style={{ color: '#30363d', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
                                    [SYSTEM] WAITING FOR ADVERSARY INITIALIZATION...
                                </div>
                            ) : (
                                logs.map((log, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        style={{ marginBottom: '8px' }}
                                    >
                                        <span style={{ color: '#30363d', marginRight: '15px' }}>[{log.ts}]</span>
                                        <span style={{
                                            color: log.type === 'success' ? '#3fb950' :
                                                log.type === 'exec' ? '#d2a8ff' :
                                                    log.type === 'info' ? '#58a6ff' : '#8b949e',
                                            fontWeight: '700'
                                        }}>
                                            {log.type === 'success' ? '[FIXED]' :
                                                log.type === 'exec' ? '[EXEC]' :
                                                    log.type === 'info' ? '[INIT]' : '[STAT]'}
                                        </span>
                                        <span style={{ color: '#e6edf3', marginLeft: '12px', fontWeight: '500' }}> {log.msg}</span>
                                    </motion.div>
                                ))
                            )}
                            <div ref={logEndRef} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Simulator;

