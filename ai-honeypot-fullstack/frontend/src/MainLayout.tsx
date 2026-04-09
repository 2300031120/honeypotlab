import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import axios from "axios";
import "./styles.css";
import {
    Activity, Shield, AlertTriangle, Terminal as TerminalIcon, FileSearch, LogOut,
    Wifi, Clock, BarChart3, Globe as GlobeIcon, Target, Fingerprint, Settings, Network, HeartPulse,
    Bot, MessageSquare, Sparkles, Cpu, ShieldAlert, ChevronRight, Zap, Target as TargetIcon, Info, BookOpen, Link2
} from "lucide-react";
import { API_BASE } from "./apiConfig";
import { PUBLIC_SITE } from "./siteConfig";
import { buildAuthHeaders, clearAuthSession, getUserProfile, setAuthSession } from "./utils/auth";

import { motion } from "./utils/motionLite";

const MainLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
    const [userProfile, setUserProfile] = useState(() => getUserProfile());
    const productLabel = String(PUBLIC_SITE.shortName || PUBLIC_SITE.siteName || "CyberSentil").trim().toUpperCase();

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const syncUserProfile = async () => {
            try {
                const res = await axios.get(`${API_BASE}/auth/me`);
                const nextProfile = {
                    username: res.data?.username || userProfile?.username || "operator",
                    role: res.data?.role || userProfile?.role || "analyst",
                    email: res.data?.email || userProfile?.email || null,
                };
                setUserProfile(nextProfile);
                setAuthSession(nextProfile);
            } catch {
                // Keep local profile if /auth/me fails.
            }
        };
        syncUserProfile();
    }, []);

    const logout = async () => {
        try {
            await axios.post(`${API_BASE}/auth/logout`, {}, { headers: buildAuthHeaders() });
        } catch {
            // Best-effort server revoke; local cleanup still completes.
        } finally {
            clearAuthSession();
            navigate("/auth/login");
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', background: '#010409', color: '#e6edf3', fontFamily: "var(--font-body)", overflow: 'hidden' }}>
            <div className="cyber-grid" />

            {/* Sidebar */}
            <aside className="premium-scroll" style={{
                width: '280px', background: 'rgba(13, 17, 23, 0.95)', borderRight: '1px solid #30363d',
                padding: '32px 20px', display: 'flex', flexDirection: 'column', flexShrink: 0,
                zIndex: 10, backdropFilter: 'blur(20px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '40px', padding: '0 8px' }}>
                    <div style={{
                        width: '44px', height: '44px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, #1f6feb, #58a6ff)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 20px rgba(88,166,255,0.4)',
                        border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                        <Shield color="#fff" size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '16px', fontWeight: '950', letterSpacing: '1px', color: '#e6edf3' }}>{productLabel}</div>
                        <div style={{ fontSize: '10px', color: '#3fb950', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3fb950' }} />
                            NEURAL_DEFENSE_ON
                        </div>
                    </div>
                </div>

                <nav style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
                    <NavSection label="Core Monitoring">
                        <NavItem to="/dashboard" icon={<BarChart3 size={18} />} label="Dashboard" active={location.pathname === '/dashboard'} />
                        <NavItem to="/telemetry" icon={<Activity size={18} />} label="Telemetry" active={location.pathname === '/telemetry'} />
                        <NavItem to="/sites" icon={<Link2 size={18} />} label="Decoy Manager" active={location.pathname === '/sites'} />
                        <NavItem to="/admin/leads" icon={<MessageSquare size={18} />} label="Lead Inbox" active={location.pathname === '/admin/leads'} />
                        <NavItem to="/terminal" icon={<TerminalIcon size={18} />} label="Live Shell" active={location.pathname === '/terminal'} />
                        <NavItem to="/forensics/detail" icon={<FileSearch size={18} />} label="Forensics Lab" active={location.pathname === '/forensics/detail'} />
                        <NavItem to="/ai-companion" icon={<Bot size={18} />} label="AI Companion" active={location.pathname === '/ai-companion'} />
                    </NavSection>

                    <NavSection label="Research Modules">
                        <NavItem to="/intelligence" icon={<GlobeIcon size={18} />} label="Analytics" active={location.pathname === '/intelligence'} />
                        <NavItem to="/url-scanner" icon={<Link2 size={18} />} label="URL Scanner" active={location.pathname === '/url-scanner'} />
                        <NavItem to="/mapping" icon={<TargetIcon size={18} />} label="MITRE Mapping" active={location.pathname === '/mapping'} />
                        <NavItem to="/profiling" icon={<Fingerprint size={18} />} label="Threat Actors" active={location.pathname === '/profiling'} />
                        <NavItem to="/graph" icon={<Network size={18} />} label="Attack Graph" active={location.pathname === '/graph'} />
                        <NavItem to="/deception" icon={<Settings size={18} />} label="AI Engine" active={location.pathname === '/deception'} />
                        <NavItem to="/status" icon={<HeartPulse size={18} />} label="System Status" active={location.pathname === '/status'} />
                        <NavItem to="/simulator" icon={<ShieldAlert size={18} />} label="Attack Simulator" active={location.pathname === '/simulator'} />
                        <NavItem to="/lab/architecture" icon={<Cpu size={18} />} label="Architecture" active={location.pathname === '/lab/architecture'} />
                        <NavItem to="/about" icon={<Info size={18} />} label="Research / About" active={location.pathname === '/about'} />
                    </NavSection>
                </nav>

                <div style={{ borderTop: '1px solid #30363d', paddingTop: '24px', marginTop: '20px' }}>
                    <div style={{ padding: '0 12px', marginBottom: '14px' }}>
                        <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                            Active Operator
                        </div>
                        <div style={{ fontSize: '13px', color: '#e6edf3', fontWeight: '800' }}>
                            {userProfile?.username || "operator"}
                        </div>
                        <div style={{ fontSize: '10px', color: '#58a6ff', fontWeight: '700' }}>
                            {(userProfile?.role || "analyst").toUpperCase()}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', marginBottom: '20px', fontSize: '11px', color: '#8b949e', fontWeight: '600' }}>
                        <Clock size={14} color="#58a6ff" /> {currentTime}
                    </div>
                    <button onClick={logout} style={{
                        width: '100%', padding: '12px', background: 'rgba(248,81,73,0.05)', border: '1px solid rgba(248,81,73,0.2)',
                        color: '#f85149', borderRadius: '10px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        fontSize: '13px', fontWeight: '800', transition: '0.2s'
                    }} className="logout-btn">
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="premium-scroll" style={{ flex: 1, overflowY: 'auto', zIndex: 1, position: 'relative' }}>
                <Outlet />
            </main>
        </div>
    );
};

type NavSectionProps = {
    label: string;
    children: React.ReactNode;
};

type NavItemProps = {
    to: string;
    icon: React.ReactNode;
    label: string;
    active: boolean;
};

const NavSection = ({ label, children }: NavSectionProps) => (
    <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '11px', color: '#484f58', textTransform: 'uppercase', letterSpacing: '1.5px', padding: '0 12px', marginBottom: '16px', fontWeight: '800' }}>
            {label}
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {children}
        </ul>
    </div>
);

const NavItem = ({ to, icon, label, active }: NavItemProps) => (
    <Link to={to} style={{ textDecoration: 'none' }}>
        <motion.li
            whileHover={{ x: 5, background: 'rgba(56,139,253,0.1)' }}
            style={{
                padding: '12px 14px',
                background: active ? 'rgba(56,139,253,0.15)' : 'transparent',
                borderRadius: '10px',
                color: active ? '#58a6ff' : '#8b949e',
                marginBottom: '6px',
                display: 'flex', alignItems: 'center', gap: '14px', fontSize: '14px',
                fontWeight: active ? '800' : '600',
                border: active ? '1px solid rgba(88,166,255,0.2)' : '1px solid transparent',
                transition: '0.2s'
            }}
        >
            <div style={{ color: active ? '#58a6ff' : '#484f58' }}>{icon}</div>
            {label}
        </motion.li>
    </Link>
);

export default MainLayout;

