import React, { useEffect, useState } from "react";
import axios from "axios";
import "./styles.css";
import { API_BASE } from "./apiConfig";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus, User, Lock, ArrowLeft, Shield, Mail, Chrome } from "lucide-react";
import { PUBLIC_SITE } from "./siteConfig";
import { setAuthSession } from "./utils/auth";
import { DEFAULT_AUTH_PROVIDERS, loadAuthProviders } from "./utils/authProviders";
import { requestGoogleCredential } from "./utils/googleAuth";

const DEFAULT_FORM = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const Signup = () => {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authProviders, setAuthProviders] = useState({
    checked: false,
    ...DEFAULT_AUTH_PROVIDERS,
  });
  const navigate = useNavigate();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const effectiveGoogleClientId = googleClientId || authProviders.serverGoogleClientId;
  const signupEnabled = authProviders.signupEnabled !== false;
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;
  const googleSignupEnabled =
    signupEnabled &&
    Boolean(effectiveGoogleClientId) &&
    (authProviders.checked ? authProviders.googleEnabled !== false : true);

  useEffect(() => {
    let cancelled = false;

    const fetchProviders = async () => {
      try {
        const nextProviders = await loadAuthProviders();
        if (!cancelled) {
          setAuthProviders({
            checked: true,
            ...nextProviders,
          });
        }
      } catch {
        if (!cancelled) {
          setAuthProviders((prev) => ({ ...prev, checked: true }));
        }
      }
    };

    fetchProviders();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    if (!signupEnabled) {
      setError("Self-service signup is disabled for this deployment.");
      return;
    }

    const username = form.username.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password;
    const confirmPassword = form.confirmPassword;

    if (!username || !email || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password and confirm password must match.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/signup`, {
        username,
        email,
        password,
        plan: "free",
        tenant_name: `${username} Workspace`,
      });
      setMsg("Registration successful. Redirecting to login...");
      setTimeout(() => navigate("/auth/login"), 900);
    } catch (signupError) {
      setError(signupError?.response?.data?.detail || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setMsg("");
    setError("");
    if (!signupEnabled) {
      setError("Self-service signup is disabled for this deployment.");
      return;
    }
    if (!effectiveGoogleClientId) {
      setError("Google signup is not configured. Set GOOGLE_OAUTH_CLIENT_ID or VITE_GOOGLE_CLIENT_ID.");
      return;
    }

    setGoogleLoading(true);
    try {
      const credential = await requestGoogleCredential(effectiveGoogleClientId);
      const response = await axios.post(`${API_BASE}/auth/google`, {
        credential,
        plan: "free",
      });
      setAuthSession(response.data.token, {
        username: response.data.username || response.data.email || "google_user",
        role: response.data.role || "admin",
        provider: "google",
      });
      setMsg(response.data.new_user ? "Google signup successful. Redirecting..." : "Google account connected. Redirecting...");
      setTimeout(() => navigate("/dashboard"), 600);
    } catch (googleError) {
      setError(googleError?.response?.data?.detail || googleError?.message || "Google signup failed.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="cyber-grid"></div>
      <div className="particle p3"></div>
      <div className="particle p5"></div>

      <div className="login-wrapper">
        <div style={{ marginBottom: "20px" }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", color: "#8b949e", textDecoration: "none", fontSize: "13px", gap: "6px" }}>
            <ArrowLeft size={14} /> Back to Gateway
          </Link>
        </div>

        <div className="login-card fade-in">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
            <div
              style={{
                width: "70px",
                height: "70px",
                borderRadius: "50%",
                background: "rgba(165,214,255,0.1)",
                border: "2px solid rgba(165,214,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UserPlus size={32} color="#a5d6ff" />
            </div>
          </div>

          <h2 style={{ textAlign: "center", fontSize: "1.5rem", fontWeight: "700", marginBottom: "8px" }}>AGENT ENROLLMENT</h2>
          <p style={{ textAlign: "center", color: "#8b949e", fontSize: "13px", marginBottom: "26px" }}>
            {signupEnabled ? "Register real credentials for SOC access" : "Self-service enrollment is disabled for this deployment"}
          </p>

          {msg && (
            <div
              style={{
                background: "rgba(63,185,80,0.1)",
                border: "1px solid #3fb95040",
                color: "#3fb950",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "18px",
                fontSize: "13px",
                textAlign: "center",
              }}
            >
              {msg}
            </div>
          )}

          {error && (
            <div
              style={{
                background: "rgba(248,81,73,0.1)",
                border: "1px solid #f8514940",
                color: "#f85149",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "18px",
                fontSize: "13px",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          {signupEnabled ? (
            <>
              <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={googleLoading || loading || !googleSignupEnabled}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(88,166,255,0.35)",
                  background: "rgba(88,166,255,0.1)",
                  color: "#58a6ff",
                  cursor: googleLoading || loading || !googleSignupEnabled ? "not-allowed" : "pointer",
                  fontWeight: "700",
                  marginBottom: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <Chrome size={16} />
                {googleLoading ? "CONNECTING GOOGLE..." : googleSignupEnabled ? "Continue with Google" : "Google Signup Off"}
              </button>

              <form onSubmit={handleSignup}>
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", color: "#8b949e", marginBottom: "8px", fontSize: "11px", textTransform: "uppercase" }}>Username</label>
                  <div style={{ position: "relative" }}>
                    <User size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#484f58" }} />
                    <input
                      type="text"
                      placeholder="agent_name"
                      value={form.username}
                      required
                      onChange={(e) => handleFieldChange("username", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "14px 14px 14px 42px",
                        background: "#010409",
                        border: "1px solid #30363d",
                        color: "#e6edf3",
                        borderRadius: "8px",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", color: "#8b949e", marginBottom: "8px", fontSize: "11px", textTransform: "uppercase" }}>Email</label>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#484f58" }} />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={form.email}
                      required
                      onChange={(e) => handleFieldChange("email", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "14px 14px 14px 42px",
                        background: "#010409",
                        border: "1px solid #30363d",
                        color: "#e6edf3",
                        borderRadius: "8px",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", color: "#8b949e", marginBottom: "8px", fontSize: "11px", textTransform: "uppercase" }}>Password</label>
                  <div style={{ position: "relative" }}>
                    <Lock size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#484f58" }} />
                    <input
                      type="password"
                      placeholder="Minimum 8 characters"
                      value={form.password}
                      required
                      onChange={(e) => handleFieldChange("password", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "14px 14px 14px 42px",
                        background: "#010409",
                        border: "1px solid #30363d",
                        color: "#e6edf3",
                        borderRadius: "8px",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", color: "#8b949e", marginBottom: "8px", fontSize: "11px", textTransform: "uppercase" }}>Confirm Password</label>
                  <div style={{ position: "relative" }}>
                    <Lock size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#484f58" }} />
                    <input
                      type="password"
                      placeholder="Repeat password"
                      value={form.confirmPassword}
                      required
                      onChange={(e) => handleFieldChange("confirmPassword", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "14px 14px 14px 42px",
                        background: "#010409",
                        border: "1px solid #30363d",
                        color: "#e6edf3",
                        borderRadius: "8px",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  style={{
                    width: "100%",
                    padding: "14px",
                    border: "none",
                    borderRadius: "8px",
                    background: loading ? "#21262d" : "#238636",
                    color: "white",
                    fontWeight: "700",
                    cursor: loading || googleLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "PROCESSING..." : "REGISTER FOR ACCESS"}
                </button>
              </form>
            </>
          ) : (
            <div
              style={{
                background: "rgba(88,166,255,0.08)",
                border: "1px solid rgba(88,166,255,0.25)",
                color: "#a5d6ff",
                padding: "14px",
                borderRadius: "10px",
                marginBottom: "18px",
                fontSize: "13px",
                lineHeight: 1.6,
                textAlign: "center",
              }}
            >
              Self-service signup is disabled. Use an existing account, or request guided onboarding from the {productName} team.
            </div>
          )}

          <div style={{ marginTop: "20px", textAlign: "center", fontSize: "13px" }}>
            <Link to="/auth/login" style={{ color: "#58a6ff", textDecoration: "none" }}>
              Back to Secure Login
            </Link>
            {!signupEnabled && (
              <div style={{ marginTop: "12px" }}>
                <Link to="/demo" style={{ color: "#3fb950", textDecoration: "none" }}>
                  Request Guided Access
                </Link>
              </div>
            )}
          </div>

          <div className="scanline"></div>
        </div>

        <div className="footer" style={{ textAlign: "center", marginTop: "30px", color: "#484f58", fontSize: "11px" }}>
          <Shield size={12} style={{ verticalAlign: "middle", marginRight: "4px" }} />
          Secure Enrollment Protocol V2.4
        </div>
      </div>
    </div>
  );
};

export default Signup;
