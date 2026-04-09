export const AUTH_CHANGED_EVENT = "auth-changed";

export type UserProfile = {
  username?: string;
  role?: string;
  email?: string | null;
  provider?: string;
  [key: string]: unknown;
};

const USER_PROFILE_KEY = "user_profile";
const AUTH_COOKIE_NAME = "cybersentil_session";

export function getAuthToken(): string {
  if (typeof window === "undefined") return "";
  const match = document.cookie.match(new RegExp("(^| )" + AUTH_COOKIE_NAME + "=([^;]+)"));
  return match ? match[2] : "";
}

export function getUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, _leewaySeconds = 30): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp;
    if (!exp) return false;
    return Date.now() >= exp * 1000;
  } catch {
    return true;
  }
}

export function isAuthenticated() {
  return Boolean(getUserProfile());
}

export function setAuthSession(
  tokenOrProfile?: string | UserProfile | null,
  profile?: UserProfile | null
) {
  const resolvedProfile =
    tokenOrProfile && typeof tokenOrProfile === "object" ? tokenOrProfile : profile;

  if (resolvedProfile) {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(resolvedProfile));
  }
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearAuthSession() {
  localStorage.removeItem(USER_PROFILE_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function buildAuthHeaders(extra: Record<string, string> = {}) {
  return {
    ...extra,
  };
}
