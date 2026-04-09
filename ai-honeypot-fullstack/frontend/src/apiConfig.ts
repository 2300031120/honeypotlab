// Centralized API/WebSocket endpoint configuration
// These values can be overridden by environment variables when building/deploying

const trimTrailingSlash = (value?: string | null) => String(value || "").replace(/\/+$/, "");

const defaultApiBase = (() => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/api`;
  }
  return "/api";
})();

const defaultWsBase = (() => {
  if (typeof window !== "undefined" && window.location?.host) {
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${window.location.host}`;
  }
  return "ws://localhost:5000";
})();

export const API_BASE = trimTrailingSlash(import.meta.env.VITE_API_BASE || defaultApiBase);
export const WS_BASE = trimTrailingSlash(import.meta.env.VITE_WS_BASE || defaultWsBase);
