import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AlertCircle, Inbox, RefreshCw, Search, X } from "lucide-react";
import { API_BASE } from "./apiConfig";

type LeadFilters = {
  request_type: string;
  status: string;
  assigned_to: string;
  q: string;
  created_from: string;
  created_to: string;
};

type Lead = {
  id: number;
  created_at?: string;
  updated_at?: string;
  request_type?: string;
  assigned_to?: string;
  spam_score?: number;
  is_repeat?: boolean;
  name?: string;
  email?: string;
  organization?: string;
  use_case?: string;
  message?: string;
  status?: string;
  notification_error?: string;
  notification_channel_status?: Record<string, string>;
  notification_sent_at?: string;
  source_page?: string;
  campaign?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  first_response_at?: string;
};

type LeadOwner = {
  username: string;
};

type LeadNote = {
  id: number | string;
  author_username?: string;
  created_at?: string;
  note_text?: string;
};

type LeadStatusHistoryEntry = {
  id: number | string;
  old_status?: string;
  new_status?: string;
  changed_by_username?: string;
  changed_at?: string;
};

type LeadDetail = {
  lead: Lead;
  notes?: LeadNote[];
  status_history?: LeadStatusHistoryEntry[];
};

type LeadMeta = {
  total: number;
  limit: number;
  offset: number;
};

type LeadReport = {
  totals?: {
    all?: number;
    repeat?: number;
    notification_failures?: number;
  };
  demo_requests_by_week?: Array<{ count?: number }>;
};

type StatusConfigResponse = {
  statuses?: string[];
  transitions?: Record<string, string[]>;
};

type LeadListResponse = {
  items?: Lead[];
  total?: number;
  limit?: number;
  offset?: number;
};

type LeadOwnersResponse = {
  owners?: LeadOwner[];
};

type LeadStatusUpdateResponse = {
  lead?: Lead;
  history_item?: LeadStatusHistoryEntry;
};

type LeadNoteResponse = {
  note?: LeadNote;
  lead?: Lead;
};

type LeadAssignResponse = {
  lead?: Lead;
};

type ApiErrorResponse = {
  detail?: string;
};

const FALLBACK_STATUS_OPTIONS = [
  "new",
  "contacted",
  "qualified",
  "demo_scheduled",
  "closed_won",
  "closed_lost",
  "spam",
];

const INITIAL_FILTERS: LeadFilters = {
  request_type: "",
  status: "",
  assigned_to: "",
  q: "",
  created_from: "",
  created_to: "",
};

const panelStyle: React.CSSProperties = {
  border: "1px solid #30363d",
  borderRadius: "12px",
  background: "rgba(13,17,23,0.85)",
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

function statusLabel(value: string | null | undefined) {
  return String(value || "").split("_").join(" ");
}

function toneForStatus(value: string | null | undefined) {
  const tones: Record<string, { bg: string; color: string; border: string }> = {
    new: { bg: "rgba(56,139,253,0.18)", color: "#93c5fd", border: "rgba(56,139,253,0.42)" },
    contacted: { bg: "rgba(45,212,191,0.15)", color: "#5eead4", border: "rgba(45,212,191,0.42)" },
    qualified: { bg: "rgba(163,230,53,0.16)", color: "#bef264", border: "rgba(163,230,53,0.38)" },
    demo_scheduled: { bg: "rgba(250,204,21,0.17)", color: "#fde047", border: "rgba(250,204,21,0.4)" },
    closed_won: { bg: "rgba(34,197,94,0.17)", color: "#86efac", border: "rgba(34,197,94,0.4)" },
    closed_lost: { bg: "rgba(248,113,113,0.16)", color: "#fca5a5", border: "rgba(248,113,113,0.45)" },
    spam: { bg: "rgba(148,163,184,0.16)", color: "#cbd5e1", border: "rgba(148,163,184,0.45)" },
  };
  return tones[String(value || "").toLowerCase()] || tones.new;
}

function hasNotificationFailure(lead: Lead | null | undefined) {
  if (!lead) {
    return false;
  }
  const channelStates =
    lead.notification_channel_status && typeof lead.notification_channel_status === "object"
      ? Object.values(lead.notification_channel_status)
      : [];
  return Boolean(lead.notification_error) || channelStates.includes("error");
}

function notificationTone(value: string | null | undefined) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "sent") {
    return { color: "#86efac", border: "rgba(34,197,94,0.4)" };
  }
  if (normalized === "partial") {
    return { color: "#fde047", border: "rgba(250,204,21,0.45)" };
  }
  if (normalized === "error") {
    return { color: "#fca5a5", border: "rgba(248,113,113,0.45)" };
  }
  if (normalized.startsWith("skipped")) {
    return { color: "#cbd5e1", border: "rgba(148,163,184,0.45)" };
  }
  if (normalized === "no_channels" || normalized === "disabled" || normalized === "duplicate" || normalized === "blocked") {
    return { color: "#cbd5e1", border: "rgba(148,163,184,0.45)" };
  }
  return { color: "#93c5fd", border: "rgba(88,166,255,0.3)" };
}

function notificationLabel(lead: Lead | null | undefined) {
  if (!lead || String(lead.request_type || "").toLowerCase() !== "demo") {
    return "n/a";
  }
  const systemState = String(lead.notification_channel_status?.system || "").toLowerCase();
  if (systemState === "blocked" || systemState === "duplicate" || systemState === "no_channels") {
    return systemState;
  }
  if (hasNotificationFailure(lead)) {
    if (lead.notification_sent_at) {
      return "partial";
    }
    return "failed";
  }
  if (lead.notification_sent_at) {
    return "sent";
  }
  return "pending";
}

export default function AdminLeads() {
  const [filters, setFilters] = useState<LeadFilters>(INITIAL_FILTERS);
  const [query, setQuery] = useState<LeadFilters>(INITIAL_FILTERS);
  const [statusOptions, setStatusOptions] = useState<string[]>(FALLBACK_STATUS_OPTIONS);
  const [statusTransitions, setStatusTransitions] = useState<Record<string, string[]>>({});
  const [leads, setLeads] = useState<Lead[]>([]);
  const [meta, setMeta] = useState<LeadMeta>({ total: 0, limit: 50, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [owners, setOwners] = useState<LeadOwner[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [report, setReport] = useState<LeadReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const loadStatusConfig = useCallback(async () => {
    try {
      const response = await axios.get<StatusConfigResponse>(`${API_BASE}/admin/leads/statuses`);
      const data = response.data || {};
      setStatusOptions(
        Array.isArray(data.statuses) && data.statuses.length > 0 ? data.statuses : FALLBACK_STATUS_OPTIONS
      );
      setStatusTransitions(data.transitions && typeof data.transitions === "object" ? data.transitions : {});
    } catch {
      setStatusOptions(FALLBACK_STATUS_OPTIONS);
      setStatusTransitions({});
    }
  }, []);

  const loadLeads = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError("");
      try {
        const response = await axios.get<LeadListResponse>(`${API_BASE}/admin/leads`, {
          params: {
            request_type: query.request_type || undefined,
            status: query.status || undefined,
            assigned_to: query.assigned_to || undefined,
            q: query.q || undefined,
            created_from: query.created_from || undefined,
            created_to: query.created_to || undefined,
            limit: meta.limit,
            offset: 0,
          },
        });
        const data = response.data || {};
        setLeads(Array.isArray(data.items) ? data.items : []);
        setMeta({ total: Number(data.total || 0), limit: Number(data.limit || 50), offset: Number(data.offset || 0) });
      } catch (err) {
        setError(getErrorMessage(err, "Unable to load leads at the moment."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [query.request_type, query.status, query.assigned_to, query.q, query.created_from, query.created_to, meta.limit]
  );

  const loadOwners = useCallback(async () => {
    try {
      const response = await axios.get<LeadOwnersResponse>(`${API_BASE}/admin/leads/owners`);
      const nextOwners = Array.isArray(response.data?.owners) ? response.data.owners : [];
      setOwners(nextOwners);
    } catch {
      setOwners([]);
    }
  }, []);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const response = await axios.get<LeadReport>(`${API_BASE}/admin/leads/report`);
      setReport(response.data || null);
    } catch {
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  }, []);

  const loadLeadDetail = useCallback(async (leadId: number) => {
    setDetailLoading(true);
    setDetailError("");
    try {
      const response = await axios.get<LeadDetail>(`${API_BASE}/admin/leads/${leadId}`);
      setDetail(response.data || null);
    } catch (err) {
      setDetail(null);
      setDetailError(getErrorMessage(err, "Unable to load lead details."));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatusConfig();
  }, [loadStatusConfig]);

  useEffect(() => {
    loadOwners();
    loadReport();
  }, [loadOwners, loadReport]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const summaryText = useMemo(() => {
    const type = query.request_type ? query.request_type.toUpperCase() : "ALL";
    const status = query.status ? query.status.toUpperCase() : "ANY STATUS";
    return `${meta.total} leads | ${type} | ${status}`;
  }, [meta.total, query.request_type, query.status]);

  const rowStatusOptions = (currentStatus: string | null | undefined) => {
    const normalized = String(currentStatus || "new");
    const allowed = Array.isArray(statusTransitions?.[normalized]) ? statusTransitions[normalized] : [];
    const allowedSet = new Set([normalized, ...allowed]);
    const ordered = statusOptions.filter((value) => allowedSet.has(value));
    return ordered.length > 0 ? ordered : statusOptions;
  };

  const openLeadDetail = async (leadId: number) => {
    setSelectedLeadId(leadId);
    setNoteText("");
    await loadLeadDetail(leadId);
  };

  const closeLeadDetail = () => {
    setSelectedLeadId(null);
    setDetail(null);
    setDetailError("");
    setNoteText("");
  };

  const handleStatusUpdate = async (leadId: number, nextStatus: string) => {
    setUpdatingId(leadId);
    try {
      const response = await axios.post<LeadStatusUpdateResponse>(`${API_BASE}/admin/leads/${leadId}/status`, { status: nextStatus });
      const nextLead = response?.data?.lead;
      const historyItem = response?.data?.history_item;
      if (nextLead) {
        setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, ...nextLead } : lead)));
      }
      if (selectedLeadId === leadId) {
        setDetail((prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            lead: nextLead || prev.lead,
            status_history: historyItem ? [historyItem, ...(prev.status_history || [])] : prev.status_history || [],
          };
        });
      }
      loadReport();
    } catch (err) {
      window.alert(getErrorMessage(err, "Failed to update lead status."));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAddNote = async () => {
    if (!selectedLeadId) {
      return;
    }
    const trimmed = noteText.trim();
    if (trimmed.length < 2) {
      window.alert("Note must be at least 2 characters.");
      return;
    }

    setSavingNote(true);
    try {
      const response = await axios.post<LeadNoteResponse>(`${API_BASE}/admin/leads/${selectedLeadId}/notes`, { note: trimmed });
      const note = response?.data?.note;
      const nextLead = response?.data?.lead;
      if (note) {
        setDetail((prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            lead: nextLead || prev.lead,
            notes: [note, ...(Array.isArray(prev.notes) ? prev.notes : [])],
          };
        });
      }
      if (nextLead) {
        setLeads((prev) => prev.map((lead) => (lead.id === selectedLeadId ? { ...lead, ...nextLead } : lead)));
      }
      setNoteText("");
      loadReport();
    } catch (err) {
      window.alert(getErrorMessage(err, "Unable to save note."));
    } finally {
      setSavingNote(false);
    }
  };

  const handleAssign = async (assignedTo: string) => {
    if (!selectedLeadId) {
      return;
    }
    setAssigning(true);
    try {
      const response = await axios.post<LeadAssignResponse>(`${API_BASE}/admin/leads/${selectedLeadId}/assign`, {
        assigned_to: assignedTo || "",
      });
      const nextLead = response?.data?.lead;
      if (nextLead) {
        setDetail((prev) => {
          if (!prev) {
            return prev;
          }
          return { ...prev, lead: nextLead };
        });
        setLeads((prev) => prev.map((lead) => (lead.id === selectedLeadId ? { ...lead, ...nextLead } : lead)));
      }
      loadReport();
    } catch (err) {
      window.alert(getErrorMessage(err, "Unable to assign lead."));
    } finally {
      setAssigning(false);
    }
  };

  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuery({ ...filters });
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (query.request_type) {
      params.set("request_type", query.request_type);
    }
    if (query.status) {
      params.set("status", query.status);
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    if (typeof window !== "undefined") {
      window.open(`${API_BASE}/admin/leads/export.csv${suffix}`, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div style={{ padding: "36px 44px", minHeight: "100vh", background: "#010409", color: "#e6edf3" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "30px", fontWeight: 900 }}>Lead Inbox</h1>
          <p style={{ margin: "6px 0 0", color: "#8b949e", fontSize: "13px" }}>{summaryText}</p>
        </div>
        <div style={{ display: "inline-flex", gap: "8px" }}>
          <button
            type="button"
            onClick={handleExport}
            style={{ border: "1px solid rgba(45,212,191,0.45)", background: "rgba(15,118,110,0.2)", color: "#99f6e4", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              loadLeads({ silent: true });
              loadReport();
            }}
            disabled={refreshing}
            style={{ border: "1px solid #30363d", background: "#161b22", color: "#e6edf3", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <RefreshCw size={14} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      <form onSubmit={applyFilters} style={{ ...panelStyle, display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr auto", gap: "10px", marginBottom: "16px", padding: "12px" }}>
        <label style={{ display: "grid", gap: "4px" }}>
          <span style={{ fontSize: "11px", color: "#8b949e", fontWeight: 700 }}>Search</span>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: "10px", top: "10px", color: "#8b949e" }} />
            <input
              value={filters.q}
              onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
              placeholder="Name, email, organization, use case"
              style={{ width: "100%", padding: "8px 10px 8px 30px", borderRadius: "8px", border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3" }}
            />
          </div>
        </label>

        <SelectField label="Type" value={filters.request_type} onChange={(value) => setFilters((prev) => ({ ...prev, request_type: value }))} options={["", "contact", "demo"]} />
        <SelectField label="Status" value={filters.status} onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))} options={["", ...statusOptions]} format={statusLabel} />
        <SelectField
          label="Owner"
          value={filters.assigned_to}
          onChange={(value) => setFilters((prev) => ({ ...prev, assigned_to: value }))}
          options={["", ...owners.map((owner) => owner.username)]}
        />
        <DateField label="From" value={filters.created_from} onChange={(value) => setFilters((prev) => ({ ...prev, created_from: value }))} />
        <DateField label="To" value={filters.created_to} onChange={(value) => setFilters((prev) => ({ ...prev, created_to: value }))} />
        <button type="submit" style={{ alignSelf: "end", border: "1px solid rgba(88,166,255,0.4)", background: "rgba(30,64,175,0.25)", color: "#dbeafe", borderRadius: "8px", padding: "8px 14px", fontWeight: 800, cursor: "pointer" }}>Apply</button>
      </form>

      <div style={{ ...panelStyle, padding: "12px", marginBottom: "16px" }}>
        <div style={{ fontSize: "12px", fontWeight: 800, color: "#8b949e", marginBottom: "10px" }}>Lead Metrics</div>
        {reportLoading ? (
          <div style={{ color: "#8b949e", fontSize: "12px" }}>Loading metrics...</div>
        ) : report ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
            <MetricCard label="Total Leads" value={report?.totals?.all ?? 0} />
            <MetricCard label="Repeat Leads" value={report?.totals?.repeat ?? 0} />
            <MetricCard label="Notify Failures" value={report?.totals?.notification_failures ?? 0} />
            <MetricCard label="Demo This Window" value={(report?.demo_requests_by_week || []).reduce((sum, item) => sum + Number(item?.count || 0), 0)} />
          </div>
        ) : (
          <div style={{ color: "#8b949e", fontSize: "12px" }}>Metrics unavailable.</div>
        )}
      </div>

      {error ? (
        <div style={{ border: "1px solid rgba(248,113,113,0.5)", background: "rgba(127,29,29,0.35)", borderRadius: "10px", padding: "10px 12px", color: "#fecaca", display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={16} /> {error}
        </div>
      ) : null}

      {loading ? <div style={{ color: "#8b949e", padding: "14px 0" }}>Loading lead inbox...</div> : null}

      {!loading && leads.length === 0 ? (
        <div style={{ ...panelStyle, marginTop: "8px", padding: "30px 16px", textAlign: "center", color: "#8b949e" }}>
          <Inbox size={30} style={{ marginBottom: "10px" }} />
          No lead requests match current filters.
        </div>
      ) : null}

      {!loading && leads.length > 0 ? (
        <div style={{ ...panelStyle, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#161b22" }}>
                <Th>Created</Th><Th>Type</Th><Th>Name</Th><Th>Email</Th><Th>Organization</Th><Th>Use Case</Th><Th>Message</Th><Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => openLeadDetail(lead.id)}
                  style={{ borderTop: "1px solid #21262d", cursor: "pointer", background: selectedLeadId === lead.id ? "rgba(56,139,253,0.08)" : "transparent" }}
                >
                  <Td>{lead.created_at ? new Date(lead.created_at).toLocaleString() : "n/a"}</Td>
                  <Td>
                    <div style={{ display: "grid", gap: "6px" }}>
                      <Badge border="rgba(88,166,255,0.3)" color="#93c5fd">{lead.request_type}</Badge>
                      {lead.assigned_to ? <Badge border="rgba(45,212,191,0.45)" color="#5eead4">{lead.assigned_to}</Badge> : null}
                      {Number(lead.spam_score || 0) > 0 ? <Badge border="rgba(244,114,182,0.45)" color="#f9a8d4">spam {lead.spam_score}</Badge> : null}
                      {lead.is_repeat ? <Badge border="rgba(250,204,21,0.45)" color="#fde047">repeat</Badge> : null}
                      {hasNotificationFailure(lead) ? <Badge border="rgba(248,113,113,0.45)" color="#fca5a5">notify error</Badge> : null}
                    </div>
                  </Td>
                  <Td>{lead.name}</Td>
                  <Td>{lead.email}</Td>
                  <Td>{lead.organization}</Td>
                  <Td>{lead.use_case}</Td>
                  <Td><div style={{ maxWidth: "260px", lineHeight: 1.4 }}>{lead.message}</div></Td>
                  <Td>
                    <span style={{ display: "inline-flex", marginBottom: "6px", padding: "3px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", background: toneForStatus(lead.status).bg, color: toneForStatus(lead.status).color, border: `1px solid ${toneForStatus(lead.status).border}` }}>
                      {statusLabel(lead.status)}
                    </span>
                    <select
                      value={lead.status || "new"}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => handleStatusUpdate(lead.id, event.target.value)}
                      disabled={updatingId === lead.id}
                      style={{ padding: "6px 8px", borderRadius: "8px", border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3", fontSize: "12px" }}
                    >
                      {rowStatusOptions(lead.status).map((status) => (
                        <option key={status} value={status}>{statusLabel(status)}</option>
                      ))}
                    </select>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {selectedLeadId ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
          <div onClick={closeLeadDetail} style={{ position: "absolute", inset: 0, background: "rgba(1,4,9,0.75)" }} />
          <aside style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "min(560px, 96vw)", background: "#0d1117", borderLeft: "1px solid #30363d", display: "flex", flexDirection: "column" }}>
            <header style={{ padding: "16px", borderBottom: "1px solid #30363d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "17px", fontWeight: 900 }}>Lead Details</div>
                <div style={{ fontSize: "12px", color: "#8b949e" }}>{detail?.lead?.email || "Loading details"}</div>
              </div>
              <button type="button" onClick={closeLeadDetail} style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1px solid #30363d", background: "#161b22", color: "#c9d1d9", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </header>

            <div style={{ padding: "16px", overflowY: "auto", display: "grid", gap: "14px" }}>
              {detailLoading ? <div style={{ color: "#8b949e" }}>Loading lead details...</div> : null}
              {!detailLoading && detailError ? <div style={{ color: "#fecaca" }}>{detailError}</div> : null}
              {!detailLoading && detail?.lead ? (
                <>
                  <DetailCard title="Submission">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "8px", marginBottom: "10px" }}>
                      <SummaryPill label="Created" value={detail.lead.created_at ? new Date(detail.lead.created_at).toLocaleDateString() : "n/a"} />
                      <SummaryPill label="Owner" value={detail.lead.assigned_to || "unassigned"} />
                      <SummaryPill label="Status" value={statusLabel(detail.lead.status)} />
                      <SummaryPill label="Repeat" value={detail.lead.is_repeat ? "yes" : "no"} />
                      <SummaryPill label="Notify" value={notificationLabel(detail.lead)} />
                    </div>
                    <DetailGrid>
                      <DetailItem label="Name" value={detail.lead.name} />
                      <DetailItem label="Email" value={detail.lead.email} />
                      <DetailItem label="Organization" value={detail.lead.organization} />
                      <DetailItem label="Type" value={String(detail.lead.request_type || "").toUpperCase()} />
                      <DetailItem label="Use Case" value={detail.lead.use_case} />
                      <DetailItem label="Source" value={detail.lead.source_page || "n/a"} />
                      <DetailItem label="Campaign" value={detail.lead.campaign || "n/a"} />
                      <DetailItem label="UTM Source" value={detail.lead.utm_source || "n/a"} />
                      <DetailItem label="UTM Medium" value={detail.lead.utm_medium || "n/a"} />
                      <DetailItem label="UTM Campaign" value={detail.lead.utm_campaign || "n/a"} />
                      <DetailItem label="Submitted" value={detail.lead.created_at ? new Date(detail.lead.created_at).toLocaleString() : "n/a"} />
                      <DetailItem label="Updated" value={detail.lead.updated_at ? new Date(detail.lead.updated_at).toLocaleString() : "n/a"} />
                    </DetailGrid>
                    <div style={{ marginTop: "8px", color: "#c9d1d9", fontSize: "12px", whiteSpace: "pre-wrap" }}>{detail.lead.message}</div>
                  </DetailCard>

                  <DetailCard title="Status + Delivery">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px" }}>
                      <select value={detail.lead.status || "new"} onChange={(event) => handleStatusUpdate(detail.lead.id, event.target.value)} disabled={updatingId === detail.lead.id} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3" }}>
                        {rowStatusOptions(detail.lead.status).map((status) => (
                          <option key={status} value={status}>{statusLabel(status)}</option>
                        ))}
                      </select>
                      <Badge border="rgba(148,163,184,0.45)" color="#cbd5e1">notify: {notificationLabel(detail.lead)}</Badge>
                    </div>
                    <div style={{ marginTop: "8px", color: "#8b949e", fontSize: "12px" }}>{detail.lead.notification_error || "No notification errors"}</div>
                    {detail.lead.notification_channel_status && Object.keys(detail.lead.notification_channel_status).length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                        {Object.entries(detail.lead.notification_channel_status).map(([channel, state]) => {
                          const tone = notificationTone(state);
                          return (
                            <Badge key={channel} border={tone.border} color={tone.color}>
                              {channel}: {statusLabel(state)}
                            </Badge>
                          );
                        })}
                      </div>
                    ) : null}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", marginTop: "10px" }}>
                      <select
                        value={detail.lead.assigned_to || ""}
                        onChange={(event) => handleAssign(event.target.value)}
                        disabled={assigning}
                        style={{ padding: "8px", borderRadius: "8px", border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3" }}
                      >
                        <option value="">Unassigned</option>
                        {owners.map((owner) => (
                          <option key={owner.username} value={owner.username}>{owner.username}</option>
                        ))}
                      </select>
                      <span style={{ fontSize: "12px", color: "#8b949e", alignSelf: "center" }}>
                        {assigning ? "Assigning..." : "Owner"}
                      </span>
                    </div>
                    <div style={{ marginTop: "6px", color: "#8b949e", fontSize: "12px" }}>
                      First response: {detail.lead.first_response_at ? new Date(detail.lead.first_response_at).toLocaleString() : "pending"}
                    </div>
                  </DetailCard>

                  <DetailCard title="Internal Notes">
                    <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} rows={3} placeholder="Add internal note" style={{ width: "100%", resize: "vertical", marginBottom: "8px", padding: "8px", borderRadius: "8px", border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3" }} />
                    <button type="button" onClick={handleAddNote} disabled={savingNote} style={{ border: "1px solid rgba(88,166,255,0.4)", background: "rgba(30,64,175,0.25)", color: "#dbeafe", borderRadius: "8px", padding: "7px 12px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}>{savingNote ? "Saving..." : "Add Note"}</button>
                    {(detail.notes || []).length === 0 ? <div style={{ color: "#8b949e", fontSize: "12px" }}>No notes yet.</div> : null}
                    {(detail.notes || []).map((note) => (
                      <div key={note.id} style={{ border: "1px solid #30363d", borderRadius: "8px", padding: "8px", marginBottom: "8px", background: "#0b1016" }}>
                        <div style={{ fontSize: "11px", color: "#8b949e" }}>{note.author_username || "admin"} | {note.created_at ? new Date(note.created_at).toLocaleString() : "n/a"}</div>
                        <div style={{ fontSize: "12px", color: "#c9d1d9" }}>{note.note_text}</div>
                      </div>
                    ))}
                  </DetailCard>

                  <DetailCard title="Status History">
                    {(detail.status_history || []).length === 0 ? <div style={{ color: "#8b949e", fontSize: "12px" }}>No status changes yet.</div> : null}
                    {(detail.status_history || []).map((entry) => (
                      <div key={entry.id} style={{ border: "1px solid #30363d", borderRadius: "8px", padding: "8px", marginBottom: "8px", background: "#0b1016" }}>
                        <div style={{ fontSize: "12px", fontWeight: 700 }}>
                          {statusLabel(entry.old_status)}
                          {" -> "}
                          {statusLabel(entry.new_status)}
                        </div>
                        <div style={{ fontSize: "11px", color: "#8b949e" }}>{entry.changed_by_username || "admin"} | {entry.changed_at ? new Date(entry.changed_at).toLocaleString() : "n/a"}</div>
                      </div>
                    ))}
                  </DetailCard>
                </>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  format?: (value: string) => string;
};

function SelectField({ label, value, onChange, options, format }: SelectFieldProps) {
  return (
    <label style={{ display: "grid", gap: "4px" }}>
      <span style={{ fontSize: "11px", color: "#8b949e", fontWeight: 700 }}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3" }}>
        {options.map((option) => (
          <option key={option || "any"} value={option}>{option ? (format ? format(option) : option) : "Any"}</option>
        ))}
      </select>
    </label>
  );
}

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function DateField({ label, value, onChange }: DateFieldProps) {
  return (
    <label style={{ display: "grid", gap: "4px" }}>
      <span style={{ fontSize: "11px", color: "#8b949e", fontWeight: 700 }}>{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3" }} />
    </label>
  );
}

type BadgeProps = {
  children: React.ReactNode;
  color: string;
  border: string;
};

function Badge({ children, color, border }: BadgeProps) {
  return (
    <span style={{ fontSize: "10px", padding: "3px 7px", borderRadius: "999px", border: `1px solid ${border}`, color, textTransform: "uppercase", fontWeight: 800, width: "fit-content" }}>
      {children}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", fontSize: "11px", color: "#8b949e", padding: "10px 12px", fontWeight: 800 }}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "10px 12px", fontSize: "12px", color: "#e6edf3", verticalAlign: "top" }}>{children}</td>;
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ ...panelStyle, padding: "12px" }}>
      <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 800, marginBottom: "10px" }}>{title}</h3>
      {children}
    </section>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>{children}</div>;
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: "11px", color: "#8b949e", marginBottom: "4px", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: "12px", color: "#e6edf3", wordBreak: "break-word" }}>{value || "n/a"}</div>
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #30363d", borderRadius: "8px", padding: "8px", background: "#0b1016" }}>
      <div style={{ fontSize: "10px", color: "#8b949e", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "12px", color: "#e6edf3", marginTop: "2px", fontWeight: 700 }}>{value || "n/a"}</div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #30363d", borderRadius: "8px", padding: "10px", background: "#0b1016" }}>
      <div style={{ fontSize: "11px", color: "#8b949e", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: "18px", color: "#e6edf3", fontWeight: 900, marginTop: "4px" }}>{value}</div>
    </div>
  );
}
