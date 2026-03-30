// @ts-nocheck
import axios from "axios";
import { API_BASE } from "../apiConfig";

export const DEFAULT_AUTH_PROVIDERS = {
  googleEnabled: false,
  serverGoogleClientId: "",
  signupEnabled: true,
};

export async function loadAuthProviders(options = {}) {
  const response = await axios.get(`${API_BASE}/auth/providers`, {
    timeout: 8000,
    ...options,
  });
  const payload = response?.data || {};
  const providers = payload.providers || {};
  const googleProvider = providers.google || {};
  const signup = payload.signup || {};

  return {
    googleEnabled: Boolean(googleProvider.enabled),
    serverGoogleClientId: String(googleProvider.client_id || ""),
    signupEnabled: signup.enabled !== false,
  };
}
