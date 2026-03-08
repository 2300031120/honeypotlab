import React, { useState, useEffect, useRef } from 'react';
import axios from "axios";
import { API_BASE } from "./apiConfig";
import { buildAuthHeaders } from "./utils/auth";
import { ArrowLeft, Activity, Brain, Shield, Zap, AlertTriangle } from 'lucide-react';

const Terminal = () => {
    const [history, setHistory] = useState([
        { type: 'output', content: 'Linux honeypot 5.15.0-virtual x86_64 GNU/Linux' },
        { type: 'output', content: 'System initialized. logical volume management... ok' },
        { type: 'output', content: 'Welcome to Ubuntu 22.04.3 LTS (GNU/Linux 5.15.0-91-generic x86_64)' },
        { type: 'output', content: ' ' },
        { type: 'output', content: ' * Documentation:  https://help.ubuntu.com' },
        { type: 'output', content: ' * Management:     https://landscape.canonical.com' },
        { type: 'output', content: ' * Support:        https://ubuntu.com/advantage' },
        { type: 'output', content: ' ' },
        { type: 'output', content: 'Last login: ' + new Date().toUTCString() + ' from 10.0.2.2' }
    ]);
    const [input, setInput] = useState('');
    const [prompt, setPrompt] = useState('admin@honeypot:~$');
    const [isTyping, setIsTyping] = useState(false);
    const [cmdHistory, setCmdHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const inputRef = useRef(null);
    const bottomRef = useRef(null);

    const [aiMetadata, setAiMetadata] = useState(null);
    const [executionMode, setExecutionMode] = useState("emulated");
    const [executionStatus, setExecutionStatus] = useState("idle");

    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    useEffect(() => {
        if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [history, isTyping]);

    const getScoreColor = (score) => {
        if (score >= 80) return '#f85149'; // Red
        if (score >= 60) return '#d29922'; // Orange
        if (score >= 30) return '#e3b341'; // Yellow
        return '#3fb950'; // Green
    };

    const handleKeyDown = async (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (cmdHistory.length > 0) {
                const newIndex = historyIndex < cmdHistory.length - 1 ? historyIndex + 1 : historyIndex;
                setHistoryIndex(newIndex);
                setInput(cmdHistory[cmdHistory.length - 1 - newIndex]);
            }
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setInput(cmdHistory[cmdHistory.length - 1 - newIndex]);
            } else {
                setHistoryIndex(-1);
                setInput('');
            }
            return;
        }

        if (e.key === 'Enter') {
            const cmd = input.trim();
            if (cmd === 'clear') {
                setHistory([]);
                setInput('');
                setAiMetadata(null);
                setExecutionStatus("idle");
                return;
            }

            const newHistory = [...history, { type: 'input', content: `${prompt} ${cmd} ` }];
            setHistory(newHistory);
            setInput('');

            if (cmd !== '') {
                setCmdHistory(prev => [...prev, cmd]);
                setHistoryIndex(-1);
            }

            if (cmd === '') return;

            setIsTyping(true);
            try {
                const res = await axios.post(
                    `${API_BASE}/terminal/cmd`,
                    { cmd: cmd },
                    {
                        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
                        timeout: 30000,
                    }
                );

                if (res.data.ai_metadata) {
                    setAiMetadata(res.data.ai_metadata);
                }
                setExecutionMode(String(res.data.execution_mode || "emulated").toLowerCase());
                setExecutionStatus(String(res.data.execution_status || "ok").toLowerCase());

                // Simulate typing effect
                const outputLines = (res.data.output || '').split('\n');
                for (let i = 0; i < outputLines.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, 30));
                    setHistory(prev => [...prev, { type: 'output', content: outputLines[i] }]);
                }
                setPrompt(res.data.prompt || "admin@honeypot:~$");
            } catch (err) {
                const detail = err?.response?.data?.detail || err?.message || "Backend unavailable";
                const output = `terminal-error: command execution failed (${detail})`;
                setExecutionStatus("error");
                const outputLines = output.split('\n');
                for (let i = 0; i < outputLines.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, 30));
                    setHistory(prev => [...prev, { type: 'output', content: outputLines[i] }]);
                }
            } finally {
                setIsTyping(false);
            }
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', color: '#e6edf3' }}>
            <div style={{ width: '100%', maxWidth: '1400px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', width: '100%', maxWidth: '1400px' }}>
                <div className="terminal-wrapper" style={{ width: '100%' }}>
                    <div className="terminal-header" style={{ padding: '8px 16px' }}>
                        <div className="terminal-buttons">
                            <span className="close" style={{ width: '10px', height: '10px' }}></span>
                            <span className="minimize" style={{ width: '10px', height: '10px' }}></span>
                            <span className="maximize" style={{ width: '10px', height: '10px' }}></span>
                        </div>
                        <div className="terminal-title" style={{ fontSize: '12px' }}>
                            <Activity size={12} style={{ marginRight: '6px', display: 'inline' }} />
                            admin@honeypot: ~
                        </div>
                    </div>
                    <div className="terminal-container" style={{ height: '75vh', fontSize: '12px' }} onClick={() => inputRef.current.focus()}>
                        <div className="terminal-output">
                            {history.map((line, i) => (
                                <div key={i} className={`line ${line.type} `}>
                                    {line.content}
                                </div>
                            ))}
                            {isTyping && <div className="line typing">Processing...</div>}
                            <div ref={bottomRef} />
                        </div>
                        <div className="terminal-input-line">
                            <span className="prompt">{prompt}</span>
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                autoFocus
                                disabled={isTyping}
                                spellCheck="false"
                                autoComplete="off"
                            />
                            <span className="cursor"></span>
                        </div>
                    </div>
                </div>

                <div className="terminal-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '16px', padding: '18px' }}>
                        <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '8px', fontWeight: '700' }}>EXECUTION ENGINE</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                            <span style={{ color: '#8b949e' }}>Mode</span>
                            <span style={{ color: executionMode === 'real' ? '#3fb950' : '#d29922', fontWeight: '800' }}>
                                {executionMode === 'real' ? 'REAL SANDBOX' : 'EMULATED'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span style={{ color: '#8b949e' }}>Status</span>
                            <span style={{ color: executionStatus === 'ok' ? '#3fb950' : executionStatus === 'blocked' ? '#f85149' : '#e3b341', fontWeight: '800' }}>
                                {executionStatus.toUpperCase()}
                            </span>
                        </div>
                    </div>

                    {/* Threat Score Meter */}
                    <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
                        <h4 style={{ margin: '0 0 20px', fontSize: '14px', color: '#8b949e' }}>REAL-TIME THREAT SCORE</h4>
                        <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto' }}>
                            <svg width="120" height="120" viewBox="0 0 120 120">
                                <circle cx="60" cy="60" r="50" fill="none" stroke="#21262d" strokeWidth="8" />
                                <circle cx="60" cy="60" r="50" fill="none"
                                    stroke={getScoreColor(aiMetadata?.confidence || 0)}
                                    strokeWidth="8"
                                    strokeDasharray={`${(aiMetadata?.confidence || 0) * 3.14}, 314`}
                                    strokeLinecap="round"
                                    transform="rotate(-90 60 60)"
                                    style={{ transition: 'stroke-dasharray 0.5s ease-out' }}
                                />
                            </svg>
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                                <div style={{ fontSize: '24px', fontWeight: '900', color: getScoreColor(aiMetadata?.confidence || 0) }}>
                                    {aiMetadata?.confidence || 0}
                                </div>
                                <div style={{ fontSize: '10px', color: '#8b949e' }}>SCORE</div>
                            </div>
                        </div>
                    </div>

                    {/* Technique Detection / Vulnerability Panel */}
                    {aiMetadata && aiMetadata.vulnerabilities && aiMetadata.vulnerabilities.length > 0 && (
                        <div style={{ background: 'rgba(210,153,34,0.05)', border: '1px solid rgba(210,153,34,0.2)', borderRadius: '16px', padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#d29922' }}>
                                <AlertTriangle size={18} />
                                <span style={{ fontSize: '12px', fontWeight: '800' }}>VULNERABILITY PROBES</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {aiMetadata.vulnerabilities.map((v, i) => (
                                    <div key={i} style={{ background: '#0d1117', border: '1px solid #30363d', padding: '10px', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#e6edf3' }}>{v.type}</span>
                                            <span style={{ fontSize: '9px', background: v.severity === 'High' ? '#f85149' : '#d29922', color: 'white', padding: '1px 4px', borderRadius: '3px' }}>{v.severity}</span>
                                        </div>
                                        <div style={{ fontSize: '10px', color: '#8b949e', fontFamily: 'monospace' }}>Vector: {v.vector}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* AI Explanation Panel */}
                    {aiMetadata && (
                        <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '16px', padding: '20px', animation: 'slideInRight 0.3s ease-out' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#58a6ff' }}>
                                <Brain size={18} />
                                <span style={{ fontSize: '12px', fontWeight: '800' }}>AI ANALYTICS</span>
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ fontSize: '10px', color: '#8b949e', marginBottom: '2px' }}>INTENT</div>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#e6edf3' }}>{aiMetadata.intent}</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#8b949e', marginBottom: '2px' }}>STAGE</div>
                                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#a5d6ff' }}>{aiMetadata.mitre_tactic || aiMetadata.stage}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', color: '#8b949e', marginBottom: '2px' }}>ENTROPY</div>
                                    <div style={{ fontSize: '12px', fontWeight: '700', color: aiMetadata.entropy > 0.6 ? '#f85149' : '#3fb950' }}>{aiMetadata.entropy || '0.12'}</div>
                                </div>
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ fontSize: '10px', color: '#8b949e', marginBottom: '2px' }}>MITRE TECHNIQUE</div>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#f59e0b' }}>{aiMetadata.mitre_technique || 'T1059'}</div>
                            </div>
                            <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(88,166,255,0.05)', borderRadius: '8px', border: '1px solid rgba(88,166,255,0.1)' }}>
                                <div style={{ fontSize: '9px', color: '#58a6ff', marginBottom: '4px', fontWeight: '800' }}>NEURAL THOUGHT</div>
                                <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#8b949e', lineHeight: '1.4' }}>
                                    "{aiMetadata.thought || 'Analyzing behavioral patterns for tactical intent...'}"
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '10px', color: '#8b949e', marginBottom: '2px' }}>EXPLANATION</div>
                                <div style={{ fontSize: '11px', lineHeight: '1.4', color: '#8b949e' }}>
                                    "{aiMetadata.explanation}"
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Terminal;
