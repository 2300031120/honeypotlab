// @ts-nocheck
import axios from "axios";
import { AUTH_CHANGED_EVENT, clearAuthSession, getAuthToken } from "./utils/auth";

let initialized = false;
const PUBLIC_PATHS = [
  "/",
  "/platform",
  "/architecture",
  "/use-cases",
  "/contact",
  "/demo",
  "/privacy",
  "/terms",
  "/security",
  "/auth/login",
  "/auth/signup",
  "/login",
  "/signup",
];

function isPublicPath(pathname) {
  const currentPath = String(pathname || "/");
  if (currentPath === "/") return true;
  return PUBLIC_PATHS.some((path) => path !== "/" && (currentPath === path || currentPath.startsWith(`${path}/`)));
}

function applyAuthHeader() {
  const token = getAuthToken();
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
  }
}

export function initAuthTransport() {
  if (initialized) return;
  initialized = true;

  applyAuthHeader();

  window.addEventListener(AUTH_CHANGED_EVENT, applyAuthHeader);
  window.addEventListener("storage", applyAuthHeader);

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error?.response?.status;
      if (status === 401) {
        const skipAuthRedirect =
          error?.config?.skipAuthRedirect === true || error?.config?.headers?.["X-Skip-Auth-Redirect"] === "1";
        clearAuthSession();
        const path = window.location.pathname || "/";
        if (!skipAuthRedirect && !isPublicPath(path)) {
          window.location.assign("/auth/login");
        }
      }
      return Promise.reject(error);
    }
  );
}
