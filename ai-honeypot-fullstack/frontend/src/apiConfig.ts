// Centralized API/WebSocket endpoint configuration
// These values can be overridden by environment variables when building/deploying

const trimTrailingSlash = (value?: string | null) => String(value || "").replace(/\/+$/, "");

const TUNNEL_ORIGIN = "https://app.cybersentil.online";

const defaultApiBase = (() => {
  if (typeof window !== "undefined" && window.location?.host) {
    if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      return `${TUNNEL_ORIGIN}/api/v1`;
    }
  }
  return "/api/v1";
})();

const defaultWsBase = (() => {
  if (typeof window !== "undefined" && window.location?.hostname) {
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      return `${wsProto}//app.cybersentil.online`;
    }
    return `${wsProto}//${window.location.host}`;
  }
  return "ws://localhost:5000";
})();

export const API_BASE = trimTrailingSlash(import.meta.env.VITE_API_BASE || defaultApiBase);
export const WS_BASE = trimTrailingSlash(import.meta.env.VITE_WS_BASE || defaultWsBase);
