import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { API_BASE } from "./apiConfig";
import { buildAuthHeaders } from "./utils/auth";
import {
    Cpu,
    Send,
    Bot,
    Shield,
    Terminal as TerminalIcon,
    Sparkles,
    FileSearch,
    Globe,
    Activity,
} from 'lucide-react';

const suggestedQueries = [
    "Analyze current threat landscape",
    "Explain typical SQL Injection vectors",
    "Review latest deception strategy effectiveness",
    "Recommend firewall hardening steps"
];

const shouldRetryWithoutApiPrefix = (error) => {
    const status = error?.response?.status;
    const hasResponse = !!error?.response;
    return String(API_BASE).endsWith('/api') && (!hasResponse || status === 404 || status === 405);
};

const askAdvisor = async (payload, timeoutMs = 30000) => {
    const config = {
        timeout: timeoutMs,
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    };
    try {
        return await axios.post(`${API_BASE}/ai/expert-advisor`, payload, config);
    } catch (error) {
        if (!shouldRetryWithoutApiPrefix(error)) {
            throw error;
        }
        return axios.post(`/ai/expert-advisor`, payload, config);
    }
};

const AIChatBot = () => {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "SYSTEM ONLINE. SENTINEL AI COMPANION INITIALIZED. HOW MAY I ASSIST YOUR SECURITY OPERATIONS TODAY?", persona: 'GENERAL_SENTINEL' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [persona, setPersona] = useState('GENERAL_SENTINEL');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const newUserMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, newUserMessage]);
        setInput('');
        setIsLoading(true);

        try {
      console.log('[AI] Sending request to backend...');
      console.log('[AI] API_BASE:', API_BASE);
      console.log('[AI] Request payload:', {
                query: input,
                persona: persona,
                history: messages.slice(-5)
            });

            // Add timeout and better error handling
            const res = await askAdvisor({
                query: input,
                persona: persona,
                history: messages.slice(-5)
            }, 30000);

      console.log('[AI] Received response from backend');
      console.log('[AI] Response:', res.data);

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: res.data.response,
                persona: res.data.persona_active
            }]);
        } catch (error) {
      console.error('[AI] Request failed', error);
      console.error('[AI] Error details:', {
                message: error.message,
                code: error.code,
                response: error.response?.data,
                status: error.response?.status
            });

            // More detailed error messages
            let errorMessage = "CRITICAL ERROR: UPLINK FAILED. PLEASE VERIFY BACKEND STATUS.";

            if (error.code === 'ECONNREFUSED') {
                errorMessage = `ERROR: Cannot connect to backend server. Please ensure backend is reachable at ${API_BASE}.`;
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = `ERROR: Backend server not found. Check if ${API_BASE} is accessible.`;
            } else if (error.response?.status === 404) {
                errorMessage = "ERROR: AI advisor endpoint not found. Backend may not be running properly.";
            } else if (error.response?.status >= 500) {
                errorMessage = "ERROR: Backend server error. Please check backend logs.";
            } else if (error.message.includes('timeout')) {
                errorMessage = "ERROR: Request timed out. Backend may be overloaded or unresponsive.";
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: errorMessage,
                persona: 'GENERAL_SENTINEL'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="premium-scroll" style={{
            display: 'flex',
            flexDirection: 'column',
            color: '#e6edf3',
            fontFamily: "'Roboto', sans-serif",
            height: 'calc(100vh - 80px)'
        }}>
            {/* Header */}
            <header style={{
                padding: '24px 40px',
                borderBottom: '1px solid rgba(56, 189, 248, 0.1)',
                background: 'rgba(13, 17, 23, 0.7)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                boxShadow: '0 4px 30px rgba(0,0,0,0.5)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div className="premium-glass neon-glow-blue" style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Cpu size={24} color="#58a6ff" />
                    </div>
                    <div>
                        <h1 className="text-gradient-blue" style={{ fontSize: '1.5rem', fontWeight: '950', letterSpacing: '-1px', margin: 0 }}>
                            NEURAL_COMMAND_ASSISTANT
                        </h1>
                        <div style={{ fontSize: '10px', color: '#8b949e', fontWeight: '700', letterSpacing: '2px', marginTop: '2px' }}>
              <span style={{ color: '#3fb950' }}>*</span> UPLINK_ENCRYPTED :: QUANTUM_SECURE
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <div className="premium-glass" style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px', color: '#58a6ff', fontWeight: '900', border: '1px solid rgba(88,166,255,0.2)' }}>
                        <Shield size={14} /> CLOAKING_ACTIVE
                    </div>
                </div>
            </header>

            {/* Persona Selection Bar */}
            <nav className="premium-glass" style={{
                margin: '20px 40px 0',
                padding: '8px',
                borderRadius: '16px',
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.05)'
            }}>
                {[
                    { id: 'GENERAL_SENTINEL', label: 'GENERAL_SOC', icon: <Cpu size={14} />, color: '#58a6ff' },
                    { id: 'FORENSICS', label: 'DIGITAL_FORENSICS', icon: <FileSearch size={14} />, color: '#d2a8ff' },
                    { id: 'ARCHITECT', label: 'SYSTEM_ARCHITECT', icon: <Shield size={14} />, color: '#3fb950' },
                    { id: 'INTEL', label: 'THREAT_INTEL', icon: <Globe size={14} />, color: '#f85149' }
                ].map(p => (
                    <button
                        key={p.id}
                        onClick={() => setPersona(p.id)}
                        className={`card-hover-translate ${persona === p.id ? 'neon-glow-blue' : ''}`}
                        style={{
                            background: persona === p.id ? 'rgba(88, 166, 255, 0.1)' : 'transparent',
                            border: `1px solid ${persona === p.id ? p.color : 'transparent'}`,
                            borderRadius: '12px',
                            padding: '10px 18px',
                            color: persona === p.id ? p.color : '#8b949e',
                            fontSize: '11px',
                            fontWeight: '900',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            letterSpacing: '0.5px'
                        }}
                    >
                        {p.icon} {p.label}
                    </button>
                ))}
            </nav>

            {/* Chat Area */}
            <main style={{
                flex: 1,
                maxWidth: '1200px',
                width: '100%',
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                padding: '30px 40px',
                overflowY: 'auto'
            }} className="custom-scrollbar">
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    {messages.map((m, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                display: 'flex',
                                gap: '20px',
                                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '80%'
                            }}
                        >
                            {m.role === 'assistant' && (
                                <div className="premium-glass" style={{
                                    width: '40px', height: '40px', borderRadius: '12px',
                                    border: '1px solid',
                                    borderColor: m.persona === 'FORENSICS' ? '#d2a8ff' : m.persona === 'ARCHITECT' ? '#3fb950' : m.persona === 'INTEL' ? '#f85149' : '#58a6ff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                    boxShadow: `0 0 15px ${m.persona === 'FORENSICS' ? 'rgba(210,168,255,0.2)' : m.persona === 'ARCHITECT' ? 'rgba(63,185,80,0.2)' : m.persona === 'INTEL' ? 'rgba(248,81,73,0.2)' : 'rgba(88,166,255,0.2)'}`
                                }}>
                                    {m.persona === 'FORENSICS' ? <FileSearch size={22} color="#d2a8ff" /> :
                                        m.persona === 'ARCHITECT' ? <Shield size={22} color="#3fb950" /> :
                                            m.persona === 'INTEL' ? <Globe size={22} color="#f85149" /> :
                                                <Bot size={22} color="#58a6ff" />}
                                </div>
                            )}

                            <div className="premium-glass" style={{
                                padding: '18px 22px',
                                borderRadius: m.role === 'user' ? '20px 4px 20px 20px' : '4px 20px 20px 20px',
                                background: 'rgba(31, 35, 40, 0.7)',
                                border: '1px solid rgba(255,255,255,0.04)',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                                minWidth: '200px',
                                maxWidth: '100%',
                                color: '#e6edf3',
                                fontSize: '14px',
                                lineHeight: '1.6',
                                fontWeight: '600'
                            }}>
                                {m.content}
                            </div>
                        </motion.div>
                    ))}
                    {isLoading && (
                        <div style={{ display: 'flex', gap: '20px', alignSelf: 'flex-start' }}>
                            <div className="premium-glass animate-pulse-soft" style={{ width: '40px', height: '40px', borderRadius: '12px', border: '1px solid #58a6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Bot size={22} color="#58a6ff" />
                            </div>
                            <div className="premium-glass" style={{ padding: '20px 24px', borderRadius: '4px 24px 24px 24px', minWidth: '150px' }}>
                                <div className="typing-dots">
                                    <span></span><span></span><span></span>
                                </div>
                                <div style={{ fontSize: '9px', color: '#8b949e', marginTop: '10px', fontWeight: '800' }}>NEURAL_PROCESSING_IN_PROGRESS...</div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </main>

            {/* Input Bar Container */}
            <div style={{
                background: 'linear-gradient(to top, #010409 60%, rgba(1, 4, 9, 0))',
                padding: '20px 40px 40px'
            }}>
                <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
                    {/* Suggestions */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px', justifyContent: 'center' }}>
                        {suggestedQueries.map((q, i) => (
                            <button
                                key={i}
                                onClick={() => setInput(q)}
                                className="premium-glass card-hover-translate"
                                style={{
                                    background: 'rgba(48, 54, 61, 0.4)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '20px',
                                    padding: '8px 18px',
                                    fontSize: '11px',
                                    color: '#8b949e',
                                    cursor: 'pointer',
                                    transition: '0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontWeight: '600'
                                }}
                            >
                                <Sparkles size={12} color="#f1e05a" /> {q}
                            </button>
                        ))}
                    </div>

                    {/* Main Input */}
                    <div className="premium-glass" style={{
                        padding: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                        borderRadius: '20px',
                        border: '1px solid rgba(56, 189, 248, 0.2)'
                    }}>
                        <div style={{ padding: '0 16px', color: '#58a6ff' }}>
                            <TerminalIcon size={20} />
                        </div>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Consult Neural Expert Cluster..."
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                color: '#e6edf3',
                                fontSize: '15px',
                                outline: 'none',
                                padding: '14px 0',
                                fontWeight: '500'
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className={input.trim() ? 'neon-glow-blue' : ''}
                            style={{
                                background: input.trim() ? '#1f6feb' : '#161b22',
                                color: 'white',
                                border: 'none',
                                borderRadius: '14px',
                                width: '48px',
                                height: '48px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: '0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                            }}
                        >
                            {isLoading ? <Activity size={20} className="animate-spin" /> : <Send size={20} />}
                        </button>
                    </div>
                </div>
            </div>

            <style>
                {`
                .typing-dots { display: flex; gap: 6px; }
                .typing-dots span { width: 8px; height: 8px; background: #58a6ff; border-radius: 50%; animation: blink 1.4s infinite both; }
                .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
                .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes blink { 0%, 80%, 100% { opacity: 0; } 40% { opacity: 1; } }
                `}
            </style>
        </div>
    );
};

export default AIChatBot;

