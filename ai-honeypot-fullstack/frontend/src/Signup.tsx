import React, { useEffect, useState } from "react";
import axios from "axios";
import "./styles.css";
import { API_BASE } from "./apiConfig";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle, Chrome, Lock, Mail, Shield, User, UserPlus } from "lucide-react";
import { PUBLIC_SITE } from "./siteConfig";
import { setAuthSession } from "./utils/auth";
import { DEFAULT_AUTH_PROVIDERS, loadAuthProviders } from "./utils/authProviders";
import { requestGoogleCredential } from "./utils/googleAuth";
import PublicAuthShell from "./components/PublicAuthShell";

type SignupFormState = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const DEFAULT_FORM: SignupFormState = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const Signup = () => {
  const [form, setForm] = useState<SignupFormState>(DEFAULT_FORM);
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
  const signupEnabled = authProviders.checked ? authProviders.signupEnabled !== false : true;
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

  const handleFieldChange = (field: keyof SignupFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
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
      try {
        const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
          username,
          password,
        });
        const token = String(loginResponse?.data?.token || "").trim();
        if (token) {
          setAuthSession(token, {
            username: loginResponse?.data?.username || username,
            role: loginResponse?.data?.role || "owner",
          });
          setMsg("Workspace owner account created. Redirecting to dashboard...");
          setTimeout(() => navigate("/dashboard"), 600);
          return;
        }
      } catch {
        // Fallback to login page if immediate login fails for any reason.
      }

      setMsg("Workspace owner account created. Redirecting to secure login...");
      setTimeout(() => navigate("/auth/login"), 900);
    } catch (signupError: unknown) {
      const err = signupError as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail || "Signup failed. Please try again.");
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
        role: response.data.role || "owner",
        provider: "google",
      });
      setMsg(response.data.new_user ? "Google owner signup successful. Redirecting..." : "Google owner account connected. Redirecting...");
      setTimeout(() => navigate("/dashboard"), 600);
    } catch (googleError: unknown) {
      const err = googleError as { response?: { data?: { detail?: string } }; message?: string };
      setError(err?.response?.data?.detail || err?.message || "Google signup failed.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const enrollmentSignals = [
    signupEnabled ? "Workspace creation open" : "Guided onboarding only",
    googleSignupEnabled ? "Google workspace signup available" : "Password workspace setup",
    "First account becomes owner",
  ];

  const storyCards = [
    {
      label: "Fast start",
      title: "Create the first workspace owner account",
      detail: "Self-serve signup creates the initial owner so you can land in the dashboard and start configuring the workspace.",
      icon: <UserPlus size={16} />,
    },
    {
      label: "Guided option",
      title: "Use the demo path if you want rollout help first",
      detail: "Pricing, deployment, and guided walkthroughs still have a separate path if you want a review before creating credentials.",
      icon: <CheckCircle size={16} />,
    },
    {
      label: "Secure access",
      title: "Keep workspace creation separate from proof review",
      detail: "Public proof stays on the marketing path while owner creation and operator access stay on the secure path.",
      icon: <Shield size={16} />,
    },
  ];

  const enrollmentPostureItems = [
    "Owner signup creates the first workspace account and signs you in when the deployment allows it.",
    "Google signup, when enabled, still lands as the owner account for the workspace.",
    "Use the guided demo path if you still want help with rollout, pricing, or deployment planning.",
  ];

  const readinessLinks = [
    {
      title: "Review the sample incident",
      detail: "Understand the product proof path before creating an owner account.",
      to: "/case-study",
      action: "View incident",
    },
    {
      title: "Check rollout scope",
      detail: "Use pricing and pilot scope to decide whether you need guided onboarding first.",
      to: "/pricing",
      action: "View pricing",
    },
    {
      title: "Read the security position",
      detail: "Confirm isolation, deployment boundaries, and data handling before rollout.",
      to: "/security",
      action: "View security",
    },
  ];

  return (
    <PublicAuthShell
      pagePath="/auth/signup"
      showLoginAction={false}
      authLabel={signupEnabled ? "Workspace creation" : "Guided onboarding"}
      story={{
        kicker: "Create workspace",
        signals: enrollmentSignals,
        title: `Create the first ${productName} workspace owner account.`,
        description: `Use this page to create the initial owner credentials for ${productName}. If you want a guided walkthrough before rollout, keep the demo path separate and review the public proof first.`,
        actions: [
          { label: "View Sample Incident", to: "/case-study", variant: "primary" },
          { label: "Request Guided Demo", to: "/demo", variant: "secondary" },
        ],
        cards: storyCards,
      }}
      sidebar={{
        primary: {
          kicker: "Enrollment posture",
          title: "Create the owner account when you are ready to open a live workspace.",
          items: enrollmentPostureItems,
          metrics: [
            { label: "Self-service", value: signupEnabled ? "OPEN" : "GUIDED" },
            { label: "Google owner setup", value: googleSignupEnabled ? "AVAILABLE" : "OFF" },
          ],
        },
        secondary: {
          kicker: "Before you enroll",
          links: readinessLinks,
          backLinkLabel: "Back to Website",
          backLinkTo: "/",
        },
      }}
      authCard={
        <article className="public-auth-card fade-in">
          <div className="public-auth-icon-wrap">
            <div className="public-auth-icon-ring">
              <UserPlus size={32} color="#d86b1d" />
            </div>
          </div>

          <h2 className="public-auth-card-title">
            {signupEnabled ? "CREATE YOUR WORKSPACE" : "GUIDED OWNER ONBOARDING"}
          </h2>
          <p className="public-auth-card-subtitle">
            {signupEnabled
              ? `Create the first owner credentials for your ${productName} workspace and continue into the dashboard.`
              : "Self-service enrollment is disabled for this deployment. Use guided onboarding or existing operator credentials."}
          </p>

          {msg ? <div className="public-auth-message public-auth-message-success">{msg}</div> : null}
          {error ? <div className="public-auth-message public-auth-message-error">{error}</div> : null}

          <div className="public-auth-note">
            <strong>Workspace note</strong>
            <p>
              Owner signup creates the first workspace account and sets the initial owner credentials. If you still want
              product context or rollout guidance first, review the proof pages or use the demo flow.
            </p>
          </div>

          {signupEnabled ? (
            <>
              <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={googleLoading || loading || !googleSignupEnabled}
                className="public-auth-google-btn"
              >
                <Chrome size={16} />
                {googleLoading ? "CONNECTING GOOGLE..." : googleSignupEnabled ? "Continue with Google" : "Google Signup Off"}
              </button>

              <div className="public-auth-separator">
                <span>or create with workspace credentials</span>
              </div>

              <form onSubmit={handleSignup} className="public-auth-form">
                <label className="public-auth-field">
                  <span>Username</span>
                  <div className="public-auth-input-wrap">
                    <User size={16} />
                    <input
                      type="text"
                      placeholder="workspace_owner"
                      value={form.username}
                      required
                      onChange={(e) => handleFieldChange("username", e.target.value)}
                    />
                  </div>
                </label>

                <label className="public-auth-field">
                  <span>Email</span>
                  <div className="public-auth-input-wrap">
                    <Mail size={16} />
                    <input
                      type="email"
                      placeholder="owner@company.com"
                      value={form.email}
                      required
                      onChange={(e) => handleFieldChange("email", e.target.value)}
                    />
                  </div>
                </label>

                <label className="public-auth-field">
                  <span>Password</span>
                  <div className="public-auth-input-wrap">
                    <Lock size={16} />
                    <input
                      type="password"
                      placeholder="Minimum 8 characters"
                      value={form.password}
                      required
                      onChange={(e) => handleFieldChange("password", e.target.value)}
                    />
                  </div>
                </label>

                <label className="public-auth-field">
                  <span>Confirm password</span>
                  <div className="public-auth-input-wrap">
                    <Lock size={16} />
                    <input
                      type="password"
                      placeholder="Repeat password"
                      value={form.confirmPassword}
                      required
                      onChange={(e) => handleFieldChange("confirmPassword", e.target.value)}
                    />
                  </div>
                </label>

                <div className="public-auth-hint-row">
                  <span>Minimum 8 characters</span>
                  <span>First account becomes workspace owner</span>
                </div>

                <button type="submit" disabled={loading || googleLoading} className="public-auth-primary-btn">
                  {loading ? "PROCESSING..." : "CREATE WORKSPACE"}
                </button>
              </form>
            </>
          ) : (
            <div className="public-auth-disabled-box">
              <p>
                Self-service signup is disabled. Use an existing operator account or request guided onboarding from the{" "}
                {productName} team.
              </p>
              <div className="public-auth-disabled-actions">
                <Link to="/demo" className="public-auth-story-btn public-auth-story-btn-primary">
                  Request Guided Access
                </Link>
                <Link to="/auth/login" className="public-auth-story-btn public-auth-story-btn-secondary">
                  Back to Login
                </Link>
              </div>
            </div>
          )}

          <div className="public-auth-link-row">
            <Link to="/auth/login">Back to Secure Login</Link>
            <Link to="/demo">
              Request Guided Demo <ArrowRight size={14} />
            </Link>
          </div>

          <div className="public-auth-scanline"></div>
        </article>
      }
      authFooterNote={
        <>
          <Shield size={12} />
          <span>Workspace creation stays separate from public proof and guided demo review.</span>
        </>
      }
    />
  );
};

export default Signup;
