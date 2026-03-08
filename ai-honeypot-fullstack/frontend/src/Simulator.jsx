import React, { useState, useEffect, useRef } from 'react';
import {
    Play, RotateCcw, ShieldAlert, Terminal, Eye,
    AlertCircle, CheckCircle2, Zap, Target,
    ChevronRight, Activity, Cpu, Shield,
    Lock, Search, Share2, Fingerprint, Database,
    Info, Sparkles, Network, Terminal as TerminalIcon,
    XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import * as d3 from 'd3';
import { API_BASE } from './apiConfig';

const Simulator = () => {
    const [activeScenario, setActiveScenario] = useState(null);
    const [step, setStep] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState([]);
    const svgRef = useRef();
    const logEndRef = useRef();

    const scenarios = [
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

    // --- D3 Network Graph Logic ---
    useEffect(() => {
        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);
        const width = svgRef.current.clientWidth;
        const height = svgRef.current.clientHeight;
        svg.selectAll("*").remove();

        const nodes = [
            { id: 'Honeypot_Core', type: 'core', val: 20 },
            { id: 'Auth_Gateway', type: 'service', val: 12 },
            { id: 'DB_Cluster', type: 'service', val: 12 },
            { id: 'Web_Front', type: 'service', val: 12 },
            { id: 'Attacker_Node', type: 'attacker', val: 15 }
        ];

        const links = [
            { source: 'Attacker_Node', target: 'Web_Front' },
            { source: 'Web_Front', target: 'Auth_Gateway' },
            { source: 'Auth_Gateway', target: 'Honeypot_Core' },
            { source: 'Honeypot_Core', target: 'DB_Cluster' }
        ];

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2));

        const link = svg.append("g")
            .attr("stroke", "rgba(56, 189, 248, 0.2)")
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke-width", 2);

        const node = svg.append("g")
            .selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("r", d => d.val)
            .attr("fill", d => d.type === 'attacker' ? '#f85149' : (d.type === 'core' ? '#3fb950' : '#58a6ff'))
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .call(d3.drag()
                .on("start", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on("drag", (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on("end", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }));

        node.append("title").text(d => d.id);

        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        });

        return () => simulation.stop();
    }, [isRunning]);

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
        } else if (step === activeScenario?.steps.length && isRunning) {
            setIsRunning(false);
            setLogs(prev => [...prev, {
                msg: `SIMULATION_COMPLETE: All objectives achieved. Behavior model synchronized.`,
                type: 'success',
                ts: new Date().toLocaleTimeString()
            }]);
        }
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
                    {/* Visualizer (D3 Relationship Graph) */}
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
                        <svg ref={svgRef} style={{ width: '100%', height: '100%' }}></svg>
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

