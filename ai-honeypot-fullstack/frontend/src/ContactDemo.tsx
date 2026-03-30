// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  MessageSquare,
  RefreshCw,
  Rocket,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { API_BASE } from "./apiConfig";
import { PUBLIC_SITE } from "./siteConfig";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { trackCtaClick, trackEvent } from "./utils/analytics";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

const MODE_CONFIG = {
  contact: {
    badge: "Contact Team",
    title: `Talk to the ${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} team about deception-led detection, rollout priorities, and operator fit.`,
    subtitle:
      "Share your environment, exposed services, and response goals. We will map where decoys, telemetry, and AI incident context create the clearest early-warning workflow.",
    submitLabel: "Send Message",
    icon: MessageSquare,
    signals: ["Deception workflow mapping", "Operator-ready rollout", "Direct team conversation"],
    inlinePoints: ["Deployment advice", "Exposure review", "Use-case fit", "Operator workflow"],
    storyKicker: "Why contact us",
    storyTitle: "Best when you need rollout guidance, exposure review, or a clearer early-detection workflow.",
    checklist: [
      "Map your exposed routes, portals, or services to the strongest deception workflow",
      "Decide whether the platform fits a pilot, internal rollout, or analyst-facing monitoring workflow",
      "Plan how evidence, replay, and AI summaries support your operators before production impact",
    ],
    panelKicker: "Best for",
    panelTitle: "What we can help with",
    panelItems: [
      "Evaluating fit for SOC, research, cloud, public-service, or training workflows",
      "Planning where believable decoys and honey paths should sit in your environment",
      "Discussing telemetry coverage, evidence needs, and the shape of a practical first rollout",
    ],
    panelMeta: [
      { label: "Conversation type", value: "Planning session" },
      { label: "Typical outcome", value: "Deployment path" },
    ],
    panelSummary:
      "Use this page when you need to decide where deception should sit, what evidence matters most, and how the rollout fits your environment.",
    ribbonTitle: "What happens after you reach out",
    ribbonItems: [
      { label: "Step 1", value: "We review team size, environment, and use case" },
      { label: "Step 2", value: "We map the right deception workflow and first deployment path" },
      { label: "Step 3", value: "We recommend next step: demo, pilot, or operational follow-up" },
    ],
    authorityKicker: "Why this page matters",
    authorityTitle: "Strong cybersecurity platforms build trust when the contact path still feels operational and deployment-focused.",
    authorityBody:
      "The strongest cybersecurity programs need more than a form. They need a clear path to deployment, evidence capture, and confidence that the workflow will help the team in real environments.",
    proofKicker: "What the conversation covers",
    proofTitle: "Turn product interest into a concrete deployment discussion",
    proofCards: [
      {
        title: "Use-case mapping",
        detail: "Define where deception creates the most value across SOC, cloud, public-service, campus, or research workflows.",
        icon: Users,
      },
      {
        title: "Deployment guidance",
        detail: "Discuss decoy placement, telemetry expectations, and how to structure a practical first rollout without touching production systems.",
        icon: ShieldCheck,
      },
      {
        title: "Mission alignment",
        detail: "Align the platform with stakeholder goals, operator workflows, and the services you need to protect first.",
        icon: LayoutDashboard,
      },
    ],
    quickStarts: [
      {
        label: "Public portal rollout",
        useCase: "Protect public-facing portals and admin routes",
        message: "Need help mapping believable decoys and first rollout steps around public-facing services.",
      },
      {
        label: "Campus readiness",
        useCase: "Run deception workflows for a campus or lab environment",
        message: "Need guidance on safer deception-led labs, drills, and evidence capture for campus teams.",
      },
      {
        label: "SOC planning",
        useCase: "Evaluate operator workflow for SOC monitoring",
        message: "Need to understand where telemetry, AI summaries, and replay fit our current analyst workflow.",
      },
    ],
    responseWindow: "Usually within 1 business day",
    switchPath: "/demo",
    switchLabel: "Request Demo",
    formTitle: "Start the conversation",
    formDescription: "Tell us what exposed systems, user groups, or workflows you want to protect and we will respond with the clearest next step.",
    successPrimary: { to: "/", label: "Home" },
    successSecondary: { to: "/platform", label: "Explore Platform" },
    ctaTitle: "Prefer to see the workflow live instead?",
    ctaBody: "Request a walkthrough if you want to see decoys, telemetry, replay, and AI incident context in motion.",
  },
  demo: {
    badge: "Live Demo",
    title: "Book a walkthrough focused on attacker detection, evidence capture, and analyst response.",
    subtitle:
      "See believable decoys, live telemetry, preserved attacker paths, and AI incident context in a demonstration built for serious security teams.",
    submitLabel: "Request Demo",
    icon: Rocket,
    signals: ["Live attacker telemetry", "Evidence and replay", "Analyst-ready workflow"],
    inlinePoints: ["High-interaction decoys", "Session evidence", "AI summaries", "Operator dashboards"],
    storyKicker: "Why teams request demos",
    storyTitle: "Best when you want proof that the workflow surfaces attackers early and stays readable under pressure.",
    checklist: [
      "Walk through believable decoys and the attacker interaction surfaces they target first",
      "See how telemetry, evidence, summaries, and replay connect into one workflow",
      "Validate how the platform supports analysts before real systems or users are touched",
    ],
    panelKicker: "What you'll see",
    panelTitle: "Demo flow",
    panelItems: [
      "Attacker interaction across decoy pages, APIs, and operator views",
      "Live telemetry snapshots with session activity, route trails, and event evidence",
      "AI incident summaries that support analyst review, briefings, and team readiness",
    ],
    panelMeta: [
      { label: "Demo format", value: "Live walkthrough" },
      { label: "Expected focus", value: "Workflow proof" },
    ],
    panelSummary:
      "Use the demo flow when you want to validate how suspicious first-touch activity becomes usable evidence for analysts and stakeholders.",
    ribbonTitle: "What happens after a demo request",
    ribbonItems: [
      { label: "Step 1", value: "We review the environment and priority use case" },
      { label: "Step 2", value: "We tailor the walkthrough to your workflow, service exposure, and readiness goals" },
      { label: "Step 3", value: "You get a live platform walkthrough grounded in operational proof" },
    ],
    authorityKicker: "Why this page matters",
    authorityTitle: "A strong demo page should prove the workflow before the form is even submitted.",
    authorityBody:
      "Winning cyber platforms combine immediate proof with a low-friction next step. This page should feel like part of the operational walkthrough itself, not a dead-end form.",
    proofKicker: "What the demo proves",
    proofTitle: "Show live proof instead of generic claims",
    proofCards: [
      {
        title: "Platform walkthrough",
        detail: "Move through the workflow from decoy touch to dashboard review without disconnected screens.",
        icon: LayoutDashboard,
      },
      {
        title: "Telemetry in motion",
        detail: "Review event flow, session activity, and proof that the platform is working with live data.",
        icon: Activity,
      },
      {
        title: "AI incident brief",
        detail: "See how raw attacker behavior becomes readable summaries that support faster understanding and team readiness.",
        icon: BrainCircuit,
      },
    ],
    quickStarts: [
      {
        label: "SOC proof",
        useCase: "Validate SOC workflow and analyst handoff",
        message: "Need a live walkthrough focused on detection, evidence capture, and analyst-ready triage.",
      },
      {
        label: "Cloud exposure",
        useCase: "Review decoys for cloud and exposed application edges",
        message: "Need the demo tailored to exposed application routes, API edges, and cloud monitoring needs.",
      },
      {
        label: "Leadership review",
        useCase: "Show the platform to decision-makers and reviewers",
        message: "Need a concise demo that proves product fit, deployment path, and operator value for stakeholders.",
      },
    ],
    responseWindow: "We normally shape the walkthrough after the first review",
    switchPath: "/contact",
    switchLabel: "Contact Team",
    formTitle: "Request your demo",
    formDescription: "Share your use case so the walkthrough can focus on the parts of the platform that matter most.",
    successPrimary: { to: "/", label: "Home" },
    successSecondary: { to: "/platform", label: "Explore Platform" },
    ctaTitle: "Need a planning conversation before the demo?",
    ctaBody: "Use the contact page if you want help choosing the right use case, rollout path, or exposure points first.",
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
const SUBMIT_TIMEOUT_MS = 20000;

function applyPrefillFromSearch(searchValue, currentValue) {
  const params = new URLSearchParams(searchValue || "");
  return {
    name: currentValue.name || params.get("name") || "",
    email: currentValue.email || params.get("email") || "",
    organization: currentValue.organization || params.get("organization") || "",
    use_case: currentValue.use_case || params.get("use_case") || params.get("focus") || "",
    message: currentValue.message || params.get("message") || "",
    website: currentValue.website || "",
  };
}

function resolveSubmitErrorMessage(error) {
  if (error?.code === "ECONNABORTED" || String(error?.message || "").toLowerCase().includes("timeout")) {
    return `Request timed out. Please retry, or email ${PUBLIC_SITE.contactEmail} if urgent.`;
  }
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    "Unable to submit right now. Please try again in a moment."
  );
}

export default function ContactDemo({ mode = "contact" }) {
  const resolvedMode = mode === "demo" ? "demo" : "contact";
  const copy = useMemo(() => MODE_CONFIG[resolvedMode], [resolvedMode]);
  const Icon = copy.icon;
  const isDemo = resolvedMode === "demo";
  const pagePath = isDemo ? "/demo" : "/contact";
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;
  const location = useLocation();

  usePageAnalytics(isDemo ? "demo_request" : "contact_request");
  useSeo({
    title: isDemo ? `Request Demo | ${PUBLIC_SITE.siteName}` : `Contact Team | ${PUBLIC_SITE.siteName}`,
    description: isDemo
      ? `Request a live walkthrough of ${PUBLIC_SITE.siteName} with decoys, telemetry, preserved evidence, and AI-assisted incident context.`
      : `Contact ${PUBLIC_SITE.siteName} to discuss deception rollout, exposure mapping, and product fit for your environment.`,
    ogTitle: isDemo ? `Request ${PUBLIC_SITE.siteName} Demo` : `Contact ${PUBLIC_SITE.siteName} Team`,
    ogDescription: isDemo
      ? `Book a ${PUBLIC_SITE.siteName} walkthrough with live product proof, preserved evidence, and operator-ready workflow context.`
      : `Talk to the ${PUBLIC_SITE.siteName} team about product fit, deployment plans, and deception-led detection strategy.`,
  });

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const [serverMessage, setServerMessage] = useState("");
  const [submissionMeta, setSubmissionMeta] = useState({
    duplicate: false,
    spamBlocked: false,
    reviewState: "",
    nextStep: "",
  });
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

  useEffect(() => {
    setFormData((prev) => applyPrefillFromSearch(location.search, prev));
  }, [location.search]);

  const successState = useMemo(() => {
    if (submissionMeta.spamBlocked || submissionMeta.reviewState === "manual_review") {
      return {
        title: "Queued for manual review",
        detail: "The request was captured, but it needs a manual review path before the normal follow-up flow.",
        notes: [
          "Use the contact path if your team needs a more explicit planning conversation.",
          "Keep the message concise and focused on rollout, operator workflow, or demo goals.",
        ],
      };
    }
    if (submissionMeta.duplicate || submissionMeta.reviewState === "duplicate") {
      return {
        title: "Existing request found",
        detail: "The team will continue from the current thread instead of opening a new one.",
        notes: [
          "Use Contact Team if you need to add fresh rollout context.",
          "Use Explore Platform if reviewers need more product detail before the reply.",
        ],
      };
    }
    return {
      title: "Request received",
      detail: copy.responseWindow,
      notes: [
        "The team will review your use case and shape the next step around rollout, pilot, or walkthrough.",
        "Use Explore Platform if you want more product proof while the request is being reviewed.",
      ],
    };
  }, [copy.responseWindow, submissionMeta]);

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
    if (challenge?.enabled && String(challengeAnswer || "").trim().length < 1) nextErrors.challenge = "Challenge answer is required.";

    return nextErrors;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (!formStartedTrackedRef.current && String(value || "").trim().length > 0) {
      formStartedTrackedRef.current = true;
      trackEvent("lead_form_start", {
        category: "conversion",
        pagePath,
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
      pagePath,
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
        payload.source = window.location.pathname || pagePath;
        payload.campaign = params.get("campaign") || undefined;
        payload.utm_source = params.get("utm_source") || undefined;
        payload.utm_medium = params.get("utm_medium") || undefined;
        payload.utm_campaign = params.get("utm_campaign") || undefined;
      }

      const response = await axios.post(`${API_BASE}/${resolvedMode}/submit`, payload, {
        timeout: SUBMIT_TIMEOUT_MS,
        headers: { "Content-Type": "application/json" },
      });
      const responseData = response?.data || {};

      setStatus("success");
      setServerMessage(responseData?.message || "Request submitted successfully.");
      setSubmissionMeta({
        duplicate: Boolean(responseData?.duplicate),
        spamBlocked: Boolean(responseData?.spam_blocked),
        reviewState: String(responseData?.review_state || ""),
        nextStep: String(responseData?.next_step || ""),
      });
      setFormData(INITIAL_FORM);
      setChallengeAnswer("");
      setErrors({});
      formStartedTrackedRef.current = false;
      loadChallenge();

      trackEvent("lead_form_submit_success", {
        category: "conversion",
        pagePath,
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
          pagePath,
          requestType: resolvedMode,
          leadId: responseData?.id,
          properties: { status: responseData?.status, lead_status: responseData?.lead_status },
        });
      }

      if (responseData?.spam_blocked || String(responseData?.lead_status || "").toLowerCase() === "spam") {
        trackEvent("lead_spam_blocked", {
          category: "conversion",
          pagePath,
          requestType: resolvedMode,
          leadId: responseData?.id,
          properties: { lead_status: responseData?.lead_status },
        });
      }
    } catch (error) {
      const detail = resolveSubmitErrorMessage(error);

      setStatus("error");
      setServerMessage(String(detail));
      setSubmissionMeta({ duplicate: false, spamBlocked: false, reviewState: "", nextStep: "" });
      trackEvent("lead_form_submit_error", {
        category: "conversion",
        pagePath,
        requestType: resolvedMode,
        properties: { detail: String(detail).slice(0, 220) },
      });

      if (String(detail).toLowerCase().includes("challenge")) {
        loadChallenge();
      }
    }
  };

  const applyQuickStart = (item) => {
    setFormData((prev) => ({
      ...prev,
      use_case: item.useCase,
      message: prev.message || item.message,
    }));
    setErrors((prev) => ({ ...prev, use_case: "", message: "" }));
    trackEvent("lead_quick_start_selected", {
      category: "conversion",
      pagePath,
      requestType: resolvedMode,
      properties: { label: item.label, use_case: item.useCase },
    });
  };

  return (
    <div className="marketing-shell lead-marketing-shell">
      <PublicHeader variant="cred" pagePath={pagePath} />

      <main className="marketing-main">
        <section className="marketing-hero">
          <article className="marketing-card marketing-hero-copy">
            <Link to="/" className="lead-back-link">
              <ArrowLeft size={14} />
              Back to Home
            </Link>
            <div className="marketing-badge">
              <Icon size={14} />
              {copy.badge}
            </div>
            <div className="marketing-hero-signal">
              {copy.signals.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <h1 className="marketing-title">{copy.title}</h1>
            <p className="marketing-subtitle">{copy.subtitle}</p>
            <div className="marketing-inline-points">
              {copy.inlinePoints.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="marketing-actions">
              <a
                href="#lead-form"
                className="marketing-btn marketing-btn-primary"
                onClick={() => trackCtaClick(isDemo ? "jump_to_demo_form" : "jump_to_contact_form", pagePath)}
              >
                {copy.submitLabel} <ArrowRight size={16} />
              </a>
              <Link
                to={copy.switchPath}
                className="marketing-btn marketing-btn-secondary"
                onClick={() => trackCtaClick(isDemo ? "switch_to_contact" : "switch_to_demo", pagePath)}
              >
                {copy.switchLabel}
              </Link>
            </div>
            <div className="lead-response-pill">
              <span>Expected response</span>
              <strong>{copy.responseWindow}</strong>
            </div>
            <div className="marketing-hero-story">
              <div className="marketing-hero-story-head">
                <span className="marketing-kicker">{copy.storyKicker}</span>
                <strong>{copy.storyTitle}</strong>
              </div>
              <ul className="marketing-checklist marketing-checklist-compact">
                {copy.checklist.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <aside className="marketing-card marketing-hero-panel lead-hero-panel">
            <div className="marketing-panel-head">
              <div>
                <div className="marketing-kicker">{copy.panelKicker}</div>
                <h3>{copy.panelTitle}</h3>
              </div>
            </div>
            <ul className="marketing-list lead-panel-list">
              {copy.panelItems.map((item, index) => (
                <li key={item} className="simple">
                  <span>{index + 1}</span>
                  <strong>{item}</strong>
                </li>
              ))}
            </ul>
            <div className="marketing-stage-strip">
              {copy.panelMeta.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="marketing-summary">
              <div className="marketing-summary-head">
                <Clock3 size={16} />
                <span>Expected next step</span>
              </div>
              <p>{copy.panelSummary}</p>
            </div>
          </aside>
        </section>

        <section className="marketing-card marketing-live-ribbon">
          <div className="marketing-live-ribbon-head">
            <Activity size={15} />
            <strong>{copy.ribbonTitle}</strong>
          </div>
          <div className="marketing-live-ribbon-stream">
            {copy.ribbonItems.map((item) => (
              <div key={item.value} className="marketing-live-pill-item">
                <span>{item.label}</span>
                <code>{item.value}</code>
              </div>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-authority-band">
            <article className="marketing-card marketing-authority-copy">
              <p className="marketing-kicker">{copy.authorityKicker}</p>
              <h2>{copy.authorityTitle}</h2>
              <p>{copy.authorityBody}</p>
              <ul className="marketing-checklist marketing-checklist-compact">
                {copy.checklist.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article id="lead-form" className="marketing-card lead-form-panel">
              <div className="lead-form-head">
                <p className="marketing-kicker">{copy.badge}</p>
                <h2>{copy.formTitle}</h2>
                <p>{copy.formDescription}</p>
              </div>

              {status === "success" ? (
                <div className="lead-success-box" role="status">
                  <div>
                    <CheckCircle2 size={18} />
                    <strong>{successState.title}</strong>
                  </div>
                  <p>{serverMessage}</p>
                  <div className="lead-success-meta">
                    <span>{successState.detail}</span>
                    {submissionMeta.nextStep ? <code>{submissionMeta.nextStep}</code> : null}
                  </div>
                  <ul className="marketing-checklist marketing-checklist-compact lead-success-notes">
                    {successState.notes.map((item) => (
                      <li key={item}>
                        <CheckCircle2 size={16} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="lead-success-actions">
                    <Link to={copy.successPrimary.to} className="lead-btn lead-btn-secondary">
                      {copy.successPrimary.label}
                    </Link>
                    <Link to={copy.successSecondary.to} className="lead-btn lead-btn-primary">
                      {copy.successSecondary.label}
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="lead-form" noValidate>
                  <div className="lead-quick-starts">
                    <span>Fast start</span>
                    <div className="lead-quick-start-grid">
                      {copy.quickStarts.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className="lead-quick-start"
                          onClick={() => applyQuickStart(item)}
                        >
                          <strong>{item.label}</strong>
                          <small>{item.useCase}</small>
                        </button>
                      ))}
                    </div>
                  </div>

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
                    placeholder="SOC monitoring, public services, campus lab, cloud defense..."
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
                      <div className="lead-challenge-box">{challenge?.prompt || "Solve challenge"}</div>
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
                        <button type="button" onClick={loadChallenge} className="lead-btn lead-btn-secondary lead-btn-inline">
                          <RefreshCw size={14} />
                          New
                        </button>
                      </div>
                      {errors.challenge ? <small>{errors.challenge}</small> : null}
                    </div>
                  ) : null}

                  {status === "error" ? (
                    <div className="lead-error-box" role="alert">
                      <AlertCircle size={16} />
                      <span>{serverMessage}</span>
                    </div>
                  ) : null}

                  <div className="lead-actions">
                    <button type="submit" className="lead-btn lead-btn-primary" disabled={status === "submitting"}>
                      <Send size={14} />
                      {status === "submitting" ? "Submitting..." : copy.submitLabel}
                    </button>
                    <Link
                      to={copy.switchPath}
                      className="lead-btn lead-btn-secondary"
                      onClick={() => trackCtaClick(isDemo ? "switch_to_contact" : "switch_to_demo", pagePath)}
                    >
                      {copy.switchLabel}
                    </Link>
                  </div>
                </form>
              )}
            </article>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>{copy.proofKicker}</p>
            <h2>{copy.proofTitle}</h2>
          </div>
          <div className="marketing-grid-3">
            {copy.proofCards.map((item) => {
              const ProofIcon = item.icon;
              return (
                <article key={item.title} className="marketing-card marketing-feature">
                  <div className="marketing-icon-box">
                    <ProofIcon size={18} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="marketing-card marketing-cta">
          <div className="marketing-cta-copy">
            <h2>{copy.ctaTitle}</h2>
            <p>{copy.ctaBody}</p>
          </div>
          <div className="marketing-actions">
            <Link to={copy.switchPath} className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick(isDemo ? "switch_to_contact" : "switch_to_demo", pagePath)}>
              {copy.switchLabel}
            </Link>
            <Link to="/" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("back_home", pagePath)}>
              Back Home
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

function Field({ label, name, type = "text", value, onChange, error, placeholder, multiline = false }) {
  return (
    <label className="lead-field">
      <span>{label}</span>
      {multiline ? (
        <textarea name={name} value={value} onChange={onChange} placeholder={placeholder} rows={5} aria-invalid={Boolean(error)} />
      ) : (
        <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} aria-invalid={Boolean(error)} />
      )}
      {error ? <small>{error}</small> : null}
    </label>
  );
}
