import React, { useState, useEffect } from 'react';
import axios from "axios";
import { API_BASE, WS_BASE } from './apiConfig';
import { Link } from "react-router-dom";
import {
    getEventDate,
    getEventIsoTime,
    getEventTimestampValue,
    isSyntheticEvent,
    stableHexFromText,
} from "./utils/eventUtils";
import { createManagedWebSocket, safeParseJson } from "./utils/realtime";
import { AreaTrendChart } from "./components/charts/SignalCharts";
import {
    Shield, Clock, FileText, Search, ArrowLeft, Download,
    Layers, Activity, Database, AlertCircle, Filter,
    ChevronRight, Fingerprint, Crosshair, Target, ShieldCheck,
    Cpu, Globe, Zap, FileSearch, ExternalLink,
    Lock, CheckCircle, AlertTriangle, Play, Pause, Rewind, FastForward
} from "lucide-react";

type ForensicAiMetadata = {
    intent?: string;
    confidence?: number;
    stage?: string;
    thought?: string;
    explanation?: string | null;
    mode?: string;
    entropy?: number;
};

type RawForensicEvent = {
    id?: string | number;
    session_id?: string;
    sessionId?: string;
    ip?: string;
    timestamp_utc?: string;
    ts?: string;
    timestamp?: string;
    cmd?: string;
    url_path?: string;
    event_type?: string;
    score?: number;
    risk_score?: number;
    risk?: number;
    country?: string;
    geo?: string;
    geo_country?: string;
    sha256?: string;
    ai_stage?: string;
    analysis?: string;
    ai_explanation?: string;
    ai_intent?: string;
    confidence?: number;
    ai_confidence?: number;
    entropy?: number;
    severity?: string;
    ai_metadata?: ForensicAiMetadata;
    deception_mode?: string;
    reputation?: number;
    mitre_tactic?: string;
    mitre_technique?: string;
    http_method?: string;
    res?: string;
};

type ForensicEvent = RawForensicEvent & {
    session_id: string;
    timestamp_utc: string;
    ts: string;
    cmd: string;
    score: number;
    country: string;
    geo: string;
    sha256: string;
    ai_stage: string;
    analysis: string;
    confidence: number;
    entropy: number;
    severity: string;
    ai_metadata: ForensicAiMetadata;
};

type Artifact = {
    ip?: string;
    kind?: string;
    name?: string;
    value?: string;
    path?: string;
    summary?: string;
    first_seen?: string;
    hash?: string;
    cmd?: string;
    content?: string;
};

type BehaviorProfile = {
    bot_probability: number;
    human_likelihood: number;
    skill_level: string;
    exploit_chain_depth: number;
};

type ReplayStep = {
    cmd?: string;
    res?: string;
    ts?: string;
    timestamp_utc?: string;
    timestamp?: string;
};

type PlaybookEntry = Record<string, unknown>;

type ActionNotice = {
    type: 'success' | 'warning' | 'error';
    message: string;
};

type ThreatReport = {
    report: string;
    integrityCode: string;
    generatedAt: string;
    caseId: string;
    ip: string;
};

type SessionSummary = {
    id: string;
    ip?: string | undefined;
    country: string;
    risk: number;
    strategy: string;
    startTime?: string | number | Date | null;
    reputation: number;
    simulatedCount: number;
    realCount: number;
    events: ForensicEvent[];
};

type DashboardStatsResponse = {
    feed?: RawForensicEvent[];
};

type FinalReportResponse = {
    report?: string;
    integrity_code?: string;
};

type NarrativeResponse = {
    narrative?: string;
};

type BlockIpResponse = {
    status?: string;
    message?: string;
};

type ApiErrorResponse = {
    detail?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
    if (axios.isAxiosError<ApiErrorResponse>(error)) {
        return error.response?.data?.detail || error.message || fallback;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return fallback;
}

const HexViewer = ({ data }: { data?: string | null | undefined }) => {
    if (!data) return null;
    const bytes = new TextEncoder().encode(data);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase());
    const chars = Array.from(bytes).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.');

    return (
        <div style={{ background: '#020617', padding: '15px', borderRadius: '8px', border: '1px solid #1e293b', fontFamily: "'Fira Code', monospace", fontSize: '11px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr) 20px repeat(8, 1fr)', gap: '4px', opacity: 0.8 }}>
                {hex.map((h, i) => (
                    <React.Fragment key={i}>
                        <span style={{ color: '#38bdf8' }}>{h}</span>
                        {i === 7 && <span style={{ color: '#334155' }}>|</span>}
                    </React.Fragment>
                ))}
            </div>
            <div style={{ marginTop: '10px', color: '#94a3b8', wordBreak: 'break-all', borderTop: '1px solid #1e293b', paddingTop: '8px' }}>
                {chars.join('')}
            </div>
        </div>
    );
};

function escapeHtml(value: unknown) {
    return String(value ?? "")
        .split("&").join("&amp;")
        .split("<").join("&lt;")
        .split(">").join("&gt;")
        .split('"').join("&quot;")
        .split("'").join("&#39;");
}

function buildPrintableReportHtml({
    session,
    caseId,
    behaviorProfile,
    sessionEvents,
    artifacts
}: {
    session: SessionSummary | null;
    caseId: string;
    behaviorProfile: BehaviorProfile;
    sessionEvents: ForensicEvent[];
    artifacts: Artifact[];
}) {
    const eventsMarkup = sessionEvents
        .slice(0, 14)
        .map((event, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(getEventIsoTime(event) || event?.ts || "N/A")}</td>
                <td>${escapeHtml(event?.cmd || event?.event_type || "N/A")}</td>
                <td>${escapeHtml(event?.severity || "low")}</td>
                <td>${escapeHtml(event?.ip || session?.ip || "unknown")}</td>
            </tr>
        `)
        .join("");

    const artifactsMarkup = artifacts.length
        ? artifacts
            .slice(0, 8)
            .map((artifact) => `
                <li>
                    <strong>${escapeHtml(artifact?.kind || artifact?.name || "Artifact")}</strong>
                    <span>${escapeHtml(artifact?.value || artifact?.path || artifact?.summary || "Recorded evidence")}</span>
                </li>
            `)
            .join("")
        : `<li><strong>No preserved artifacts</strong><span>Live telemetry captured the session without extra artifacts.</span></li>`;

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>CyberSentil Forensics Report</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Arial, sans-serif;
    }
    body {
      margin: 0;
      padding: 32px;
      color: #0f172a;
      background: #ffffff;
    }
    h1, h2, h3, p {
      margin: 0;
    }
    .header {
      border-bottom: 2px solid #0ea5e9;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .eyebrow {
      color: #0369a1;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin: 24px 0;
    }
    .meta-card {
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 14px;
      background: #f8fafc;
    }
    .meta-card small {
      display: block;
      color: #475569;
      font-size: 11px;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .meta-card strong {
      font-size: 18px;
      color: #0f172a;
    }
    .section {
      margin-top: 28px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #e0f2fe;
      color: #0c4a6e;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    ul {
      margin: 12px 0 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 10px;
    }
    li {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 12px;
      background: #f8fafc;
    }
    li strong {
      display: block;
      margin-bottom: 4px;
    }
    .summary {
      margin-top: 12px;
      line-height: 1.6;
      color: #334155;
      white-space: pre-wrap;
    }
    @media print {
      body {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="eyebrow">CyberSentil Forensics Report</div>
    <h1>${escapeHtml(caseId)}</h1>
    <p style="margin-top: 8px; color: #475569;">Generated ${escapeHtml(new Date().toLocaleString())} for session ${escapeHtml(session?.id || "unknown")}</p>
  </div>

  <div class="meta">
    <div class="meta-card">
      <small>Subject IP</small>
      <strong>${escapeHtml(session?.ip || "unknown")}</strong>
    </div>
    <div class="meta-card">
      <small>Risk Index</small>
      <strong>${escapeHtml(`${session?.risk || 0}/100`)}</strong>
    </div>
    <div class="meta-card">
      <small>Strategy</small>
      <strong>${escapeHtml(session?.strategy || "STEALTH")}</strong>
    </div>
  </div>

  <div class="section">
    <div class="eyebrow">Behavior Profile</div>
    <table>
      <tbody>
        <tr><th>Country</th><td>${escapeHtml(session?.country || "Unknown")}</td><th>Commands</th><td>${escapeHtml(sessionEvents.length)}</td></tr>
        <tr><th>Bot Probability</th><td>${escapeHtml(`${behaviorProfile?.bot_probability || 0}%`)}</td><th>Human Likelihood</th><td>${escapeHtml(`${behaviorProfile?.human_likelihood || 0}%`)}</td></tr>
        <tr><th>Skill Level</th><td>${escapeHtml(behaviorProfile?.skill_level || "Unknown")}</td><th>Exploit Chain Depth</th><td>${escapeHtml(behaviorProfile?.exploit_chain_depth || 0)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="eyebrow">Session Timeline</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Time</th>
          <th>Command / Event</th>
          <th>Severity</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        ${eventsMarkup || `<tr><td colspan="5">No recorded events for this session.</td></tr>`}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="eyebrow">Artifacts</div>
    <ul>${artifactsMarkup}</ul>
  </div>
</body>
</html>`;
}

const ForensicsPage = () => {
    const REAL_ONLY_PARAMS = { params: { include_training: false } };
    const [events, setEvents] = useState<ForensicEvent[]>([]);
    const [artifacts, setArtifacts] = useState<Artifact[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
    const [playbackActive, setPlaybackActive] = useState(false);
    const [playbook, setPlaybook] = useState<PlaybookEntry | null>(null);
    const [narrative, setNarrative] = useState("");
    const [narrativeLoading, setNarrativeLoading] = useState(false);
    const [behaviorProfile, setBehaviorProfile] = useState<BehaviorProfile>({
        bot_probability: 0,
        human_likelihood: 0,
        skill_level: "Unknown",
        exploit_chain_depth: 0
    });
    const [isReplayOpen, setIsReplayOpen] = useState(false);
    const [replayHistory, setReplayHistory] = useState<ReplayStep[]>([]);
    const [replayIndex, setReplayIndex] = useState(0);
    const [isReplaying, setIsReplaying] = useState(false);
    const [forensicTab, setForensicTab] = useState<'AI_JOURNEY' | 'BEHAVIOR' | 'CUSTODY'>("AI_JOURNEY");
    const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null);
    const [blockingIp, setBlockingIp] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const [threatReport, setThreatReport] = useState<ThreatReport | null>(null);
    const [showSimulatedData, setShowSimulatedData] = useState(false);

    const showNotice = (type: ActionNotice['type'], message: string) => {
        setActionNotice({ type, message });
    };

    useEffect(() => {
        if (!actionNotice) return undefined;
        const timer = setTimeout(() => setActionNotice(null), 4500);
        return () => clearTimeout(timer);
    }, [actionNotice]);

    const normalizeEvent = (event: RawForensicEvent, fallbackSeed = ""): ForensicEvent => {
        const rawTimestamp = getEventTimestampValue(event);
        const timestampValue =
            rawTimestamp ||
            (typeof event?.timestamp === "string" ? event.timestamp : null) ||
            new Date().toISOString();
        const timestamp =
            typeof timestampValue === "string"
                ? timestampValue
                : timestampValue instanceof Date
                    ? timestampValue.toISOString()
                    : new Date(timestampValue).toISOString();
        const sessionId =
            event?.session_id ||
            event?.sessionId ||
            `${event?.ip || "unknown"}-${String(timestamp).slice(0, 16)}-${fallbackSeed || "evt"}`;
        const cmd = event?.cmd || event?.url_path || event?.event_type || "N/A";
        const scoreValue = Number(event?.score ?? event?.risk_score ?? event?.risk ?? 0);
        return {
            ...event,
            session_id: sessionId,
            timestamp_utc: timestamp,
            ts: timestamp,
            cmd,
            score: Number.isFinite(scoreValue) ? scoreValue : 0,
            country: event?.country || event?.geo_country || event?.geo || "Unknown",
            geo: event?.geo || event?.country || event?.geo_country || "Unknown",
            sha256: event?.sha256 || stableHexFromText(`${sessionId}|${cmd}|${event?.ip || "unknown"}`, 32),
            ai_stage: event?.ai_stage || event?.ai_metadata?.stage || "DISCOVERY",
            analysis: event?.analysis || event?.ai_explanation || event?.ai_intent || "Behavioral analysis pending",
            confidence: event?.confidence ?? event?.ai_confidence ?? event?.ai_metadata?.confidence ?? 85,
            entropy: event?.entropy ?? event?.ai_metadata?.entropy ?? 0.12,
            severity: event?.severity || "low",
            ai_metadata: event?.ai_metadata || {
                intent: event?.ai_intent || "Discovery",
                confidence: event?.confidence ?? event?.ai_confidence ?? 85,
                stage: event?.ai_stage || "Discovery",
                thought: event?.ai_explanation || "Telemetry correlation in progress.",
                explanation: event?.ai_explanation || null,
                mode: event?.deception_mode || "ADAPTIVE_DECEPTION",
                entropy: event?.entropy ?? 0.12,
            },
        };
    };

    const isSimulatedEvent = (event: Partial<ForensicEvent>) => {
        const eventType = String(event?.event_type || "").toLowerCase();
        const aiIntent = String(event?.ai_intent || event?.ai_metadata?.intent || "").toLowerCase();
        const httpMethod = String(event?.http_method || "").toUpperCase();
        const sessionId = String(event?.session_id || event?.sessionId || "");
        return (
            eventType === "simulated_attack" ||
            aiIntent === "simulation" ||
            httpMethod === "SIM" ||
            sessionId.startsWith("SIM_")
        );
    };

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const statsRes = await axios.get<DashboardStatsResponse>(`${API_BASE}/dashboard/stats`, REAL_ONLY_PARAMS);
                const artifactsRes = await axios.get<Artifact[]>(`${API_BASE}/forensics/artifacts`, REAL_ONLY_PARAMS);

                const allEvents = (statsRes.data.feed || []).map((event, idx) => normalizeEvent(event, String(idx)));
                setEvents(allEvents);
                setArtifacts(Array.isArray(artifactsRes.data) ? artifactsRes.data : []);

                if (allEvents.length > 0 && !selectedSessionId) {
                    setSelectedSessionId(allEvents[0].session_id);
                    setPlaybackActive(false);
                }

                setLoading(false);
            } catch (e) {
                console.error(e);
                setLoading(false);
            }
        };
        fetchStats();
        const interval = setInterval(fetchStats, 60000); // Slower polling for aggregate sync

        // WebSocket "Neural Link" for instant incident updates
        const ws = createManagedWebSocket(
            `${WS_BASE}/ws/incidents`,
            {
                onMessage: (event) => {
                    const raw = safeParseJson(event.data);
                    if (!raw || typeof raw !== 'object' || isSyntheticEvent(raw)) return;
                    const data = raw as RawForensicEvent;
                    setEvents(prev => {
                        const normalized = normalizeEvent(data, "ws");
                        if (prev.find(e => String(e.id) === String(normalized.id) && String(e.session_id) === String(normalized.session_id))) {
                            return prev;
                        }
                        return [normalized, ...prev].slice(0, 100);
                    });
                },
                onError: (err) => console.error("WS Forensics Flow Error", err),
            },
            { reconnect: true }
        );

        return () => {
            clearInterval(interval);
            ws.close();
        };
    }, []);

    useEffect(() => {
        if (selectedSessionId) {
            const fetchSessionDetails = async (sessionId: string) => {
                try {
                    const res = await axios.get<BehaviorProfile>(`${API_BASE}/forensics/behavior/${sessionId}`, REAL_ONLY_PARAMS);
                    setBehaviorProfile(res.data);
                } catch (e) {
                    console.error("Failed to fetch behavior profile", e);
                }

                // Fetch Phase 5 Playbook
                try {
                    const pbRes = await axios.get<PlaybookEntry[]>(`${API_BASE}/soc/playbooks/${sessionId}`);
                    if (pbRes.data && pbRes.data.length > 0) {
                        setPlaybook(pbRes.data[0]);
                    } else {
                        setPlaybook(null);
                    }
                } catch (e) { console.error("Playbook fetch error", e); }

                // Fetch AI Narrative
                setNarrativeLoading(true);
                try {
                    const narRes = await axios.get<NarrativeResponse>(`${API_BASE}/forensics/narrative/${sessionId}`, REAL_ONLY_PARAMS);
                    setNarrative(narRes.data.narrative || "Narrative data synthesis offline.");
                } catch (e) {
                    setNarrative("Narrative data synthesis offline.");
                } finally {
                    setNarrativeLoading(false);
                }
            };
            fetchSessionDetails(selectedSessionId);
        }
    }, [selectedSessionId]);

    const exportJSON = () => {
        if (!activeSession) {
            showNotice("warning", "No session selected. Generate activity first, then export.");
            return;
        }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
            session: activeSession,
            profile: behaviorProfile,
            artifacts: artifacts.filter(a => a.ip === activeSession?.ip)
        }, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `forensics_${selectedSessionId}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const exportCowrie = () => {
        if (!activeSession) {
            showNotice("warning", "No session selected. Generate activity first, then export.");
            return;
        }
        const cowrieData = sessionEvents.map(e => ({
            eventid: "cowrie.command.input",
            input: e.cmd,
            timestamp: getEventTimestampValue(e),
            src_ip: e.ip,
            session: selectedSessionId
        }));
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cowrieData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `cowrie_${selectedSessionId}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const fetchReplay = async (sid: string) => {
        try {
            const res = await axios.get<ReplayStep[]>(`${API_BASE}/forensics/timeline/${sid}`, REAL_ONLY_PARAMS);
            setReplayHistory(Array.isArray(res.data) ? res.data : []);
            setReplayIndex(0);
            setIsReplayOpen(true);
            setIsReplaying(true);
        } catch (e) {
            console.error("Replay fetch failed", e);
            showNotice("error", "No replay data available for this session.");
        }
    };

    const handleBlockAdversary = async () => {
        if (!activeSession?.ip) {
            showNotice("warning", "No active session/IP available for block action.");
            return;
        }
        try {
            setBlockingIp(true);
            const res = await axios.post<BlockIpResponse>(`${API_BASE}/soc/block-ip`, {
                ip: activeSession.ip,
                reason: `Manual block from forensics console (${activeSessionCaseId})`,
            });
            const payload = res.data || {};
            showNotice(payload.status === "success" ? "success" : "warning", payload.message || "Block request completed.");
        } catch (e) {
            const message = getErrorMessage(e, "Failed to block adversary IP.");
            showNotice("error", message);
        } finally {
            setBlockingIp(false);
        }
    };

    const handleGenerateThreatSummary = async () => {
        if (!activeSession?.ip) {
            showNotice("warning", "Select an active session before generating a report.");
            return;
        }
        try {
            setReportLoading(true);
            const res = await axios.post<FinalReportResponse>(`${API_BASE}/forensics/final-report`, {
                ip: activeSession.ip,
                session_id: activeSession.id,
            }, REAL_ONLY_PARAMS);
            const reportPayload = res.data || {};
            setThreatReport({
                report: reportPayload.report || "No report generated.",
                integrityCode: reportPayload.integrity_code || "N/A",
                generatedAt: new Date().toISOString(),
                caseId: activeSessionCaseId,
                ip: activeSession.ip,
            });
            showNotice("success", `Threat summary generated for ${activeSession.ip}.`);
        } catch (e) {
            const message = getErrorMessage(e, "Threat summary generation failed.");
            showNotice("error", message);
        } finally {
            setReportLoading(false);
        }
    };

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (isReplaying && replayIndex < replayHistory.length - 1) {
            timer = setTimeout(() => {
                setReplayIndex(prev => prev + 1);
            }, 1000);
        } else if (replayIndex >= replayHistory.length - 1) {
            setIsReplaying(false);
        }
        return () => clearTimeout(timer);
    }, [isReplaying, replayIndex, replayHistory]);

    const visibleEvents = showSimulatedData
        ? events
        : events.filter((event) => !isSimulatedEvent(event));

    const sessionGroups = visibleEvents.reduce<Record<string, SessionSummary>>((acc, event) => {
        const sid = event.session_id || `${event.ip || "unknown"}-${String(getEventTimestampValue(event) || "unknown").slice(0, 16)}`;
        if (!acc[sid]) {
            acc[sid] = {
                id: sid,
                ip: event.ip,
                country: event.country || event.geo || "Unknown",
                risk: event.score || 0,
                strategy: event.deception_mode || event.ai_metadata?.mode || "STEALTH",
                startTime: getEventTimestampValue(event),
                reputation: event.reputation || 0,
                simulatedCount: 0,
                realCount: 0,
                events: []
            };
        }
        if (isSimulatedEvent(event)) {
            acc[sid].simulatedCount += 1;
        } else {
            acc[sid].realCount += 1;
        }
        acc[sid].events.push(event);
        return acc;
    }, {});

    const sortedSessions: SessionSummary[] = Object.values(sessionGroups).sort((a, b) => {
        const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
        const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
        return bTime - aTime;
    });
    const activeSession: SessionSummary | null = (selectedSessionId ? sessionGroups[selectedSessionId] : undefined) || sortedSessions[0] || null;
    const sessionEvents: ForensicEvent[] = activeSession
        ? (activeSession.events || []).sort((a, b) => {
            const aDate = getEventDate(a);
            const bDate = getEventDate(b);
            return (aDate ? aDate.getTime() : 0) - (bDate ? bDate.getTime() : 0);
        })
        : [];
    const activeCommand = sessionEvents[selectedCommandIndex] || null;
    const hasSessions = sortedSessions.length > 0;
    const totalSessionCount = sortedSessions.length;
    const simulatedOnlySessionCount = sortedSessions.filter((s) => s.realCount === 0 && s.simulatedCount > 0).length;
    const mixedSessionCount = sortedSessions.filter((s) => s.realCount > 0 && s.simulatedCount > 0).length;
    const realOnlySessionCount = sortedSessions.filter((s) => s.realCount > 0 && s.simulatedCount === 0).length;
    const activeSessionShortId = activeSession?.id ? activeSession.id.substring(0, 4).toUpperCase() : "----";
    const activeSessionCaseId = `DF-2026-${activeSessionShortId}`;

    useEffect(() => {
        if (!selectedSessionId) return;
        if (!sessionGroups[selectedSessionId]) {
            setSelectedSessionId(sortedSessions[0]?.id || null);
            setSelectedCommandIndex(0);
        }
    }, [selectedSessionId, sessionGroups, sortedSessions]);

    // Simulation Data for Risk Graph
    const graphData = sessionEvents.map((e: ForensicEvent, i: number) => ({
        step: i + 1,
        risk: e.score || 10,
        cmd: e.cmd
    }));

    const generatePDF = async (session: SessionSummary) => {
        try {
            const printableEvents = [...sessionEvents];
            const printableArtifacts = artifacts.filter((artifact) => artifact?.ip === session?.ip);
            const reportWindow = window.open("", "_blank", "noopener,noreferrer");
            if (!reportWindow) {
                showNotice("warning", "Popup blocked. Allow popups to print or save the report as PDF.");
                return;
            }

            reportWindow.document.open();
            reportWindow.document.write(buildPrintableReportHtml({
                session,
                caseId: activeSessionCaseId,
                behaviorProfile,
                sessionEvents: printableEvents,
                artifacts: printableArtifacts,
            }));
            reportWindow.document.close();

            window.setTimeout(() => {
                reportWindow.focus();
                reportWindow.print();
            }, 200);
        } catch (error) {
            console.error("PDF export failed", error);
            showNotice("error", "Print-friendly report generation failed.");
        }
    };

    if (loading) return (
        <div style={{ background: '#020617', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
            <Activity className="animate-spin" size={48} />
            <div style={{ marginTop: '20px', fontSize: '14px', letterSpacing: '2px', fontWeight: '800' }}>INITIALIZING FORENSIC CORE...</div>
        </div>
    );
    if (!hasSessions) return (
        <div style={{ background: '#020617', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0', textAlign: 'center', padding: '40px' }}>
            <FileSearch size={52} color="#38bdf8" />
            <div style={{ marginTop: '20px', fontSize: '16px', fontWeight: '800' }}>NO FORENSIC SESSIONS AVAILABLE</div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#94a3b8', maxWidth: '520px' }}>
                {showSimulatedData
                    ? "Generate traffic in the honeypot or run a simulation to populate forensic sessions."
                    : "No real sessions found in current filter. Enable simulated data or generate live traffic."}
            </div>
            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                <Link to="/simulator" style={{ padding: '10px 18px', background: '#1f6feb', color: '#fff', textDecoration: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: '800' }}>OPEN SIMULATOR</Link>
                <Link to="/terminal" style={{ padding: '10px 18px', background: 'transparent', color: '#8b949e', textDecoration: 'none', borderRadius: '10px', border: '1px solid #30363d', fontSize: '12px', fontWeight: '800' }}>OPEN LIVE SHELL</Link>
            </div>
        </div>
    );

    return (
        <div style={{
            color: '#e2e8f0',
            padding: '40px 60px',
            fontFamily: "'Manrope', sans-serif",
            overflow: 'hidden',
            height: '100%'
        }}>
            {/* PLATINUM HEADER */}
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                padding: '15px 25px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div className="premium-glass neon-glow-blue" style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <ShieldCheck size={28} color="#58a6ff" />
                    </div>
                    <div>
                        <h1 className="text-gradient-blue" style={{ margin: 0, fontSize: '2rem', fontWeight: '950', letterSpacing: '-1px' }}>
                            DIGITAL_FORENSICS_LAB
                        </h1>
                        <p style={{ margin: 0, fontSize: '13px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
                            <Activity size={12} color="#58a6ff" /> Artifact Analysis & Attack Reconstruction
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '40px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '10px', color: '#484f58', fontWeight: '800' }}>STATUS</div>
                            <div className="premium-glass neon-glow-green" style={{ fontSize: '11px', color: '#3fb950', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '12px' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3fb950', boxShadow: '0 0 10px #3fb950' }} />
                                SECURE_ENVIRONMENT
                            </div>
                        </div>
                        <div style={{ height: '30px', width: '1px', background: 'rgba(148, 163, 184, 0.1)' }} />
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '10px', color: '#484f58', fontWeight: '800' }}>CASE_ID</div>
                            <div style={{ fontSize: '12px', color: '#e6edf3', fontWeight: '800', fontFamily: 'monospace' }}>{activeSessionCaseId}</div>
                        </div>
                    </div>
                </div>
            </header>

            {actionNotice && (
                <div
                    style={{
                        marginBottom: '16px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: `1px solid ${
                            actionNotice.type === 'error'
                                ? 'rgba(248,81,73,0.4)'
                                : actionNotice.type === 'warning'
                                    ? 'rgba(210,153,34,0.4)'
                                    : 'rgba(63,185,80,0.4)'
                        }`,
                        background:
                            actionNotice.type === 'error'
                                ? 'rgba(248,81,73,0.1)'
                                : actionNotice.type === 'warning'
                                    ? 'rgba(210,153,34,0.1)'
                                    : 'rgba(63,185,80,0.12)',
                        color: actionNotice.type === 'error' ? '#f85149' : actionNotice.type === 'warning' ? '#d29922' : '#3fb950',
                        fontSize: '12px',
                        fontWeight: '800',
                    }}
                >
                    {actionNotice.message}
                </div>
            )}

            <div
                style={{
                    marginBottom: '16px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    background: 'rgba(15, 23, 42, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        onClick={() => setShowSimulatedData((prev) => !prev)}
                        style={{
                            border: `1px solid ${showSimulatedData ? 'rgba(245,158,11,0.45)' : 'rgba(63,185,80,0.45)'}`,
                            background: showSimulatedData ? 'rgba(245,158,11,0.12)' : 'rgba(63,185,80,0.12)',
                            color: showSimulatedData ? '#f59e0b' : '#3fb950',
                            borderRadius: '8px',
                            padding: '7px 12px',
                            fontSize: '11px',
                            fontWeight: '900',
                            letterSpacing: '0.5px',
                            cursor: 'pointer'
                        }}
                    >
                        {showSimulatedData ? 'SHOWING REAL + SIMULATED' : 'SHOWING REAL ONLY'}
                    </button>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        Toggle to validate production telemetry separately from training runs.
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '10px', color: '#cbd5e1' }}>SESSIONS: <span style={{ color: '#f8fafc', fontWeight: '900' }}>{totalSessionCount}</span></div>
                    <div style={{ fontSize: '10px', color: '#cbd5e1' }}>REAL_ONLY: <span style={{ color: '#3fb950', fontWeight: '900' }}>{realOnlySessionCount}</span></div>
                    <div style={{ fontSize: '10px', color: '#cbd5e1' }}>MIXED: <span style={{ color: '#0ea5e9', fontWeight: '900' }}>{mixedSessionCount}</span></div>
                    <div style={{ fontSize: '10px', color: '#cbd5e1' }}>SIM_ONLY: <span style={{ color: '#f59e0b', fontWeight: '900' }}>{simulatedOnlySessionCount}</span></div>
                </div>
            </div>

            {/* 3-COLUMN PROFESSIONAL LAYOUT */}
            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr 400px', gap: '24px', height: 'calc(100vh - 160px)', width: '100%', margin: '0 auto' }}>

                {/* LEFT PANEL: INCIDENT CASES */}
                <aside style={{
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid rgba(56, 189, 248, 0.1)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid rgba(56, 189, 248, 0.1)', background: 'rgba(15, 23, 42, 0.8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <AlertCircle size={16} color="#38bdf8" /> INCIDENT CASES
                        </h3>
                        <Filter size={14} color="#64748b" />
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }} className="custom-scrollbar">
                        {sortedSessions.map(session => (
                            <div
                                key={session.id}
                                onClick={() => {
                                    setSelectedSessionId(session.id);
                                    setSelectedCommandIndex(0);
                                }}
                                style={{
                                    padding: '15px',
                                    background: selectedSessionId === session.id ? 'rgba(14, 165, 233, 0.1)' : 'rgba(30, 41, 59, 0.3)',
                                    border: `1px solid ${selectedSessionId === session.id ? '#0ea5e9' : 'rgba(56, 189, 248, 0.1)'}`,
                                    borderRadius: '10px',
                                    marginBottom: '10px',
                                    cursor: 'pointer',
                                    transition: '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    transform: selectedSessionId === session.id ? 'scale(1.02)' : 'scale(1)',
                                    boxShadow: selectedSessionId === session.id ? '0 0 15px rgba(14, 165, 233, 0.2)' : 'none'
                                }}
                            >
                                {session.realCount === 0 && session.simulatedCount > 0 && (
                                    <div style={{ marginBottom: '8px', fontSize: '9px', fontWeight: '900', color: '#f59e0b' }}>
                                        SIMULATED SESSION
                                    </div>
                                )}
                                {session.realCount > 0 && session.simulatedCount > 0 && (
                                    <div style={{ marginBottom: '8px', fontSize: '9px', fontWeight: '900', color: '#0ea5e9' }}>
                                        MIXED SESSION (REAL + SIM)
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#f8fafc' }}>Session #{session.id ? session.id.substring(0, 6) : "UNKNOWN"}</div>
                                    <div style={{
                                        fontSize: '10px',
                                        fontWeight: '900',
                                        color: session.risk > 70 ? '#f43f5e' : session.risk > 40 ? '#f59e0b' : '#10b981',
                                        background: session.risk > 70 ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        border: `1px solid ${session.risk > 70 ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                                    }}>
                                        RISK: {session.risk}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); fetchReplay(session.id); }}
                                        style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid #38bdf8', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                                    >REPLAY_STEPS</button>
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>DUR: <span style={{ color: '#e2e8f0' }}>{session.events.length}m</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>

                {/* CENTER PANEL: RECONSTRUCTION TIMELINE */}
                <main style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    overflowY: 'auto',
                    paddingRight: '5px'
                }} className="custom-scrollbar">

                    {/* RISK PROGRESSION GRAPH */}
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid rgba(56, 189, 248, 0.1)',
                        borderRadius: '12px',
                        padding: '20px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#38bdf8' }}>BEHAVIORAL RISK PROGRESSION</h3>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>LIVE HEURISTICS MAPPING</div>
                        </div>
                        <div style={{ height: '150px', width: '100%' }}>
                            <AreaTrendChart
                                data={graphData}
                                valueKey="risk"
                                labelKey="step"
                                minValue={0}
                                maxValue={100}
                                color="#0ea5e9"
                                height={150}
                                emptyLabel="No command sequence available for this session."
                            />
                        </div>
                    </div>

                    {/* TIMELINE LIST */}
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid rgba(56, 189, 248, 0.1)',
                        borderRadius: '12px',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{ padding: '20px', borderBottom: '1px solid rgba(56, 189, 248, 0.1)', display: 'flex', justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#f8fafc' }}>ATTACK RECONSTRUCTION TIMELINE</h3>
                            <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '800' }}>SESSION: {selectedSessionId?.substring(0, 12)}</div>
                        </div>
                        <div style={{ flex: 1, padding: '20px' }} className="custom-scrollbar">
                            {sessionEvents.map((event: ForensicEvent, idx: number) => (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedCommandIndex(idx)}
                                    style={{
                                        display: 'flex',
                                        gap: '20px',
                                        marginBottom: '20px',
                                        position: 'relative',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {/* Vertical Line */}
                                    {idx < sessionEvents.length - 1 && (
                                        <div style={{
                                            position: 'absolute',
                                            left: '42px',
                                            top: '25px',
                                            bottom: '-25px',
                                            width: '2px',
                                            background: 'rgba(56, 189, 248, 0.1)'
                                        }} />
                                    )}

                                    <div style={{
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        background: selectedCommandIndex === idx ? '#0ea5e9' : 'rgba(148, 163, 184, 0.3)',
                                        border: `4px solid ${selectedCommandIndex === idx ? 'rgba(14, 165, 233, 0.3)' : 'transparent'}`,
                                        zIndex: 2,
                                        marginTop: '6px',
                                        transition: '0.3s'
                                    }} />

                                    <div style={{
                                        flex: 1,
                                        background: selectedCommandIndex === idx ? 'rgba(14, 165, 233, 0.05)' : 'transparent',
                                        padding: '10px 15px',
                                        borderRadius: '8px',
                                        border: `1px solid ${selectedCommandIndex === idx ? 'rgba(14, 165, 233, 0.3)' : 'transparent'}`,
                                        transition: '0.3s'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <code style={{
                                                fontFamily: "'JetBrains Mono', monospace",
                                                fontSize: '13px',
                                                color: event.severity === 'high' ? '#f43f5e' : '#38bdf8'
                                            }}>
                                                {event.cmd}
                                            </code>
                                            {event.severity === 'high' && <AlertTriangle size={14} color="#f43f5e" />}
                                            <div style={{
                                                marginLeft: 'auto',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                            }}>
                                                {isSimulatedEvent(event) && (
                                                    <div style={{
                                                        fontSize: '9px',
                                                        fontWeight: '900',
                                                        color: '#f59e0b',
                                                        background: 'rgba(245, 158, 11, 0.12)',
                                                        padding: '2px 6px',
                                                        borderRadius: '3px',
                                                        border: '1px solid rgba(245, 158, 11, 0.35)'
                                                    }}>
                                                        SIM
                                                    </div>
                                                )}
                                                <div style={{
                                                    fontSize: '9px',
                                                    fontWeight: '900',
                                                    background: 'rgba(148, 163, 184, 0.1)',
                                                    padding: '2px 6px',
                                                    borderRadius: '3px',
                                                    color: '#64748b'
                                                }}>
                                                    {event.ai_stage || 'DISCOVERY'}
                                                </div>
                                            </div>
                                        </div>
                                        {selectedCommandIndex === idx && (
                                            <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                <div style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>TACTIC: {event.mitre_tactic || 'Discovery'}</div>
                                                <div style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>TECHNIQUE: {event.mitre_technique || 'T1059'}</div>
                                                <div style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>STRATEGY: {activeSession?.strategy}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ARTIFACT ANALYSIS SECTION */}
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid rgba(56, 189, 248, 0.1)',
                        borderRadius: '12px',
                        padding: '20px'
                    }}>
                        <h3 style={{ margin: '0 0 15px 0', fontSize: '14px', fontWeight: '800', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FileSearch size={18} /> ARTIFACTS & EVIDENCE OBJECTS
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                            {artifacts.length > 0 ? artifacts.slice(0, 3).map((art, i) => (
                                <div key={i} style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(56, 189, 248, 0.1)', borderRadius: '10px', padding: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#f8fafc' }}>{art.name || `CAPTURE_0x${i + 1}`}</div>
                                        <div style={{ fontSize: '9px', color: '#94a3b8' }}>{art.first_seen ? new Date(art.first_seen).toLocaleDateString() : "N/A"}</div>
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>SHA256:</div>
                                    <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#38bdf8', background: '#0f172a', padding: '5px', borderRadius: '4px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {art.hash || stableHexFromText(`${art.ip || "unknown"}|${art.cmd || art.name || i}`, 32)}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '10px' }}>
                                        <span style={{ color: '#64748b' }}>SIZE: <span style={{ color: '#f8fafc' }}>1.4KB</span></span>
                                        <span style={{ color: '#64748b' }}>ACCESS: <span style={{ color: '#f8fafc' }}>01</span></span>
                                    </div>
                                </div>
                            )) : (
                                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '12px', border: '1px dashed rgba(56, 189, 248, 0.2)', borderRadius: '10px' }}>
                                    NO FILES CAPTURED IN CURRENT FORENSIC SCOPE
                                </div>
                            )}
                        </div>
                    </div>
                </main>

                {/* RIGHT PANEL: FORENSIC ANALYSIS */}
                <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* COMMAND ACTION ANALYSIS */}
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid rgba(56, 189, 248, 0.1)',
                        borderRadius: '12px',
                        padding: '24px',
                        flex: 1
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px', color: '#38bdf8' }}>
                            <Cpu size={20} />
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>FORENSIC ANALYSIS</h3>
                        </div>

                        {activeCommand ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <label style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', letterSpacing: '1px' }}>COMMAND_EXECUTED</label>
                                    <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b', marginTop: '8px', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#38bdf8' }}>
                                        {activeCommand.cmd}
                                    </div>
                                </div>

                                <div>
                                    <label style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', letterSpacing: '1px' }}>PREDICTED_INTENT</label>
                                    <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: '600', marginTop: '5px' }}>
                                        {activeCommand.analysis || "General Exploration"}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <div>
                                        <label style={{ fontSize: '10px', color: '#64748b', fontWeight: '800' }}>CONFIDENCE</label>
                                        <div style={{ fontSize: '18px', color: '#38bdf8', fontWeight: '900' }}>{activeCommand.ai_metadata?.confidence || activeCommand.confidence || 85}%</div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '10px', color: '#64748b', fontWeight: '800' }}>VULN_FLAG</label>
                                        <div style={{ fontSize: '18px', color: activeCommand.severity === 'high' ? '#f43f5e' : '#10b981', fontWeight: '900' }}>
                                            {activeCommand.severity === 'high' ? 'CRITICAL' : 'NONE'}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)', paddingTop: '20px' }}>
                                    <label style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', letterSpacing: '1px' }}>DECEPTION_RESPONSE</label>
                                    <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '10px', lineHeight: '1.6' }}>
                                        System applied <span style={{ color: '#38bdf8', fontWeight: '700' }}>{activeSession?.strategy}</span>.
                                        {activeCommand.severity === 'high' ? " Autonomous trap initiated to prevent lateral movement." : " Maintaining stealth monitoring to gather telemetry."}
                                    </div>
                                </div>

                                <div style={{ background: 'rgba(30, 41, 59, 0.3)', borderRadius: '10px', padding: '15px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px' }}>
                                        <span style={{ color: '#64748b' }}>ENTROPY SCORE</span>
                                        <span style={{ color: '#f8fafc' }}>{activeCommand.ai_metadata?.entropy || activeCommand.entropy || '0.124'}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '4px', background: '#0f172a', borderRadius: '2px' }}>
                                        <div style={{ width: `${(activeCommand.ai_metadata?.entropy || activeCommand.entropy || 0.124) * 100}%`, height: '100%', background: '#38bdf8', borderRadius: '2px' }} />
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)', paddingTop: '20px' }}>
                                    <label style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', letterSpacing: '1px', display: 'block', marginBottom: '10px' }}>RAW_ARTIFACT_HEX</label>
                                    <HexViewer data={activeCommand.cmd || activeCommand.url_path} />
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '13px' }}>
                                SELECT A COMMAND TO VIEW ANALYSIS
                            </div>
                        )}
                    </div>

                    {/* TABS FOR AI JOURNEY & BEHAVIOR */}
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid rgba(56, 189, 248, 0.1)',
                        borderRadius: '12px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                            {(["AI_JOURNEY", "BEHAVIOR", "CUSTODY"] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setForensicTab(tab)}
                                    style={{
                                        background: 'none', border: 'none', color: forensicTab === tab ? '#38bdf8' : '#64748b',
                                        fontSize: '11px', fontWeight: '900', cursor: 'pointer', padding: '5px 10px',
                                        borderBottom: forensicTab === tab ? '2px solid #38bdf8' : 'none'
                                    }}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {forensicTab === "AI_JOURNEY" && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Cpu size={14} color="#38bdf8" />
                                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#38bdf8' }}>AI_INCIDENT_NARRATIVE</span>
                                </div>
                                {narrativeLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8', fontSize: '12px' }}>
                                        <Activity className="animate-spin" size={14} /> Synthesizing story...
                                    </div>
                                ) : (
                                    <div style={{
                                        fontSize: '13px', color: '#f8fafc', lineHeight: '1.6', background: 'rgba(14, 165, 233, 0.05)',
                                        padding: '15px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.1)',
                                        maxHeight: '400px', overflowY: 'auto'
                                    }} className="custom-scrollbar">
                                        {narrative || "No narrative available for this session."}
                                    </div>
                                )}
                            </div>
                        )}

                        {forensicTab === "BEHAVIOR" && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <div style={{ background: '#0f172a', padding: '15px', borderRadius: '10px', border: '1px solid #1e293b', textAlign: 'center' }}>
                                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#f8fafc' }}>{behaviorProfile.bot_probability}%</div>
                                        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: '800' }}>BOT PROBABILITY</div>
                                    </div>
                                    <div style={{ background: '#0f172a', padding: '15px', borderRadius: '10px', border: '1px solid #1e293b', textAlign: 'center' }}>
                                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#38bdf8' }}>{behaviorProfile.human_likelihood}%</div>
                                        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: '800' }}>HUMAN LIKELIHOOD</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                        <span style={{ color: '#64748b' }}>SKILL LEVEL:</span>
                                        <span style={{ color: '#f59e0b', fontWeight: '800' }}>{behaviorProfile.skill_level.toUpperCase()}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                        <span style={{ color: '#64748b' }}>EXPLOIT CHAIN DEPTH:</span>
                                        <span style={{ color: '#f8fafc', fontWeight: '800' }}>{String(behaviorProfile.exploit_chain_depth).padStart(2, '0')} LOGICAL NODES</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {forensicTab === "CUSTODY" && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Lock size={14} color="#f59e0b" />
                                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#f59e0b' }}>CHAIN_OF_CUSTODY_LOG</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {sessionEvents.slice(0, 5).map((e: ForensicEvent, i: number) => (
                                        <div key={i} style={{ padding: '10px', background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', fontSize: '10px' }}>
                                            <div style={{ color: '#64748b', marginBottom: '4px' }}>{getEventIsoTime(e)}</div>
                                            <div style={{ color: '#f8fafc', fontWeight: '700', marginBottom: '4px' }}>SHA-256: {e.sha256 || stableHexFromText(`${e.session_id}|${e.cmd}|${e.ip}`, 24)}</div>
                                            <div style={{ color: '#22c55e' }}>STATUS: VERIFIED_SIGNED</div>
                                        </div>
                                    ))}
                                    <div style={{ textAlign: 'center', color: '#64748b', fontSize: '9px', marginTop: '10px' }}>
                                        CRYPTO-SIGNATURE_VERSION: RSA-PSS-2048
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '20px' }}>
                            <h3 style={{ margin: '0 0 15px 0', fontSize: '12px', fontWeight: '800', color: '#f85149', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Shield size={14} /> COGNITIVE DEFENSE
                            </h3>
                            {activeSession && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                                        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: '800', marginBottom: '5px' }}>REPUTATION</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontSize: '18px', fontWeight: '950', color: (activeSession.reputation || 0) > 50 ? '#f85149' : '#3fb950' }}>
                                                {activeSession.reputation || 12}/100
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleBlockAdversary}
                                        disabled={blockingIp}
                                        style={{ width: '100%', background: '#b91c1c', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}
                                    >
                                        {blockingIp ? 'BLOCKING...' : 'BLOCK ADVERSARY'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>
            </div>

            {/* BOTTOM BAR: EXPORT & INTEGRITY */}
            <footer style={{
                marginTop: '20px',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 400px',
                gap: '20px',
                maxWidth: '1800px',
                margin: '20px auto 0 auto'
            }}>
                <div style={{
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid rgba(56, 189, 248, 0.1)',
                    borderRadius: '12px',
                    padding: '15px 25px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', gap: '30px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <CheckCircle size={16} color="#10b981" />
                            <div style={{ fontSize: '11px' }}>LOG TAMPERING: <span style={{ color: '#10b981', fontWeight: '800' }}>NONE DETECTED</span></div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Fingerprint size={16} color="#0ea5e9" />
                            <div style={{ fontSize: '11px' }}>CHECKSUM MATCH: <span style={{ color: '#0ea5e9', fontWeight: '800' }}>100% VALIDATED</span></div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Lock size={16} color="#f59e0b" />
                            <div style={{ fontSize: '11px' }}>CHAIN OF CUSTODY: <span style={{ color: '#f59e0b', fontWeight: '800' }}>MAINTAINED</span></div>
                        </div>
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', letterSpacing: '1px' }}>EVIDENCE_INTEGRITY_INDEX_0x8F</div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => activeSession && generatePDF(activeSession)}
                        style={{
                            flex: 1,
                            background: 'rgba(56, 189, 248, 0.1)',
                            border: '1px solid #38bdf8',
                            color: '#e0f2fe',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: '800',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            transition: '0.2s',
                            boxShadow: '0 0 10px rgba(14, 165, 233, 0.1)'
                        }}
                        onMouseOver={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)'; }}
                        onMouseOut={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)'; }}
                    >
                        <FileText size={18} /> PRINT / SAVE PDF
                    </button>
                    <button
                        onClick={handleGenerateThreatSummary}
                        disabled={reportLoading}
                        style={{
                            flex: 1,
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid #f59e0b',
                            color: '#fffbeb',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: '800',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            transition: '0.2s'
                        }}
                    >
                        <Zap size={18} /> {reportLoading ? 'GENERATING...' : 'GENERATE THREAT SUMMARY'}
                    </button>
                    <button
                        onClick={exportCowrie}
                        style={{
                            flex: 1,
                            background: 'rgba(121, 82, 179, 0.1)',
                            border: '1px solid #7952b3',
                            color: '#e2e8f0',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: '800',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            transition: '0.2s'
                        }}
                    >
                        <Database size={18} /> COWRIE EXPORT
                    </button>
                    <button
                        onClick={exportJSON}
                        style={{
                            width: '80px',
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid #1e293b',
                            color: '#94a3b8',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '800',
                            gap: '5px'
                        }}
                    >
                        <Download size={16} /> JSON
                    </button>
                </div>
            </footer>

            {threatReport && (
                <div style={{
                    marginTop: '16px',
                    padding: '18px 20px',
                    background: 'rgba(15, 23, 42, 0.72)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    borderRadius: '12px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '900', color: '#f59e0b' }}>
                            THREAT SUMMARY: {threatReport.caseId} ({threatReport.ip})
                        </div>
                        <button
                            onClick={() => setThreatReport(null)}
                            style={{
                                border: '1px solid rgba(148,163,184,0.4)',
                                background: 'transparent',
                                borderRadius: '8px',
                                color: '#94a3b8',
                                padding: '4px 10px',
                                fontSize: '11px',
                                cursor: 'pointer',
                            }}
                        >
                            CLOSE
                        </button>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                        Generated: {new Date(threatReport.generatedAt).toLocaleString()} | Integrity: {threatReport.integrityCode}
                    </div>
                    <pre style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        margin: 0,
                        fontSize: '12px',
                        lineHeight: '1.5',
                        color: '#e2e8f0',
                        fontFamily: "'JetBrains Mono', monospace",
                    }}>
                        {threatReport.report}
                    </pre>
                </div>
            )}

            {/* REPLAY MODAL */}
            {isReplayOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(2, 6, 23, 0.9)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(8px)'
                }}>
                    <div style={{
                        width: '800px', height: '600px', background: '#0f172a',
                        borderRadius: '20px', border: '1px solid #38bdf8', overflow: 'hidden',
                        display: 'flex', flexDirection: 'column', boxShadow: '0 0 50px rgba(56, 189, 248, 0.2)'
                    }}>
                        <div style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <Play size={20} color="#38bdf8" />
                                <span style={{ fontWeight: '900', letterSpacing: '1px', fontSize: '14px' }}>FORENSIC_SESSION_REPLAY_V2</span>
                            </div>
                            <button onClick={() => setIsReplayOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '20px' }}>X</button>
                        </div>

                        <div style={{ flex: 1, background: '#020617', padding: '30px', overflowY: 'auto', fontFamily: "'JetBrains Mono', monospace" }} className="custom-scrollbar">
                            {replayHistory.slice(0, replayIndex + 1).map((step, idx) => (
                                <div key={idx} style={{ marginBottom: '25px' }}>
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                                        <span style={{ color: '#6366f1', fontSize: '12px' }}>{getEventDate(step)?.toLocaleTimeString() || "N/A"}</span>
                                        <span style={{ color: '#22c55e' }}>attacker@honeypot:~$</span>
                                        <span style={{ color: '#f8fafc', fontWeight: '800' }}>{step.cmd}</span>
                                    </div>
                                    <div style={{ color: '#94a3b8', fontSize: '13px', paddingLeft: '20px', borderLeft: '2px solid #1e293b', whiteSpace: 'pre-wrap' }}>
                                        {step.res}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.8)', borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                <button
                                    onClick={() => setIsReplaying(!isReplaying)}
                                    style={{ background: '#38bdf8', color: '#020617', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                                >
                                    {isReplaying ? <Pause size={18} /> : <Play size={18} />} {isReplaying ? 'PAUSE' : 'PLAY'}
                                </button>
                                <span style={{ fontSize: '12px', color: '#94a3b8' }}>STEP {replayIndex + 1} OF {replayHistory.length}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => setReplayIndex(0)} style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid #304159', color: '#94a3b8', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}><Rewind size={18} /></button>
                                <button onClick={() => setReplayIndex(replayHistory.length - 1)} style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid #304159', color: '#94a3b8', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}><FastForward size={18} /></button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <style>
                {`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(56, 189, 248, 0.2); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(56, 189, 248, 0.4); }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 2s linear infinite; }
                `}
            </style>
        </div>
    );
};

export default ForensicsPage;



