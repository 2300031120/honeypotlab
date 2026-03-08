import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, MessageSquare, RefreshCw, Rocket, Send } from "lucide-react";
import { API_BASE } from "./apiConfig";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { trackCtaClick, trackEvent } from "./utils/analytics";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

const MODE_CONFIG = {
  contact: {
    badge: "Contact Team",
    title: "Contact CyberSentinel AI",
    subtitle: "Share your use case and we will help you plan a deception strategy for your environment.",
    submitLabel: "Send Message",
    icon: MessageSquare,
  },
  demo: {
    badge: "Live Demo",
    title: "Request Deception Platform Demo",
    subtitle: "Book a walkthrough of dynamic decoys, AI analyst summaries, and live attacker telemetry.",
    submitLabel: "Request Demo",
    icon: Rocket,
  },
};

const INITIAL_FORM = {
  name: "",
  email: "",
  organization: "",
  use_case: "",
  message: "",
  website: "",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactDemo({ mode = "contact" }) {
  const resolvedMode = mode === "demo" ? "demo" : "contact";
  const copy = useMemo(() => MODE_CONFIG[resolvedMode], [resolvedMode]);
  const Icon = copy.icon;
  const isDemo = resolvedMode === "demo";
  usePageAnalytics(isDemo ? "demo_request" : "contact_request");

  useSeo({
    title: isDemo
      ? "Request Demo | CyberSentinel AI Dynamic Deception Platform"
      : "Contact Team | CyberSentinel AI Dynamic Deception Platform",
    description: isDemo
      ? "Request a walkthrough of the AI-enhanced dynamic deception platform with adaptive high-interaction decoys and live analytics."
      : "Contact CyberSentinel AI to discuss adaptive deception for modern cyber defense and your deployment goals.",
    ogTitle: isDemo ? "Request CyberSentinel AI Demo" : "Contact CyberSentinel AI Team",
    ogDescription: isDemo
      ? "Book a dynamic deception platform demo with attacker telemetry and AI analyst summaries."
      : "Talk to the CyberSentinel AI team about adaptive deception strategy and implementation.",
  });

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const [serverMessage, setServerMessage] = useState("");
  const [challenge, setChallenge] = useState({ enabled: false });
  const [challengeAnswer, setChallengeAnswer] = useState("");
  const formStartedAtRef = useRef(Date.now());
  const formStartedTrackedRef = useRef(false);

  const loadChallenge = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/lead/challenge`);
      const data = response.data || {};
      setChallenge(data);
      setChallengeAnswer("");
      formStartedAtRef.current = Date.now();
    } catch {
      setChallenge({ enabled: false });
      setChallengeAnswer("");
      formStartedAtRef.current = Date.now();
    }
  }, []);

  useEffect(() => {
    loadChallenge();
  }, [loadChallenge, resolvedMode]);

  const validate = () => {
    const nextErrors = {};
    const name = String(formData.name || "").trim();
    const email = String(formData.email || "").trim();
    const organization = String(formData.organization || "").trim();
    const useCase = String(formData.use_case || "").trim();
    const message = String(formData.message || "").trim();

    if (name.length < 2) nextErrors.name = "Name is required.";
    if (!EMAIL_REGEX.test(email)) nextErrors.email = "Valid email is required.";
    if (organization.length < 2) nextErrors.organization = "Organization is required.";
    if (useCase.length < 4) nextErrors.use_case = "Use case is required.";
    if (message.length < 12) nextErrors.message = "Message should be at least 12 characters.";
    if (challenge?.enabled && String(challengeAnswer || "").trim().length < 1) {
      nextErrors.challenge = "Challenge answer is required.";
    }

    return nextErrors;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (!formStartedTrackedRef.current && String(value || "").trim().length > 0) {
      formStartedTrackedRef.current = true;
      trackEvent("lead_form_start", {
        category: "conversion",
        pagePath: resolvedMode === "demo" ? "/demo" : "/contact",
        requestType: resolvedMode,
        properties: { field: name, mode: resolvedMode },
      });
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    trackEvent("lead_form_submit_attempt", {
      category: "conversion",
      pagePath: resolvedMode === "demo" ? "/demo" : "/contact",
      requestType: resolvedMode,
      properties: { mode: resolvedMode },
    });

    setStatus("submitting");
    setServerMessage("");

    try {
      const payload = {
        name: String(formData.name || "").trim(),
        email: String(formData.email || "").trim(),
        organization: String(formData.organization || "").trim(),
        use_case: String(formData.use_case || "").trim(),
        message: String(formData.message || "").trim(),
        website: String(formData.website || ""),
        challenge_id: challenge?.challenge_id || undefined,
        challenge_answer: String(challengeAnswer || "").trim(),
        submitted_at_ms: formStartedAtRef.current,
      };
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search || "");
        payload.source = window.location.pathname || `/${resolvedMode}`;
        payload.campaign = params.get("campaign") || undefined;
        payload.utm_source = params.get("utm_source") || undefined;
        payload.utm_medium = params.get("utm_medium") || undefined;
        payload.utm_campaign = params.get("utm_campaign") || undefined;
      }
      const response = await axios.post(`${API_BASE}/${resolvedMode}/submit`, payload);
      const responseData = response?.data || {};
      setStatus("success");
      setServerMessage(responseData?.message || "Request submitted successfully.");
      trackEvent("lead_form_submit_success", {
        category: "conversion",
        pagePath: resolvedMode === "demo" ? "/demo" : "/contact",
        requestType: resolvedMode,
        leadId: responseData?.id,
        properties: {
          status: responseData?.status,
          duplicate: Boolean(responseData?.duplicate),
          is_repeat: Boolean(responseData?.is_repeat),
          lead_status: responseData?.lead_status,
          spam_blocked: Boolean(responseData?.spam_blocked),
        },
      });
      if (responseData?.status === "duplicate_suppressed" || responseData?.duplicate) {
        trackEvent("lead_duplicate_suppressed", {
          category: "conversion",
          pagePath: resolvedMode === "demo" ? "/demo" : "/contact",
          requestType: resolvedMode,
          leadId: responseData?.id,
          properties: { status: responseData?.status, lead_status: responseData?.lead_status },
        });
      }
      if (responseData?.spam_blocked || String(responseData?.lead_status || "").toLowerCase() === "spam") {
        trackEvent("lead_spam_blocked", {
          category: "conversion",
          pagePath: resolvedMode === "demo" ? "/demo" : "/contact",
          requestType: resolvedMode,
          leadId: responseData?.id,
          properties: { lead_status: responseData?.lead_status },
        });
      }
      setFormData(INITIAL_FORM);
      setChallengeAnswer("");
      loadChallenge();
      setErrors({});
      formStartedTrackedRef.current = false;
    } catch (error) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        "Unable to submit right now. Please try again in a moment.";
      setStatus("error");
      setServerMessage(String(detail));
      trackEvent("lead_form_submit_error", {
        category: "conversion",
        pagePath: resolvedMode === "demo" ? "/demo" : "/contact",
        requestType: resolvedMode,
        properties: { detail: String(detail).slice(0, 220) },
      });
      if (String(detail).toLowerCase().includes("challenge")) {
        loadChallenge();
      }
    }
  };

  return (
    <div className="lead-page">
      <PublicHeader variant="cred" pagePath={isDemo ? "/demo" : "/contact"} />
      <div className="lead-page-shell">
        <header className="lead-page-top">
          <Link to="/" className="lead-back-link">
            <ArrowLeft size={14} /> Back to Home
          </Link>
          <div className="lead-badge">
            <Icon size={14} />
            {copy.badge}
          </div>
        </header>

        <section className="lead-card">
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>

          {status === "success" ? (
            <div className="lead-success-box" role="status">
              <div>
                <CheckCircle2 size={18} />
                <strong>Request received</strong>
              </div>
              <p>{serverMessage}</p>
              <div className="lead-success-actions">
                <Link to="/" className="lead-btn lead-btn-secondary">Home</Link>
              <Link to="/auth/login" className="lead-btn lead-btn-primary">View Dashboard</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="lead-form" noValidate>
              <input
                type="text"
                name="website"
                value={formData.website}
                onChange={handleChange}
                autoComplete="off"
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: "absolute", left: "-10000px", top: "auto", width: "1px", height: "1px", opacity: 0 }}
              />
              <Field
                label="Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                error={errors.name}
                placeholder="Your full name"
              />
              <Field
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                placeholder="name@company.com"
              />
              <Field
                label="Organization"
                name="organization"
                value={formData.organization}
                onChange={handleChange}
                error={errors.organization}
                placeholder="Company or team"
              />
              <Field
                label="Use case"
                name="use_case"
                value={formData.use_case}
                onChange={handleChange}
                error={errors.use_case}
                placeholder="SOC monitoring, red-team validation, cloud deception..."
              />
              <Field
                label="Message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                error={errors.message}
                placeholder="Tell us what you want to evaluate"
                multiline
              />

              {challenge?.enabled ? (
                <div className="lead-field">
                  <span>Challenge</span>
                  <div className="lead-challenge-box">
                    {challenge?.prompt || "Solve challenge"}
                  </div>
                  <div className="lead-challenge-row">
                    <input
                      name="challenge_answer"
                      value={challengeAnswer}
                      onChange={(event) => {
                        setChallengeAnswer(event.target.value);
                        setErrors((prev) => ({ ...prev, challenge: "" }));
                      }}
                      placeholder="Enter answer"
                      aria-invalid={Boolean(errors.challenge)}
                    />
                    <button
                      type="button"
                      onClick={loadChallenge}
                      className="lead-btn lead-btn-secondary lead-btn-inline"
                    >
                      <RefreshCw size={14} /> New
                    </button>
                  </div>
                  {errors.challenge ? <small>{errors.challenge}</small> : null}
                </div>
              ) : null}

              {status === "error" && (
                <div className="lead-error-box" role="alert">
                  <AlertCircle size={16} />
                  <span>{serverMessage}</span>
                </div>
              )}

              <div className="lead-actions">
                <button type="submit" className="lead-btn lead-btn-primary" disabled={status === "submitting"}>
                  <Send size={14} />
                  {status === "submitting" ? "Submitting..." : copy.submitLabel}
                </button>
                <Link
                  to={resolvedMode === "demo" ? "/contact" : "/demo"}
                  className="lead-btn lead-btn-secondary"
                  onClick={() => trackCtaClick(resolvedMode === "demo" ? "switch_to_contact" : "switch_to_demo", resolvedMode === "demo" ? "/demo" : "/contact")}
                >
                  {resolvedMode === "demo" ? "Contact Team" : "Request Demo"}
                </Link>
              </div>
            </form>
          )}
        </section>
        <PublicFooter />
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  error,
  placeholder,
  multiline = false,
}) {
  return (
    <label className="lead-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={5}
          aria-invalid={Boolean(error)}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
        />
      )}
      {error ? <small>{error}</small> : null}
    </label>
  );
}
