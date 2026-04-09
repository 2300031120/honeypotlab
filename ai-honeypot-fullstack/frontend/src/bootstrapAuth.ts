import axios from "axios";
import { AUTH_CHANGED_EVENT, clearAuthSession } from "./utils/auth";

let initialized = false;
const PUBLIC_PATHS: string[] = [
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

function isPublicPath(pathname: string) {
  const currentPath = String(pathname || "/");
  if (currentPath === "/") return true;
  return PUBLIC_PATHS.some((path) => path !== "/" && (currentPath === path || currentPath.startsWith(`${path}/`)));
}

function applyAuthHeader() {
  delete axios.defaults.headers.common.Authorization;
  axios.defaults.withCredentials = true;
}

type AxiosErrorLike = {
  response?: { status?: number };
  config?: {
    skipAuthRedirect?: boolean;
    headers?: Record<string, string>;
  };
};

export function initAuthTransport() {
  if (initialized) return;
  initialized = true;

  if (typeof window === "undefined") {
    return;
  }

  applyAuthHeader();

  window.addEventListener(AUTH_CHANGED_EVENT, applyAuthHeader);
  window.addEventListener("storage", applyAuthHeader);

  axios.interceptors.response.use(
    (response) => response,
    (error: AxiosErrorLike) => {
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
