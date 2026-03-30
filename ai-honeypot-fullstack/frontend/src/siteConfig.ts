// @ts-nocheck
const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

const boolFromEnv = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

const env = import.meta.env || {};
const runtimeOrigin = typeof window !== "undefined" ? trimTrailingSlash(window.location?.origin) : "";
const siteUrl = trimTrailingSlash(env.VITE_PUBLIC_SITE_URL || runtimeOrigin);
const appUrl = trimTrailingSlash(env.VITE_PUBLIC_APP_URL || siteUrl);
const siteName = String(env.VITE_PUBLIC_SITE_NAME || "CyberSentinel AI").trim();
const shortName = String(env.VITE_PUBLIC_SHORT_NAME || siteName.replace(/\s+AI$/i, "") || siteName).trim();
const brandText = String(env.VITE_PUBLIC_BRAND_TEXT || siteName.toUpperCase()).trim();
const tagline = String(env.VITE_PUBLIC_TAGLINE || "Deception-led threat detection").trim();
const siteDescription = String(
  env.VITE_PUBLIC_SITE_DESCRIPTION ||
    "Deception-led threat detection platform for earlier attacker visibility, preserved evidence, and AI-assisted incident context.",
).trim();

const defaultLoginUrl = "/auth/login";

export const PUBLIC_SITE = {
  siteName,
  shortName,
  brandText,
  tagline,
  siteDescription,
  siteUrl,
  appUrl,
  loginUrl: String(env.VITE_PUBLIC_LOGIN_URL || defaultLoginUrl).trim(),
  companyName: String(env.VITE_PUBLIC_COMPANY_NAME || siteName).trim(),
  contactEmail: String(env.VITE_PUBLIC_CONTACT_EMAIL || "contact@cybersentinel.ai").trim(),
  securityEmail: String(env.VITE_PUBLIC_SECURITY_EMAIL || "security@cybersentinel.ai").trim(),
  privacyEmail: String(env.VITE_PUBLIC_PRIVACY_EMAIL || "privacy@cybersentinel.ai").trim(),
  showStatusPill: boolFromEnv(env.VITE_PUBLIC_SHOW_STATUS_PILL, false),
  hasCustomBranding: Boolean(env.VITE_PUBLIC_SITE_NAME || env.VITE_PUBLIC_SHORT_NAME || env.VITE_PUBLIC_BRAND_TEXT),
};

export function applyPublicBranding(value) {
  if (value === undefined || value === null) {
    return value;
  }

  return String(value)
    .replace(/CyberSentinel AI/g, PUBLIC_SITE.siteName)
    .replace(/CyberSentinel/g, PUBLIC_SITE.shortName || PUBLIC_SITE.siteName);
}

export function resolvePublicBrandText(explicitValue = "") {
  return PUBLIC_SITE.brandText || explicitValue;
}

export function toMailto(emailValue) {
  const email = String(emailValue || "").trim();
  return email ? `mailto:${email}` : "";
}
