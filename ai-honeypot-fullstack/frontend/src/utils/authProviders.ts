import axios from "axios";
import { API_BASE } from "../apiConfig";

export type AuthProviders = {
  googleEnabled: boolean;
  serverGoogleClientId: string;
  signupEnabled: boolean;
};

export const DEFAULT_AUTH_PROVIDERS: AuthProviders = {
  googleEnabled: false,
  serverGoogleClientId: "",
  signupEnabled: false,
};

export async function loadAuthProviders(options: Record<string, unknown> = {}): Promise<AuthProviders> {
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
