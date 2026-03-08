/**
 * Cloudflare Worker relay:
 * - runs in front of your protected app routes
 * - forwards suspicious request telemetry to /api/ingest
 *
 * Required Worker env vars:
 * - HONEYPOT_BASE_URL  (example: https://solutions-abc.trycloudflare.com)
 * - HONEYPOT_API_KEY   (site API key from /sites create/rotate-key)
 *
 * Optional:
 * - RELAY_SAMPLE_RATE  (0.0 - 1.0, default 1.0)
 */

function normalizeBase(baseUrl) {
  const raw = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!raw) throw new Error("Missing HONEYPOT_BASE_URL");
  return raw.toLowerCase().endsWith("/api") ? raw.slice(0, -4) : raw;
}

function isSuspicious(pathname, cfMeta) {
  const p = String(pathname || "").toLowerCase();
  const suspiciousPath =
    p.includes("wp-login.php") ||
    p.includes("xmlrpc.php") ||
    p.includes("server-status") ||
    p.includes(".env") ||
    p.includes(".git") ||
    p.includes("phpmyadmin");

  const threatScore = Number(cfMeta?.threatScore || 0);
  const botScore = Number(cfMeta?.botManagement?.score || 99);
  return suspiciousPath || threatScore > 0 || botScore < 30;
}

function shouldSample(sampleRate) {
  const rate = Number(sampleRate);
  if (!Number.isFinite(rate)) return true;
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  return Math.random() < rate;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cf = request.cf || {};
    const incomingRelayHeader = request.headers.get("x-honeypot-relay");

    if (!incomingRelayHeader && shouldSample(env.RELAY_SAMPLE_RATE || "1.0") && isSuspicious(url.pathname, cf)) {
      try {
        const base = normalizeBase(env.HONEYPOT_BASE_URL);
        const ingestUrl = `${base}/api/ingest`;
        const apiKey = String(env.HONEYPOT_API_KEY || "").trim();

        if (apiKey) {
          const eventBody = {
            event_type: "cloudflare_edge",
            url_path: url.pathname,
            http_method: request.method,
            captured_data: {
              source: "cloudflare_worker",
              host: url.host,
              query: url.search || "",
              country: cf.country || null,
              city: cf.city || null,
              region: cf.region || null,
              asn: cf.asn || null,
              colo: cf.colo || null,
              tls_version: cf.tlsVersion || null,
              threat_score: cf.threatScore ?? null,
              bot_score: cf.botManagement?.score ?? null,
              client_ip: request.headers.get("cf-connecting-ip"),
              user_agent: request.headers.get("user-agent"),
              ray_id: request.headers.get("cf-ray"),
            },
            session_id: `cf-${request.headers.get("cf-ray") || Date.now()}`,
          };

          ctx.waitUntil(
            fetch(ingestUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey,
                "X-Honeypot-Relay": "cloudflare-worker",
              },
              body: JSON.stringify(eventBody),
            }).catch(() => null),
          );
        }
      } catch (_) {
        // Do not break live traffic if telemetry relay fails.
      }
    }

    return fetch(request);
  },
};

