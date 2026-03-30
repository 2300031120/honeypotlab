// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Activity, AlertTriangle, Clock3, RefreshCw, ShieldAlert, Target } from "lucide-react";
import { API_BASE } from "./apiConfig";

const HOURS_OPTIONS = [6, 24, 72, 168];

const panelStyle = {
  border: "1px solid #30363d",
  borderRadius: "12px",
  background: "rgba(13,17,23,0.85)",
};

const statCardStyle = {
  ...panelStyle,
  padding: "14px",
  minHeight: "110px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

function severityTone(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "high") {
    return { color: "#fca5a5", bg: "rgba(248,113,113,0.16)", border: "rgba(248,113,113,0.4)" };
  }
  if (normalized === "medium") {
    return { color: "#fde047", bg: "rgba(250,204,21,0.16)", border: "rgba(250,204,21,0.35)" };
  }
  return { color: "#86efac", bg: "rgba(34,197,94,0.16)", border: "rgba(34,197,94,0.38)" };
}

function toLocalTimestamp(value) {
  if (!value) {
    return "n/a";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "n/a";
  }
  return parsed.toLocaleString();
}

function suggestedFileName(format) {
  if (format === "cloudflare-json") {
    return "cybersentinel-blocked-ips.cloudflare.json";
  }
  if (format === "plain") {
    return "cybersentinel-blocked-ips.txt";
  }
  return "cybersentinel-blocked-ips.conf";
}

function fileNameFromDisposition(headerValue, fallback) {
  const match = /filename="?([^"]+)"?/i.exec(String(headerValue || ""));
  return match?.[1] || fallback;
}

function MetricCard({ icon, label, value, hint, color }) {
  return (
    <article style={statCardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#8b949e", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 700 }}>
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div style={{ color: "#f8fafc", fontSize: "30px", fontWeight: 900 }}>{value}</div>
      <div style={{ color: "#8b949e", fontSize: "12px" }}>{hint}</div>
    </article>
  );
}

export default function TelemetryCenter() {
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessionTimeline, setSessionTimeline] = useState([]);
  const [timelineSummary, setTimelineSummary] = useState("");
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState("");

  const loadSessionTimeline = useCallback(async (sessionId) => {
    const normalized = String(sessionId || "").trim();
    if (!normalized) {
      setSelectedSessionId("");
      setSessionTimeline([]);
      setTimelineSummary("");
      return;
    }
    setTimelineLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/admin/telemetry/sessions/${encodeURIComponent(normalized)}/timeline`, {
        params: { include_training: false, limit: 150 },
      });
      setSelectedSessionId(normalized);
      setSessionTimeline(Array.isArray(response.data?.items) ? response.data.items : []);
      setTimelineSummary(response.data?.summary || "");
    } catch (err) {
      setSelectedSessionId(normalized);
      setSessionTimeline([]);
      setTimelineSummary(err?.response?.data?.detail || "Unable to load session timeline.");
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const loadTelemetry = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");
      try {
        const [summaryRes, sessionsRes, eventsRes] = await Promise.all([
          axios.get(`${API_BASE}/admin/telemetry/summary`, { params: { hours, include_training: false } }),
          axios.get(`${API_BASE}/admin/telemetry/sessions`, { params: { hours, include_training: false, limit: 20 } }),
          axios.get(`${API_BASE}/admin/telemetry/events`, { params: { hours, include_training: false, limit: 30, offset: 0 } }),
        ]);
        setSummary(summaryRes.data || null);
        const nextSessions = Array.isArray(sessionsRes.data?.items) ? sessionsRes.data.items : [];
        setSessions(nextSessions);
        setEvents(Array.isArray(eventsRes.data?.items) ? eventsRes.data.items : []);
        if (nextSessions.length === 0) {
          setSelectedSessionId("");
          setSessionTimeline([]);
          setTimelineSummary("");
        } else {
          const hasCurrent = Boolean(selectedSessionId) && nextSessions.some((row) => row.session_id === selectedSessionId);
          const nextSessionId = hasCurrent ? selectedSessionId : nextSessions[0].session_id;
          await loadSessionTimeline(nextSessionId);
        }
      } catch (err) {
        setError(err?.response?.data?.detail || "Unable to load telemetry right now.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [hours, loadSessionTimeline, selectedSessionId]
  );

  const downloadBlockedExport = useCallback(async (format) => {
    setExportingFormat(format);
    try {
      const response = await axios.get(`${API_BASE}/soc/blocked-ips/export`, {
        params: { format },
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: response.data?.type || "application/octet-stream" });
      const target = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = target;
      link.download = fileNameFromDisposition(response.headers?.["content-disposition"], suggestedFileName(format));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(target);
    } catch (err) {
      setError(err?.response?.data?.detail || "Unable to export blocked IP list right now.");
    } finally {
      setExportingFormat("");
    }
  }, []);

  useEffect(() => {
    loadTelemetry();
  }, [loadTelemetry]);

  const totals = summary?.totals || { events: 0, unique_ips: 0, unique_sessions: 0, high_risk_events: 0, avg_score: 0 };
  const topEventTypes = Array.isArray(summary?.top_event_types) ? summary.top_event_types : [];
  const behaviorBreakdown = Array.isArray(summary?.behavior_breakdown) ? summary.behavior_breakdown : [];
  const topDecoys = Array.isArray(summary?.top_decoys) ? summary.top_decoys : [];
  const topSourceIps = Array.isArray(summary?.top_source_ips) ? summary.top_source_ips : [];
  const responsePosture = summary?.response_posture || {
    active_blocks: 0,
    repeat_offenders: 0,
    repeat_threshold: 0,
    window_minutes: 0,
    auto_block_enabled: false,
  };

  const primaryBehavior = useMemo(() => {
    if (behaviorBreakdown.length === 0) {
      return "unknown";
    }
    return String(behaviorBreakdown[0]?.behavior || "unknown").replaceAll("_", " ");
  }, [behaviorBreakdown]);

  return (
    <div style={{ padding: "24px", color: "#e6edf3", fontFamily: "var(--font-body)" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 900, letterSpacing: "0.4px" }}>Product Telemetry Center</h1>
          <p style={{ margin: "6px 0 0", color: "#8b949e", fontSize: "14px" }}>
            Decoy interaction telemetry, attacker behavior analytics, and session-level threat context.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{ color: "#8b949e", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
            <Clock3 size={14} />
            Window
          </label>
          <select
            value={hours}
            onChange={(event) => setHours(Number(event.target.value || 24))}
            style={{ background: "#0d1117", color: "#e6edf3", border: "1px solid #30363d", borderRadius: "8px", padding: "8px 10px" }}
          >
            {HOURS_OPTIONS.map((option) => (
              <option value={option} key={option}>
                Last {option}h
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadTelemetry({ silent: true })}
            disabled={refreshing}
            style={{
              border: "1px solid #30363d",
              background: "rgba(56,139,253,0.12)",
              color: "#93c5fd",
              borderRadius: "8px",
              padding: "8px 12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 700,
              cursor: refreshing ? "not-allowed" : "pointer",
            }}
          >
            <RefreshCw
              size={14}
              style={refreshing ? { animation: "spin 1s linear infinite" } : undefined}
            />
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div style={{ ...panelStyle, borderColor: "rgba(248,113,113,0.5)", color: "#fecaca", padding: "12px 14px", marginBottom: "16px" }}>{error}</div>
      ) : null}

      <section style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: "16px" }}>
        <MetricCard icon={<Activity size={16} />} label="Telemetry Events" value={totals.events} hint={`Window: ${hours}h`} color="#58a6ff" />
        <MetricCard icon={<Target size={16} />} label="Unique Sessions" value={totals.unique_sessions} hint="Sessionized attacker activity" color="#22d3ee" />
        <MetricCard icon={<ShieldAlert size={16} />} label="High Risk Events" value={totals.high_risk_events} hint={`Avg score: ${totals.avg_score}`} color="#f87171" />
        <MetricCard icon={<AlertTriangle size={16} />} label="Unique Source IPs" value={totals.unique_ips} hint={`Primary behavior: ${primaryBehavior}`} color="#fbbf24" />
      </section>

      <section style={{ ...panelStyle, padding: "14px", marginBottom: "16px" }}>
        <div style={{ fontSize: "12px", color: "#8b949e", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", fontWeight: 700 }}>
          AI Analyst Summary
        </div>
        <div style={{ color: "#d1d5db", fontSize: "14px", lineHeight: 1.5 }}>
          {summary?.ai_summary || (loading ? "Building telemetry summary..." : "No telemetry events in current window.")}
        </div>
      </section>

      <section style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr", marginBottom: "16px" }}>
        <div style={{ ...panelStyle, padding: "12px" }}>
          <div style={{ fontSize: "12px", color: "#8b949e", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", fontWeight: 700 }}>
            Top Attack Types
          </div>
          {topEventTypes.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: "13px" }}>No attack telemetry yet.</div>
          ) : (
            topEventTypes.map((row) => (
              <div key={row.event_type} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(48,54,61,0.45)" }}>
                <span style={{ color: "#e6edf3" }}>{String(row.event_type || "unknown").replaceAll("_", " ")}</span>
                <span style={{ color: "#93c5fd", fontWeight: 700 }}>{row.count}</span>
              </div>
            ))
          )}
        </div>
        <div style={{ ...panelStyle, padding: "12px" }}>
          <div style={{ fontSize: "12px", color: "#8b949e", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", fontWeight: 700 }}>
            Behavior Breakdown
          </div>
          {behaviorBreakdown.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: "13px" }}>No behavior clusters yet.</div>
          ) : (
            behaviorBreakdown.map((row) => (
              <div key={row.behavior} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(48,54,61,0.45)" }}>
                <span style={{ color: "#e6edf3" }}>{String(row.behavior || "unknown").replaceAll("_", " ")}</span>
                <span style={{ color: "#34d399", fontWeight: 700 }}>{row.count}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr", marginBottom: "16px" }}>
        <div style={{ ...panelStyle, padding: "12px" }}>
          <div style={{ fontSize: "12px", color: "#8b949e", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", fontWeight: 700 }}>
            Top Source IPs
          </div>
          {topSourceIps.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: "13px" }}>No source IP activity yet.</div>
          ) : (
            topSourceIps.map((row) => (
              <div key={`${row.ip}-${row.count}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(48,54,61,0.45)", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#93c5fd", fontFamily: "monospace" }}>{row.ip || "unknown"}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {row.blocked ? (
                    <span style={{ color: "#fca5a5", background: "rgba(248,113,113,0.16)", border: "1px solid rgba(248,113,113,0.45)", borderRadius: "999px", padding: "2px 8px", fontSize: "10px", fontWeight: 700 }}>
                      BLOCKED
                    </span>
                  ) : null}
                  <span style={{ color: "#60a5fa", fontWeight: 700 }}>{row.count}</span>
                </div>
              </div>
            ))
          )}
        </div>
        <div style={{ ...panelStyle, padding: "12px" }}>
          <div style={{ fontSize: "12px", color: "#8b949e", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", fontWeight: 700 }}>
            Response Posture
          </div>
          <div style={{ display: "grid", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#d1d5db", fontSize: "13px" }}>
              <span>Auto Block Engine</span>
              <span style={{ color: responsePosture.auto_block_enabled ? "#86efac" : "#fca5a5", fontWeight: 700 }}>
                {responsePosture.auto_block_enabled ? "ENABLED" : "DISABLED"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#d1d5db", fontSize: "13px" }}>
              <span>Active Blocks</span>
              <span style={{ color: "#fca5a5", fontWeight: 700 }}>{responsePosture.active_blocks}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#d1d5db", fontSize: "13px" }}>
              <span>Repeat Offenders</span>
              <span style={{ color: "#fbbf24", fontWeight: 700 }}>{responsePosture.repeat_offenders}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#8b949e", fontSize: "12px" }}>
              <span>Trigger Rule</span>
              <span>{responsePosture.repeat_threshold} events / {responsePosture.window_minutes}m</span>
            </div>
            <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(48,54,61,0.45)" }}>
              <div style={{ color: "#8b949e", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", fontWeight: 700 }}>
                Edge Export
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {[
                  { format: "nginx", label: "Nginx" },
                  { format: "plain", label: "TXT" },
                  { format: "cloudflare-json", label: "Cloudflare JSON" },
                ].map((item) => (
                  <button
                    key={item.format}
                    type="button"
                    onClick={() => downloadBlockedExport(item.format)}
                    disabled={exportingFormat !== "" && exportingFormat !== item.format}
                    style={{
                      border: "1px solid #334155",
                      background: "rgba(2,6,23,0.85)",
                      color: "#93c5fd",
                      borderRadius: "8px",
                      padding: "6px 10px",
                      cursor: exportingFormat !== "" && exportingFormat !== item.format ? "not-allowed" : "pointer",
                      fontWeight: 700,
                      fontSize: "11px",
                    }}
                  >
                    {exportingFormat === item.format ? `Exporting ${item.label}...` : item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ ...panelStyle, padding: "12px", overflowX: "auto" }}>
          <div style={{ fontSize: "12px", color: "#8b949e", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", fontWeight: 700 }}>
            Active Sessions
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: "520px" }}>
            <thead>
              <tr style={{ color: "#8b949e", textAlign: "left" }}>
                <th style={{ padding: "8px 6px" }}>Session</th>
                <th style={{ padding: "8px 6px" }}>Severity</th>
                <th style={{ padding: "8px 6px" }}>Events</th>
                <th style={{ padding: "8px 6px" }}>Max Score</th>
                <th style={{ padding: "8px 6px" }}>Last Seen</th>
                <th style={{ padding: "8px 6px" }}>Timeline</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "12px 6px", color: "#6b7280" }}>
                    {loading ? "Loading sessions..." : "No active sessions in selected window."}
                  </td>
                </tr>
              ) : (
                sessions.map((row) => {
                  const tone = severityTone(row.severity);
                  return (
                    <tr key={row.session_id} style={{ borderTop: "1px solid rgba(48,54,61,0.45)", background: row.session_id === selectedSessionId ? "rgba(37,99,235,0.08)" : "transparent" }}>
                      <td style={{ padding: "8px 6px", color: "#e6edf3", fontFamily: "monospace" }}>{row.session_id}</td>
                      <td style={{ padding: "8px 6px" }}>
                        <span style={{ color: tone.color, background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: "999px", padding: "2px 8px", fontWeight: 700 }}>
                          {String(row.severity || "low").toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "8px 6px", color: "#e6edf3" }}>{row.event_count}</td>
                      <td style={{ padding: "8px 6px", color: "#fde047" }}>{row.max_score}</td>
                      <td style={{ padding: "8px 6px", color: "#8b949e" }}>{toLocalTimestamp(row.last_seen)}</td>
                      <td style={{ padding: "8px 6px" }}>
                        <button
                          type="button"
                          onClick={() => loadSessionTimeline(row.session_id)}
                          style={{
                            border: "1px solid #334155",
                            background: "rgba(2,6,23,0.85)",
                            color: "#93c5fd",
                            borderRadius: "8px",
                            padding: "5px 8px",
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: "11px",
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ ...panelStyle, padding: "12px", overflowX: "auto" }}>
          <div style={{ fontSize: "12px", color: "#8b949e", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", fontWeight: 700 }}>
            Recent Telemetry Events
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: "560px" }}>
            <thead>
              <tr style={{ color: "#8b949e", textAlign: "left" }}>
                <th style={{ padding: "8px 6px" }}>Type</th>
                <th style={{ padding: "8px 6px" }}>Behavior</th>
                <th style={{ padding: "8px 6px" }}>IP</th>
                <th style={{ padding: "8px 6px" }}>Score</th>
                <th style={{ padding: "8px 6px" }}>Decoy</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "12px 6px", color: "#6b7280" }}>
                    {loading ? "Loading events..." : "No telemetry events available."}
                  </td>
                </tr>
              ) : (
                events.map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid rgba(48,54,61,0.45)" }}>
                    <td style={{ padding: "8px 6px", color: "#e6edf3" }}>{String(row.event_type || "unknown").replaceAll("_", " ")}</td>
                    <td style={{ padding: "8px 6px", color: "#34d399" }}>{String(row.behavior || "unknown").replaceAll("_", " ")}</td>
                    <td style={{ padding: "8px 6px", color: "#93c5fd", fontFamily: "monospace" }}>{row.ip || "unknown"}</td>
                    <td style={{ padding: "8px 6px", color: "#fde047", fontWeight: 700 }}>{row.score}</td>
                    <td style={{ padding: "8px 6px", color: "#8b949e" }}>{row.decoy || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ ...panelStyle, padding: "12px", marginTop: "16px" }}>
        <div style={{ fontSize: "12px", color: "#8b949e", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", fontWeight: 700 }}>
          Session Journey Timeline
        </div>
        {selectedSessionId ? (
          <div style={{ marginBottom: "8px", color: "#93c5fd", fontFamily: "monospace", fontSize: "12px" }}>
            Session: {selectedSessionId}
          </div>
        ) : null}
        <div style={{ color: "#9ca3af", fontSize: "13px", marginBottom: "10px" }}>
          {timelineSummary || "Select a session to inspect attacker journey order."}
        </div>
        {timelineLoading ? (
          <div style={{ color: "#6b7280", fontSize: "13px" }}>Loading session timeline...</div>
        ) : sessionTimeline.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: "13px" }}>No timeline events for current selection.</div>
        ) : (
          <div style={{ display: "grid", gap: "8px" }}>
            {sessionTimeline.map((item) => {
              const tone = severityTone(item.severity);
              return (
                <div key={`${item.event_id}-${item.step}`} style={{ ...panelStyle, padding: "10px", background: "rgba(2,6,23,0.85)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                    <div style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: 700 }}>
                      Step {item.step}: {String(item.event_type || "unknown").replaceAll("_", " ")}
                    </div>
                    <div style={{ color: tone.color, fontSize: "12px", fontWeight: 700 }}>
                      {String(item.severity || "low").toUpperCase()} | Score {item.score}
                    </div>
                  </div>
                  <div style={{ color: "#8b949e", fontSize: "12px", marginTop: "4px" }}>
                    {item.path || item.command || "-"} | {String(item.behavior || "unknown").replaceAll("_", " ")} | {toLocalTimestamp(item.timestamp)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={{ ...panelStyle, padding: "12px", marginTop: "16px" }}>
        <div style={{ fontSize: "12px", color: "#8b949e", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", fontWeight: 700 }}>
          Top Targeted Decoys
        </div>
        {topDecoys.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: "13px" }}>No decoy hit data in this window.</div>
        ) : (
          <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {topDecoys.map((row) => (
              <div key={`${row.decoy}-${row.count}`} style={{ ...panelStyle, padding: "10px", background: "rgba(3,8,20,0.8)" }}>
                <div style={{ color: "#e6edf3", fontSize: "13px", marginBottom: "5px", wordBreak: "break-all" }}>{row.decoy}</div>
                <div style={{ color: "#60a5fa", fontWeight: 800, fontSize: "12px" }}>{row.count} hits</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
