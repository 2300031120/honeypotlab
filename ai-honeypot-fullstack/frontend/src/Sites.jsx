import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "./apiConfig";
import { buildAuthHeaders, clearAuthSession } from "./utils/auth";

const Sites = () => {
  const navigate = useNavigate();
  const [sites, setSites] = useState([]);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [createdKey, setCreatedKey] = useState(null);
  const [error, setError] = useState(null);

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
        Add a website and get an API key to send events into your AI Deception platform.
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
