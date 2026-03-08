import { API_BASE } from "../apiConfig";

const SESSION_STORAGE_KEY = "csa_analytics_session";
const EVENT_ENDPOINT = `${API_BASE}/analytics/event`;

function safeText(value, maxLen = 255) {
  const normalized = String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return "";
  }
  return normalized.slice(0, maxLen);
}

function safeEventName(value) {
  return safeText(value, 120).toLowerCase().replace(/[^a-z0-9_./:-]+/g, "_").replace(/^_+|_+$/g, "");
}

function getSessionId() {
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const generated = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function cleanProperties(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const result = {};
  Object.entries(value).forEach(([rawKey, rawVal]) => {
    const key = safeText(rawKey, 80);
    if (!key) {
      return;
    }
    if (typeof rawVal === "number" || typeof rawVal === "boolean" || rawVal === null) {
      result[key] = rawVal;
      return;
    }
    if (typeof rawVal === "string") {
      result[key] = safeText(rawVal, 500);
      return;
    }
    try {
      result[key] = safeText(JSON.stringify(rawVal), 500);
    } catch {
      result[key] = safeText(String(rawVal), 500);
    }
  });
  return result;
}

function postEvent(payload) {
  const body = JSON.stringify(payload);
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const blob = new Blob([body], { type: "application/json" });
      const sent = navigator.sendBeacon(EVENT_ENDPOINT, blob);
      if (sent) {
        return;
      }
    } catch {
      // Ignore and fallback to fetch.
    }
  }
  fetch(EVENT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function trackEvent(eventName, options = {}) {
  if (typeof window === "undefined") {
    return;
  }
  const normalizedEvent = safeEventName(eventName);
  if (!normalizedEvent) {
    return;
  }
  const payload = {
    event_name: normalizedEvent,
    event_category: safeText(options.category || "frontend", 64) || "frontend",
    page_path: safeText(options.pagePath || window.location.pathname || "/", 255),
    source: safeText(options.source || "frontend", 64) || "frontend",
    session_id: safeText(options.sessionId || getSessionId(), 120),
    request_type: safeText(options.requestType || "", 20) || null,
    lead_id: Number.isFinite(Number(options.leadId)) ? Number(options.leadId) : null,
    occurred_at_ms: Date.now(),
    properties: cleanProperties(options.properties),
  };
  postEvent(payload);
}

export function trackCtaClick(label, location, extra = {}) {
  trackEvent("cta_click", {
    category: "conversion",
    pagePath: location,
    properties: {
      label,
      location,
      ...extra,
    },
  });
}

export function trackPageVisit(pageName, pagePath) {
  trackEvent("page_visit", {
    category: "engagement",
    pagePath,
    properties: {
      page_name: pageName,
    },
  });
}
