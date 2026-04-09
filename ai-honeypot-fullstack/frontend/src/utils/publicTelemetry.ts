import { API_BASE } from "../apiConfig";

export type TelemetrySummary = {
  total_events: number;
  critical_events: number;
  medium_events: number;
  low_events: number;
  blocked_ips: number;
  unique_ips: number;
  unique_sessions: number;
  live_sessions: number;
  active_decoys: number;
  threat_score: number;
  top_target: string;
  risk_level: string;
  avg_score: number;
};

export type TelemetryInsights = {
  dominant_behavior: string;
  recommended_action: string;
};

export type TelemetryTarget = {
  path: string;
  hits: number;
  avg_score: number;
};

export type TelemetrySourceIp = {
  ip: string;
  events: number;
};

export type TelemetryTimeline = {
  hour: string;
  events: number;
  avg_score: number;
};

export type TelemetryFeedItem = {
  id: string | number | null;
  ts: string | number | null;
  path: string;
  severity: string;
  score: number;
  event_type: string | null;
  ip: string | null;
};

export type PublicTelemetrySnapshot = {
  scope: string;
  summary: TelemetrySummary;
  insights: TelemetryInsights;
  top_targets: TelemetryTarget[];
  top_source_ips: TelemetrySourceIp[];
  timeline: TelemetryTimeline[];
  feed: TelemetryFeedItem[];
  ai_summary: string;
  generated_at: string | null;
  window_hours: number;
  include_training: boolean;
};

const DEFAULT_RESPONSE: PublicTelemetrySnapshot = {
  scope: "unknown",
  summary: {
    total_events: 0,
    critical_events: 0,
    medium_events: 0,
    low_events: 0,
    blocked_ips: 0,
    unique_ips: 0,
    unique_sessions: 0,
    live_sessions: 0,
    active_decoys: 0,
    threat_score: 12,
    top_target: "none",
    risk_level: "low",
    avg_score: 0,
  },
  insights: {
    dominant_behavior: "unknown",
    recommended_action: "Keep telemetry and alerting active before the next scan wave.",
  },
  top_targets: [],
  top_source_ips: [],
  timeline: [],
  feed: [],
  ai_summary:
    "No recent telemetry available. Deception services are online and waiting for first-touch activity.",
  generated_at: null,
  window_hours: 24,
  include_training: false,
};

const DEFAULT_REQUEST_CONFIG = {
  params: {
    hours: 24,
    include_training: false,
    limit: 8,
  },
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toLabel = (value: unknown, fallback = "unknown") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

export function normalizePublicTelemetry(payload: unknown): PublicTelemetrySnapshot {
  const source = payload && typeof payload === "object" ? (payload as Record<string, any>) : {};
  const summary = source.summary && typeof source.summary === "object" ? source.summary : {};
  const insights = source.insights && typeof source.insights === "object" ? source.insights : {};
  const topTargetsRaw = Array.isArray(source.top_targets) ? source.top_targets : [];
  const topIpsRaw = Array.isArray(source.top_source_ips) ? source.top_source_ips : [];
  const timelineRaw = Array.isArray(source.timeline) ? source.timeline : [];
  const feedRaw = Array.isArray(source.feed) ? source.feed : [];

  return {
    ...DEFAULT_RESPONSE,
    scope: toLabel(source.scope, "unknown"),
    generated_at: source.generated_at || null,
    window_hours: toNumber(source.window_hours, 24),
    include_training: Boolean(source.include_training),
    summary: {
      total_events: toNumber(summary.total_events),
      critical_events: toNumber(summary.critical_events),
      medium_events: toNumber(summary.medium_events),
      low_events: toNumber(summary.low_events),
      blocked_ips: toNumber(summary.blocked_ips),
      unique_ips: toNumber(summary.unique_ips),
      unique_sessions: toNumber(summary.unique_sessions),
      live_sessions: toNumber(summary.live_sessions),
      active_decoys: toNumber(summary.active_decoys),
      threat_score: toNumber(summary.threat_score, 12),
      top_target: toLabel(summary.top_target, "none"),
      risk_level: toLabel(summary.risk_level, "low"),
      avg_score: toNumber(summary.avg_score),
    },
    insights: {
      dominant_behavior: toLabel(insights.dominant_behavior, "unknown"),
      recommended_action: toLabel(
        insights.recommended_action,
        "Keep telemetry and alerting active before the next scan wave."
      ),
    },
    top_targets: topTargetsRaw.map((item) => ({
      path: toLabel(item?.path, "unknown"),
      hits: toNumber(item?.hits),
      avg_score: toNumber(item?.avg_score),
    })),
    top_source_ips: topIpsRaw.map((item) => ({
      ip: toLabel(item?.ip, "unknown"),
      events: toNumber(item?.events),
    })),
    timeline: timelineRaw.map((item) => ({
      hour: toLabel(item?.hour, "--"),
      events: toNumber(item?.events),
      avg_score: toNumber(item?.avg_score),
    })),
    feed: feedRaw.map((item) => ({
      id: item?.id,
      ts: item?.ts || item?.timestamp || null,
      path: toLabel(item?.path, "unknown"),
      severity: toLabel(item?.severity, "low").toLowerCase(),
      score: toNumber(item?.score),
      event_type: item?.event_type || null,
      ip: item?.ip || null,
    })),
    ai_summary: toLabel(source.ai_summary, DEFAULT_RESPONSE.ai_summary),
  };
}

export async function fetchPublicTelemetrySnapshot(
  config: { params?: Record<string, string | number | boolean | null | undefined> } = {}
): Promise<PublicTelemetrySnapshot> {
  const mergedParams = {
    ...DEFAULT_REQUEST_CONFIG.params,
    ...(config?.params || {}),
  };
  const query = new URLSearchParams();
  Object.entries(mergedParams).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }
    query.set(key, String(value));
  });
  const requestUrl = `${API_BASE}/public/telemetry/snapshot?${query.toString()}`;
  const response = await fetch(requestUrl, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Public telemetry request failed: ${response.status}`);
  }
  const data = await response.json();
  return normalizePublicTelemetry(data);
}
