import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Target, BookOpen, Star, ArrowRight, Github } from 'lucide-react';

const About = () => {
    return (
        <div style={{ color: '#e6edf3', padding: '60px 20px' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>

                <header style={{ marginBottom: '60px' }}>
                    <h1 style={{ fontSize: '3.5rem', fontWeight: '900', marginBottom: '16px', background: 'linear-gradient(135deg, #58a6ff, #3fb950)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        About the Project
                    </h1>
                    <p style={{ color: '#8b949e', fontSize: '1.25rem', lineHeight: '1.6' }}>
                        Transforming cybersecurity defense from reactive to proactive using Autonomous AI-Driven Deception.
                    </p>
                </header>

                <section style={{ marginBottom: '60px' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.5rem', marginBottom: '24px' }}>
                        <Target color="#f85149" /> Project Objective
                    </h2>
                    <p style={{ color: '#8b949e', lineHeight: '1.8' }}>
                        The primary goal of this platform is to build a high-interaction honeypot that doesn't just sit and log data, but actively engages with attackers.
                        By leveraging Large Language Models (LLMs) and behavioral anomaly detection, the system can dynamically adjust its personality to waste attacker time,
                        uncover their tactics, and safeguard real infrastructure.
                    </p>
                </section>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '60px' }}>
                    <section>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.25rem', marginBottom: '16px' }}>
                            <Star color="#d29922" /> Research Novelty
                        </h2>
                        <ul style={{ color: '#8b949e', paddingLeft: '20px', lineHeight: '2' }}>
                            <li>Stateful LLM-driven shell responses</li>
                            <li>Autonomous deception escalation</li>
                            <li>Real-time behavioral fingerprinting</li>
                            <li>AI-generated dynamic decoys</li>
                        </ul>
                    </section>
                    <section>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.25rem', marginBottom: '16px' }}>
                            <BookOpen color="#58a6ff" /> Future Work
                        </h2>
                        <ul style={{ color: '#8b949e', paddingLeft: '20px', lineHeight: '2' }}>
                            <li>Multi-node cluster deception</li>
                            <li>Automated exploit reverse-engineering</li>
                            <li>Deep-learning based attacker profiling</li>
                        </ul>
                    </section>
                </div>

                <div style={{
                    background: '#0d1117', border: '1px solid #30363d', borderRadius: '24px',
                    padding: '40px', textAlign: 'center'
                }}>
                    <h2 style={{ marginBottom: '24px' }}>Ready to explore the core?</h2>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            <Link to="/auth/signup" style={{
                            padding: '12px 30px', background: '#238636', color: 'white',
                            borderRadius: '8px', textDecoration: 'none', fontWeight: '700'
                        }}>
                            Get Started
                        </Link>
                        <Link to="/lab/architecture" style={{
                            padding: '12px 30px', border: '1px solid #30363d', color: '#e6edf3',
                            borderRadius: '8px', textDecoration: 'none', fontWeight: '600'
                        }}>
                            View Architecture
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default About;
