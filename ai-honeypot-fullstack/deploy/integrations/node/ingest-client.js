"use strict";

/**
 * Normalize platform URL and return the correct ingest endpoint.
 * Accepts:
 * - https://platform.example.com
 * - https://platform.example.com/api
 */
function buildIngestUrl(baseUrl) {
  const raw = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!raw) {
    throw new Error("Missing HONEYPOT_BASE_URL");
  }
  return raw.toLowerCase().endsWith("/api") ? `${raw}/ingest` : `${raw}/api/ingest`;
}

/**
 * Send one event to the platform ingest API.
 * Requires Node.js 18+ (native fetch).
 */
async function sendHoneypotEvent(event, options = {}) {
  const baseUrl = options.baseUrl || process.env.HONEYPOT_BASE_URL;
  const apiKey = options.apiKey || process.env.HONEYPOT_API_KEY;
  const timeoutMs = Number(options.timeoutMs || 6000);

  if (!apiKey) {
    throw new Error("Missing HONEYPOT_API_KEY");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildIngestUrl(baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(event || {}),
      signal: controller.signal,
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    return {
      ok: response.ok,
      statusCode: response.status,
      data,
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  sendHoneypotEvent,
  buildIngestUrl,
};

