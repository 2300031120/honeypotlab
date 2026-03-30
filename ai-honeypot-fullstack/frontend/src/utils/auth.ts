// @ts-nocheck
export const AUTH_CHANGED_EVENT = "auth-changed";

function parseJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function getAuthToken() {
  return localStorage.getItem("token") || "";
}

export function getUserProfile() {
  try {
    const raw = localStorage.getItem("user_profile");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isTokenExpired(token, skewSeconds = 30) {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") {
    return true;
  }
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now + Math.max(0, skewSeconds);
}

export function isAuthenticated() {
  const token = getAuthToken();
  if (!token) return false;
  return !isTokenExpired(token);
}

export function setAuthSession(token, profile) {
  localStorage.setItem("token", token);
  if (profile) {
    localStorage.setItem("user_profile", JSON.stringify(profile));
  }
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearAuthSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user_profile");
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function buildAuthHeaders(extra = {}) {
  const token = getAuthToken();
  if (!token) return extra;
  return {
    ...extra,
    Authorization: `Bearer ${token}`,
  };
}
