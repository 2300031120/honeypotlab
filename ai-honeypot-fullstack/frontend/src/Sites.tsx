// @ts-nocheck
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "./apiConfig";
import { buildAuthHeaders, clearAuthSession } from "./utils/auth";

const INTEGRATION_STEPS = [
  {
    title: "1. Create a site",
    description: "Add your friend's website here and copy the API key once. Each website gets its own key.",
  },
  {
    title: "2. Send events from the server",
    description: "Their backend, worker, or webhook posts suspicious activity to /ingest using X-API-Key.",
  },
  {
    title: "3. Investigate in the platform",
    description: "Events appear in telemetry, forensics, deception, and readiness views for that site.",
  },
];

const RECOMMENDED_SIGNALS = [
  "Failed logins, password reset abuse, and impossible login patterns",
  "Admin path probes like /admin, /phpmyadmin, /wp-login, or hidden trap routes",
  "Suspicious contact form posts, hidden field hits, and scripted submissions",
  "Decoy download clicks, canary token hits, or fake credential usage",
];

const CODE_SNIPPETS = {
  node: `const payload = {
  event_type: "auth_fail",
  url_path: "/login",
  http_method: "POST",
  session_id: "sess_123",
  captured_data: {
    username: "suspicious-user",
    ip: req.ip,
    reason: "five_failed_attempts"
  }
};

await fetch("${API_BASE}/ingest", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": process.env.HONEYPOT_API_KEY
  },
  body: JSON.stringify(payload)
});`,
  python: `import os
import requests

payload = {
    "event_type": "auth_fail",
    "url_path": "/login",
    "http_method": "POST",
    "session_id": "sess_123",
    "captured_data": {
        "username": "suspicious-user",
        "ip": "203.0.113.10",
        "reason": "five_failed_attempts"
    }
}

requests.post(
    "${API_BASE}/ingest",
    headers={
        "Content-Type": "application/json",
        "X-API-Key": os.environ["HONEYPOT_API_KEY"],
    },
    json=payload,
    timeout=10,
)`,
  php: `<?php
$payload = [
  "event_type" => "auth_fail",
  "url_path" => "/login",
  "http_method" => "POST",
  "session_id" => "sess_123",
  "captured_data" => [
    "username" => "suspicious-user",
    "ip" => $_SERVER["REMOTE_ADDR"] ?? null,
    "reason" => "five_failed_attempts"
  ]
];

$ch = curl_init("${API_BASE}/ingest");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    "Content-Type: application/json",
    "X-API-Key: " . getenv("HONEYPOT_API_KEY")
  ],
  CURLOPT_POSTFIELDS => json_encode($payload),
  CURLOPT_RETURNTRANSFER => true
]);

$response = curl_exec($ch);
curl_close($ch);`,
};

const Sites = () => {
  const navigate = useNavigate();
  const [sites, setSites] = useState([]);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [createdKey, setCreatedKey] = useState(null);
  const [error, setError] = useState(null);
  const [snippetLanguage, setSnippetLanguage] = useState("node");

  const loadSites = async () => {
    try {
      const res = await fetch(`${API_BASE}/sites`, { headers: buildAuthHeaders() });
      const data = await res.json();
      if (res.status === 401) {
        clearAuthSession();
        navigate("/auth/login");
        return;
      }
      if (!res.ok) throw new Error(data?.detail || "Failed to load sites");
      setSites(data);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    loadSites();
  }, []);

  const createSite = async (e) => {
    e.preventDefault();
    setError(null);
    setCreatedKey(null);
    try {
      const res = await fetch(`${API_BASE}/sites`, {
        method: "POST",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ name, domain }),
      });
      const data = await res.json();
      if (res.status === 401) {
        clearAuthSession();
      navigate("/auth/login");
        return;
      }
      if (!res.ok) throw new Error(data?.detail || "Failed to create site");
      setCreatedKey(data.api_key);
      setName("");
      setDomain("");
      await loadSites();
    } catch (e2) {
      setError(e2.message);
    }
  };

  const rotateKey = async (siteId) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/sites/${siteId}/rotate-key`, {
        method: "POST",
        headers: buildAuthHeaders(),
      });
      const data = await res.json();
      if (res.status === 401) {
        clearAuthSession();
      navigate("/auth/login");
        return;
      }
      if (!res.ok) throw new Error(data?.detail || "Failed to rotate key");
      setCreatedKey(data.api_key);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Websites</h1>
      <p style={{ opacity: 0.85, marginBottom: 20 }}>
        Add a website and get an API key to send suspicious activity into your deception-led detection platform.
      </p>

      {error && (
        <div style={{ background: "rgba(248,81,73,0.15)", border: "1px solid rgba(248,81,73,0.35)", padding: 12, borderRadius: 10, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={createSite} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, marginBottom: 18 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Site name (e.g., My Shop)"
          style={{ padding: 12, borderRadius: 10, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3" }}
          required
        />
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="Domain (e.g., example.com)"
          style={{ padding: 12, borderRadius: 10, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3" }}
          required
        />
        <button
          type="submit"
          style={{ padding: "12px 16px", borderRadius: 10, border: 0, background: "linear-gradient(135deg,#1f6feb,#58a6ff)", color: "#fff", cursor: "pointer" }}
        >
          Add
        </button>
      </form>

      {createdKey && (
        <div style={{ background: "rgba(46,160,67,0.12)", border: "1px solid rgba(46,160,67,0.35)", padding: 14, borderRadius: 10, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Your API key (copy now)</div>
          <code style={{ display: "block", padding: 10, borderRadius: 8, background: "#0d1117", border: "1px solid #30363d", overflowX: "auto" }}>
            {createdKey}
          </code>
          <div style={{ opacity: 0.85, marginTop: 8, fontSize: 13 }}>
            Keep this secret. Use it from your server (or a secure backend), not inside public frontend code.
          </div>
        </div>
      )}

      <section style={{ border: "1px solid #30363d", borderRadius: 14, padding: 18, background: "rgba(13,17,23,0.65)", marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>How this works on your friend's website</div>
        <p style={{ opacity: 0.82, marginBottom: 16 }}>
          This platform only sees attacks from another website after that website sends events here. It does not auto-read unrelated sites without integration.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
          {INTEGRATION_STEPS.map((step) => (
            <div
              key={step.title}
              style={{ border: "1px solid #30363d", borderRadius: 12, padding: 14, background: "rgba(2,6,23,0.55)" }}
            >
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{step.title}</div>
              <div style={{ opacity: 0.84, fontSize: 14, lineHeight: 1.5 }}>{step.description}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 14, fontWeight: 700 }}>Recommended signals to send</div>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, opacity: 0.88 }}>
          {RECOMMENDED_SIGNALS.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>

        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid rgba(31,111,235,0.35)", background: "rgba(31,111,235,0.08)" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Security rule</div>
          <div style={{ opacity: 0.84, fontSize: 14 }}>
            Keep the API key on the friend's server, worker, or secure backend. Do not put it in browser JavaScript or public HTML.
          </div>
        </div>
      </section>

      <section style={{ border: "1px solid #30363d", borderRadius: 14, padding: 18, background: "rgba(13,17,23,0.65)", marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Server-side integration example</div>
        <p style={{ opacity: 0.82, marginBottom: 16 }}>
          Use the generated site API key from a backend, API route, worker, or webhook. Choose the stack closest to your friend's website.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {Object.keys(CODE_SNIPPETS).map((language) => {
            const active = snippetLanguage === language;
            return (
              <button
                key={language}
                type="button"
                onClick={() => setSnippetLanguage(language)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: active ? "1px solid rgba(88,166,255,0.75)" : "1px solid #30363d",
                  background: active ? "rgba(31,111,235,0.18)" : "#0d1117",
                  color: "#e6edf3",
                  cursor: "pointer",
                  fontWeight: active ? 700 : 500,
                  textTransform: "capitalize",
                }}
              >
                {language}
              </button>
            );
          })}
        </div>

        <pre style={{ margin: 0, padding: 14, borderRadius: 12, background: "#0b0f14", border: "1px solid #30363d", overflowX: "auto" }}>
          {CODE_SNIPPETS[snippetLanguage]}
        </pre>

        <div style={{ marginTop: 12, opacity: 0.8, fontSize: 13, lineHeight: 1.5 }}>
          After integration, send a test event and verify it in Telemetry, Forensics, or Ops Readiness.
        </div>
      </section>

      <div style={{ display: "grid", gap: 12 }}>
        {sites.map((s) => (
          <div key={s.id} style={{ border: "1px solid #30363d", borderRadius: 14, padding: 14, background: "rgba(13,17,23,0.65)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800 }}>{s.name}</div>
                <div style={{ opacity: 0.8 }}>{s.domain}</div>
              </div>
              <button
                onClick={() => rotateKey(s.id)}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3", cursor: "pointer" }}
              >
                Rotate API Key
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
              Send events:
              <pre style={{ marginTop: 8, padding: 12, borderRadius: 12, background: "#0b0f14", border: "1px solid #30363d", overflowX: "auto" }}>
{`curl -X POST "${API_BASE}/ingest" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"event_type":"http","url_path":"/login","http_method":"POST","captured_data":{"username":"test"}}'`}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sites;
