const GEO_POINT_LOOKUP = {
  US: { x: 150, y: 120 },
  USA: { x: 150, y: 120 },
  India: { x: 650, y: 180 },
  IN: { x: 650, y: 180 },
  China: { x: 700, y: 140 },
  CN: { x: 700, y: 140 },
  Russia: { x: 550, y: 100 },
  RU: { x: 550, y: 100 },
  Germany: { x: 450, y: 100 },
  DE: { x: 450, y: 100 },
  Brazil: { x: 200, y: 280 },
  BR: { x: 200, y: 280 },
  UK: { x: 430, y: 95 },
  GB: { x: 430, y: 95 },
  "United Kingdom": { x: 430, y: 95 },
};

const GEO_LATLNG_LOOKUP = {
  US: { lat: 37.0902, lng: -95.7129 },
  USA: { lat: 37.0902, lng: -95.7129 },
  India: { lat: 20.5937, lng: 78.9629 },
  IN: { lat: 20.5937, lng: 78.9629 },
  China: { lat: 35.8617, lng: 104.1954 },
  CN: { lat: 35.8617, lng: 104.1954 },
  Russia: { lat: 61.524, lng: 105.3188 },
  RU: { lat: 61.524, lng: 105.3188 },
  Germany: { lat: 51.1657, lng: 10.4515 },
  DE: { lat: 51.1657, lng: 10.4515 },
  Brazil: { lat: -14.235, lng: -51.9253 },
  BR: { lat: -14.235, lng: -51.9253 },
  UK: { lat: 55.3781, lng: -3.436 },
  GB: { lat: 55.3781, lng: -3.436 },
  "United Kingdom": { lat: 55.3781, lng: -3.436 },
};

const SYNTHETIC_EVENT_TYPES = new Set(["protocol_simulation", "simulated_attack", "deception_config"]);
const LOCAL_NOISE_IPS = new Set(["127.0.0.1", "::1", "localhost", "testclient"]);

function hashString(value) {
  const text = String(value ?? "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizedFromHash(value) {
  return hashString(value) / 0xffffffff;
}

export function getEventTimestampValue(event) {
  return (
    event?.timestamp_utc ||
    event?.timestamp ||
    event?.ts ||
    event?.time ||
    event?.created_at ||
    null
  );
}

export function getEventDate(event) {
  const raw = getEventTimestampValue(event);
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function getEventTimeLabel(event, locale = undefined) {
  const date = getEventDate(event);
  if (!date) return "N/A";
  return date.toLocaleTimeString(locale);
}

export function getEventIsoTime(event) {
  const date = getEventDate(event);
  if (!date) return "N/A";
  return date.toISOString();
}

export function stableHexFromText(value, length = 16) {
  const hash = hashString(value).toString(16).padStart(8, "0");
  const duplicate = `${hash}${hash}${hash}`;
  return duplicate.slice(0, Math.max(4, length));
}

export function stableGeoPoint(countryOrKey, canvasWidth = 900, canvasHeight = 420) {
  const lookup = GEO_POINT_LOOKUP[countryOrKey];
  if (lookup) return lookup;
  const key = String(countryOrKey || "unknown");
  const rx = normalizedFromHash(`${key}-x`);
  const ry = normalizedFromHash(`${key}-y`);
  return {
    x: Math.round(80 + rx * Math.max(1, canvasWidth - 160)),
    y: Math.round(70 + ry * Math.max(1, canvasHeight - 140)),
  };
}

export function stableGeoLatLng(countryOrKey, fallbackKey = "") {
  const lookup = GEO_LATLNG_LOOKUP[countryOrKey];
  if (lookup) return lookup;
  const seed = `${countryOrKey || "unknown"}|${fallbackKey || "na"}`;
  const lat = -55 + normalizedFromHash(`${seed}-lat`) * 125;
  const lng = -180 + normalizedFromHash(`${seed}-lng`) * 360;
  return { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) };
}

export function stableAlias(source, prefix = "Adversary") {
  const raw = String(source || "UNKNOWN");
  const compact = raw.replace(/[^a-zA-Z0-9]/g, "");
  const suffix = compact.slice(-6).toUpperCase() || stableHexFromText(raw, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

export function isSyntheticEvent(event) {
  const eventType = String(event?.event_type || "").toLowerCase();
  const sessionId = String(event?.session_id || event?.sessionId || "");
  const ip = String(event?.ip || "").toLowerCase();
  const ua = String(event?.ua || "").toLowerCase();

  if (SYNTHETIC_EVENT_TYPES.has(eventType)) return true;
  if (sessionId.startsWith("SIM_")) return true;
  if (LOCAL_NOISE_IPS.has(ip)) return true;
  if (ua.startsWith("protocol-simulator/") || ua.startsWith("soc-simulator/")) return true;
  return false;
}
