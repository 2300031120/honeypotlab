type PublicSite = {
  siteName: string;
  shortName: string;
  brandText: string;
  tagline: string;
  siteDescription: string;
  siteUrl: string;
  appUrl: string;
  loginUrl: string;
  companyName: string;
  contactEmail: string;
  securityEmail: string;
  privacyEmail: string;
  demoBookingUrl: string;
  demoBookingLabel: string;
  showStatusPill: boolean;
  hasCustomBranding: boolean;
};

const trimTrailingSlash = (value?: string | null) => String(value || "").replace(/\/+$/, "");

const boolFromEnv = (value: string | null | undefined, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

const env = (import.meta.env || {}) as Record<string, string | undefined>;
const runtimeOrigin = typeof window !== "undefined" ? trimTrailingSlash(window.location?.origin) : "";
const siteUrl = trimTrailingSlash(env.VITE_PUBLIC_SITE_URL || runtimeOrigin);
const appUrl = trimTrailingSlash(env.VITE_PUBLIC_APP_URL || siteUrl);
const siteName = String(env.VITE_PUBLIC_SITE_NAME || "CyberSentil").trim();
const shortName = String(env.VITE_PUBLIC_SHORT_NAME || siteName.replace(/\s+AI$/i, "") || siteName).trim();
const brandText = String(env.VITE_PUBLIC_BRAND_TEXT || siteName.toUpperCase()).trim();
const tagline = String(env.VITE_PUBLIC_TAGLINE || "AI deception for exposed routes").trim();
const siteDescription = String(
  env.VITE_PUBLIC_SITE_DESCRIPTION ||
    "CyberSentil helps security teams deploy believable login, admin, and API decoys, capture attacker behavior early, and turn first-touch telemetry into analyst-ready evidence.",
).trim();
const demoBookingUrl = String(env.VITE_PUBLIC_DEMO_BOOKING_URL || "").trim();
const demoBookingLabel = String(env.VITE_PUBLIC_DEMO_BOOKING_LABEL || "Book Live Slot").trim();

const defaultLoginUrl = "/auth/login";

export const PUBLIC_SITE: PublicSite = {
  siteName,
  shortName,
  brandText,
  tagline,
  siteDescription,
  siteUrl,
  appUrl,
  loginUrl: String(env.VITE_PUBLIC_LOGIN_URL || defaultLoginUrl).trim(),
  companyName: String(env.VITE_PUBLIC_COMPANY_NAME || siteName).trim(),
  contactEmail: String(env.VITE_PUBLIC_CONTACT_EMAIL || "contact@cybersentil.online").trim(),
  securityEmail: String(env.VITE_PUBLIC_SECURITY_EMAIL || "security@cybersentil.online").trim(),
  privacyEmail: String(env.VITE_PUBLIC_PRIVACY_EMAIL || "privacy@cybersentil.online").trim(),
  demoBookingUrl,
  demoBookingLabel,
  showStatusPill: boolFromEnv(env.VITE_PUBLIC_SHOW_STATUS_PILL, false),
  hasCustomBranding: Boolean(env.VITE_PUBLIC_SITE_NAME || env.VITE_PUBLIC_SHORT_NAME || env.VITE_PUBLIC_BRAND_TEXT),
};

export function applyPublicBranding(value?: string | null) {
  if (value === undefined || value === null) {
    return value;
  }

  return String(value)
    .replace(/CyberSentinel AI|CyberSentil AI/g, PUBLIC_SITE.siteName)
    .replace(/CyberSentinel|CyberSentil/g, PUBLIC_SITE.shortName || PUBLIC_SITE.siteName);
}

export function resolvePublicBrandText(explicitValue = "") {
  return PUBLIC_SITE.brandText || explicitValue;
}

export function toMailto(emailValue?: string | null) {
  const email = String(emailValue || "").trim();
  return email ? `mailto:${email}` : "";
}
