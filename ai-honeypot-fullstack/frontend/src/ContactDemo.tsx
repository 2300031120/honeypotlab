import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios, { type AxiosError } from "axios";
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

type ModeKey = "contact" | "demo";

type ModeConfig = {
  badge: string;
  title: string;
  subtitle: string;
  submitLabel: string;
  companyLabel: string;
  companyPlaceholder: string;
  defaultUseCase: string;
  defaultMessage: string;
  icon: React.ElementType;
  signals: string[];
  inlinePoints: string[];
  storyKicker: string;
  storyTitle: string;
  checklist: string[];
  audienceKicker: string;
  audienceTitle: string;
  audienceBody: string;
  proofStrip: Array<{ label: string; value: string }>;
  agendaKicker: string;
  agendaTitle: string;
  agendaSteps: Array<{ title: string; detail: string; icon: React.ElementType }>;
  panelKicker: string;
  panelTitle: string;
  panelItems: string[];
  panelMeta: Array<{ label: string; value: string }>;
  panelSummary: string;
  ribbonTitle: string;
  ribbonItems: Array<{ label: string; value: string }>;
  authorityKicker: string;
  authorityTitle: string;
  authorityBody: string;
  proofKicker: string;
  proofTitle: string;
  proofCards: Array<{ title: string; detail: string; icon: React.ElementType }>;
  quickStarts: Array<{ label: string; useCase: string; message: string }>;
  responseWindow: string;
  switchPath: string;
  switchLabel: string;
  formTitle: string;
  formDescription: string;
  formAssistTitle: string;
  formAssistItems: string[];
  successPrimary: { to: string; label: string };
  successSecondary: { to: string; label: string };
  outcomeKicker: string;
  outcomeTitle: string;
  outcomeCards: Array<{ title: string; detail: string; icon: React.ElementType }>;
  ctaTitle: string;
  ctaBody: string;
};

type LeadForm = {
  name: string;
  email: string;
  organization: string;
  use_case: string;
  message: string;
  referral_code: string;
};

type LeadErrorKey = keyof LeadForm | "challenge";

type LeadErrors = Partial<Record<LeadErrorKey, string>>;

type SubmissionMeta = {
  duplicate: boolean;
  spamBlocked: boolean;
  reviewState: string;
  nextStep: string;
};

type LeadChallenge = {
  enabled: boolean;
  challenge_id?: string;
  prompt?: string;
};

type LeadSubmitPayload = LeadForm & {
  challenge_id?: string;
  challenge_answer: string;
  submitted_at_ms: number;
  source?: string;
  campaign?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

type ContactDemoProps = {
  mode?: ModeKey;
};

const MODE_CONFIG: Record<ModeKey, ModeConfig> = {
  contact: {
    badge: "Contact Team",
    title: `Talk to the ${PUBLIC_SITE.shortName || PUBLIC_SITE.siteName} team about protecting exposed login, admin, and API routes.`,
    subtitle:
      "Share your environment and rollout priority. We will map likely exposure points, the proof your team needs, and the cleanest next step for a pilot.",
    submitLabel: "Send Message",
    companyLabel: "Company",
    companyPlaceholder: "Company or security team",
    defaultUseCase: "Planning rollout for exposed routes",
    defaultMessage: "Need help mapping a pilot around exposed login, admin, or API routes.",
    icon: MessageSquare,
    signals: ["Pilot planning", "Exposed-route review", "Direct team conversation"],
    inlinePoints: ["Deployment advice", "Exposure review", "Buyer-fit review"],
    storyKicker: "Why contact us",
    storyTitle: "Best when you need rollout guidance, proof planning, or a clearer early-detection workflow.",
    checklist: [
      "Map exposed routes, portals, or services to the strongest deception workflow",
      "Decide whether the platform fits a pilot, internal rollout, or analyst-facing monitoring workflow",
      "Plan how evidence and replay support your operators before production impact",
    ],
    audienceKicker: "Useful context",
    audienceTitle: "Bring the routes, blockers, and reviewer questions that shape a practical first reply.",
    audienceBody:
      "A short note on exposed routes, rollout blockers, or reviewer questions helps the team shape the first reply around what matters most.",
    proofStrip: [
      { label: "Best fit", value: "Pilot planning" },
      { label: "Conversation", value: "Exposure review" },
      { label: "Next step", value: "Demo or rollout path" },
    ],
    agendaKicker: "Planning call flow",
    agendaTitle: "Keep the first conversation focused on exposure, rollout, and the proof your team needs next.",
    agendaSteps: [
      {
        title: "Map the exposed surface",
        detail: "Anchor the conversation to the login, admin, portal, or API routes your team wants to protect first.",
        icon: MessageSquare,
      },
      {
        title: "Choose the first workflow",
        detail: "Decide where believable decoys, telemetry capture, and analyst review create the strongest early signal.",
        icon: ShieldCheck,
      },
      {
        title: "Define the next step",
        detail: "Leave the call with a clearer demo scope, pilot path, or rollout recommendation for the environment.",
        icon: Clock3,
      },
    ],
    panelKicker: "Best for",
    panelTitle: "What we can help with",
    panelItems: [
      "Evaluating fit for public-facing SaaS apps, portals, and lean SOC workflows",
      "Planning where believable decoys and honey paths fit into your exposed routes",
      "Discussing telemetry coverage, evidence needs, and the shape of a practical first pilot",
    ],
    panelMeta: [
      { label: "Conversation type", value: "Planning session" },
      { label: "Typical outcome", value: "Deployment path" },
    ],
    panelSummary: "Map the deployment path, the proof requirements, and the best next step for your environment.",
    ribbonTitle: "What happens after you reach out",
    ribbonItems: [
      { label: "Step 1", value: "We review team size, environment, and use case" },
      { label: "Step 2", value: "We map the right deception workflow and first deployment path" },
      { label: "Step 3", value: "We recommend next step: demo, pilot, or operational follow-up" },
    ],
    authorityKicker: "Deployment conversation",
    authorityTitle: "Keep the first conversation focused on rollout, evidence, and operator fit.",
    authorityBody:
      "Security teams do not need a generic contact form. They need a clear path to deployment, evidence capture, and confidence that the workflow fits live environments.",
    proofKicker: "What the conversation covers",
    proofTitle: "Turn product interest into a concrete deployment discussion",
    proofCards: [
      {
        title: "Use-case mapping",
        detail: "Define where deception creates the most value across exposed login, admin, API, and customer portal workflows.",
        icon: Users,
      },
      {
        title: "Deployment guidance",
        detail: "Discuss decoy placement, telemetry expectations, and how to structure a practical first rollout without touching production systems.",
        icon: ShieldCheck,
      },
      {
        title: "Mission alignment",
        detail: "Align the platform with stakeholder priorities, operator workflows, and the services you need to protect first.",
        icon: LayoutDashboard,
      },
    ],
    quickStarts: [
      {
        label: "SaaS route pilot",
        useCase: "Protect exposed login and admin routes",
        message: "Need help mapping believable decoys and first pilot steps around exposed login, admin, and API routes.",
      },
      {
        label: "MSSP rollout",
        useCase: "Review MSSP proof and customer reporting workflow",
        message: "Need guidance on how the workflow supports proof, reporting, and rollout across customer environments.",
      },
      {
        label: "SOC planning",
        useCase: "Evaluate operator workflow for SOC monitoring",
        message: "Need to understand where telemetry, analyst summaries, and replay fit our current analyst workflow.",
      },
    ],
    responseWindow: "Usually within 1 business day",
    switchPath: "/demo",
    switchLabel: "Request Demo",
    formTitle: "Start the conversation",
    formDescription: "Start with your name, work email, and company. Use-case details are optional and help us tailor the reply.",
    formAssistTitle: "Helpful context",
    formAssistItems: [
      "Which routes or services are exposed first",
      "Who needs proof before a pilot can start",
      "How your team plans to review alerts or evidence",
    ],
    successPrimary: { to: "/", label: "Home" },
    successSecondary: { to: "/platform", label: "Explore Platform" },
    outcomeKicker: "What you leave with",
    outcomeTitle: "Use the first call to de-risk rollout before you commit time to the wrong path.",
    outcomeCards: [
      {
        title: "Exposure review summary",
        detail: "A clearer view of where deception can create early signal across public-facing routes and services.",
        icon: Users,
      },
      {
        title: "Pilot recommendation",
        detail: "A practical next step for demo scope, deployment shape, or the first production-safe pilot motion.",
        icon: ShieldCheck,
      },
      {
        title: "Operator-fit guidance",
        detail: "Better alignment between product proof, analyst workflow, and the people who need to review evidence.",
        icon: LayoutDashboard,
      },
    ],
    ctaTitle: "Prefer to see the workflow live instead?",
    ctaBody: "Request a walkthrough if you want to see decoys, telemetry, replay, and AI incident context in motion.",
  },
  demo: {
    badge: "Live Demo",
    title: "Request a founder-led walkthrough focused on exposed routes, evidence capture, and analyst response.",
    subtitle:
      "See how believable decoys turn first-touch attacker activity into preserved evidence, incident context, and a clear pilot recommendation.",
    submitLabel: "Request Demo",
    companyLabel: "Company",
    companyPlaceholder: "Company or security team",
    defaultUseCase: "Demo for exposed login, admin, and API routes",
    defaultMessage: "Need a walkthrough focused on exposed routes, analyst evidence, and rollout fit.",
    icon: Rocket,
    signals: ["Founder-led walkthrough", "Exposure-specific workflow", "Decision-ready proof"],
    inlinePoints: ["Buyer-ready proof", "Operator workflow", "Pilot next step"],
    storyKicker: "Why teams request demos",
    storyTitle: "Best when you need more than a screen tour and want to test the workflow against a real exposure story.",
    checklist: [
      "Walk through believable decoys and the attacker interaction surfaces they target first",
      "See how telemetry, evidence, summaries, and replay connect into one workflow",
      "Validate how the platform supports analysts before real systems or users are touched",
    ],
    audienceKicker: "Best attendees",
    audienceTitle: "Bring the people who decide, review, and operate the workflow in the same session.",
    audienceBody:
      "Bring the person who owns the exposed surface, the operator who will review evidence, and anyone who needs proof before a pilot starts.",
    proofStrip: [
      { label: "Format", value: "Founder-led live walkthrough" },
      { label: "Focus", value: "Your exposed routes" },
      { label: "Outcome", value: "Pilot-ready next step" },
    ],
    agendaKicker: "Walkthrough agenda",
    agendaTitle: "The demo should answer buyer, operator, and deployment questions in one pass.",
    agendaSteps: [
      {
        title: "Anchor to exposed routes",
        detail: "Start with the login, admin, or API routes you want the workflow mapped against instead of watching a generic tour.",
        icon: ShieldCheck,
      },
      {
        title: "Show workflow proof",
        detail: "Move from decoy interaction to telemetry, replay, and AI brief without disconnected screens or abstract claims.",
        icon: Activity,
      },
      {
        title: "Leave with a decision path",
        detail: "Close on rollout fit, pilot shape, and the proof package reviewers need to move the conversation forward.",
        icon: Rocket,
      },
    ],
    panelKicker: "What you'll see",
    panelTitle: "Demo flow",
    panelItems: [
      "Attacker interaction across decoy pages, APIs, and operator views",
      "Live telemetry snapshots with session activity, route trails, and event evidence",
      "Analyst-ready incident summaries that support review, briefings, and team response",
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
      { label: "Step 2", value: "We tailor the walkthrough to your workflow, service exposure, and rollout priorities" },
      { label: "Step 3", value: "You get a live platform walkthrough grounded in operational proof" },
    ],
    authorityKicker: "Demo approach",
    authorityTitle: "Show the workflow before the team commits to a live call.",
    authorityBody:
      "Strong cyber products combine immediate proof with a low-friction next step. The demo request should feel connected to the operator workflow, not detached from it.",
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
        detail: "See how raw attacker behavior becomes readable summaries that support faster understanding and team response.",
        icon: BrainCircuit,
      },
    ],
    quickStarts: [
      {
        label: "Exposed route proof",
        useCase: "Validate detection on exposed login, admin, and API routes",
        message: "Need a live walkthrough focused on exposed routes, evidence capture, and analyst-ready triage.",
      },
      {
        label: "MSSP workflow",
        useCase: "Review proof workflow for MSSP customer environments",
        message: "Need the demo tailored to exposed application routes, customer proof, and analyst handoff.",
      },
      {
        label: "Leadership review",
        useCase: "Show the platform to decision-makers and reviewers",
        message: "Need a concise demo that proves product fit, deployment path, and operator value for stakeholders.",
      },
    ],
    responseWindow: "We usually confirm the walkthrough scope after the first review",
    switchPath: "/contact",
    switchLabel: "Contact Team",
    formTitle: "Request your demo",
    formDescription: "Start with your name, work email, and company. Extra context is optional and helps us tailor the walkthrough.",
    formAssistTitle: "Bring this context",
    formAssistItems: [
      "One or two routes or services you want the walkthrough anchored to",
      "What proof your buyer or security lead needs before approving a pilot",
      "Who will review alerts, evidence, or replay once the platform is live",
    ],
    successPrimary: { to: "/", label: "Home" },
    successSecondary: { to: "/platform", label: "Explore Platform" },
    outcomeKicker: "What you leave with",
    outcomeTitle: "A decision-ready proof package, not a generic product tour.",
    outcomeCards: [
      {
        title: "Exposure-specific recommendation",
        detail: "A clearer recommendation for where the first decoys and honey paths should sit across the exposed surface.",
        icon: ShieldCheck,
      },
      {
        title: "Operator workflow proof",
        detail: "Direct proof that the product can take first-touch activity and turn it into readable evidence for analysts.",
        icon: BrainCircuit,
      },
      {
        title: "Pilot path for reviewers",
        detail: "A concrete next step your team can use with leadership, buyers, or technical reviewers after the call.",
        icon: LayoutDashboard,
      },
    ],
    ctaTitle: "Need a planning conversation before the demo?",
    ctaBody: "Use the contact page if you want help choosing the right use case, rollout path, or exposure points first.",
  },
};

const INITIAL_FORM: LeadForm = {
  name: "",
  email: "",
  organization: "",
  use_case: "",
  message: "",
  referral_code: "",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBMIT_TIMEOUT_MS = 20000;

function withFallback(value: string, fallback: string) {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function applyPrefillFromSearch(searchValue: string, currentValue: LeadForm): LeadForm {
  const params = new URLSearchParams(searchValue || "");
  return {
    name: currentValue.name || params.get("name") || "",
    email: currentValue.email || params.get("email") || "",
    organization: currentValue.organization || params.get("organization") || "",
    use_case: currentValue.use_case || params.get("use_case") || params.get("focus") || "",
    message: currentValue.message || params.get("message") || "",
    referral_code: currentValue.referral_code || "",
  };
}

const isAxiosError = (error: unknown): error is AxiosError<{ detail?: string; message?: string }> =>
  axios.isAxiosError(error);

function resolveSubmitErrorMessage(error: unknown) {
  const statusMessage = isAxiosError(error) ? error.message : String((error as Error | undefined)?.message || "");
  if ((error as { code?: string })?.code === "ECONNABORTED" || statusMessage.toLowerCase().includes("timeout")) {
    return `Request timed out. Please retry, or email ${PUBLIC_SITE.contactEmail} if urgent.`;
  }
  if (isAxiosError(error)) {
    return (
      error.response?.data?.detail ||
      error.response?.data?.message ||
      "Unable to submit right now. Please try again in a moment."
    );
  }
  return "Unable to submit right now. Please try again in a moment.";
}

function formatPreferredMeetingWindow(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function appendMeetingPreference(baseMessage: string, preferredWindow: string, timezone: string) {
  const formattedWindow = formatPreferredMeetingWindow(preferredWindow);
  if (!formattedWindow) {
    return baseMessage;
  }
  return `${baseMessage}\n\nPreferred meeting window: ${formattedWindow} (${timezone}).`;
}

export default function ContactDemo({ mode = "contact" }: ContactDemoProps) {
  const resolvedMode = mode === "demo" ? "demo" : "contact";
  const copy = useMemo(() => MODE_CONFIG[resolvedMode], [resolvedMode]);
  const Icon = copy.icon;
  const isDemo = resolvedMode === "demo";
  const pagePath = isDemo ? "/demo" : "/contact";
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;
  const location = useLocation();
  const bookingUrl = PUBLIC_SITE.demoBookingUrl;
  const bookingLabel = PUBLIC_SITE.demoBookingLabel || "Book Live Slot";
  const hasDirectBooking = isDemo && Boolean(bookingUrl);
  const browserTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local timezone";
    } catch {
      return "Local timezone";
    }
  }, []);

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

  const [formData, setFormData] = useState<LeadForm>(INITIAL_FORM);
  const [errors, setErrors] = useState<LeadErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [serverMessage, setServerMessage] = useState("");
  const [submissionMeta, setSubmissionMeta] = useState<SubmissionMeta>({
    duplicate: false,
    spamBlocked: false,
    reviewState: "",
    nextStep: "",
  });
  const [challenge, setChallenge] = useState<LeadChallenge>({ enabled: false });
  const [challengeAnswer, setChallengeAnswer] = useState("");
  const [preferredMeetingWindow, setPreferredMeetingWindow] = useState("");
  const formStartedAtRef = useRef<number>(Date.now());
  const formStartedTrackedRef = useRef<boolean>(false);

  const loadChallenge = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/lead/challenge`);
      const data = response.data || {};
      setChallenge({
        enabled: Boolean(data.enabled),
        challenge_id: data.challenge_id,
        prompt: data.prompt,
      });
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
          "Keep the message concise and focused on rollout, operator workflow, or demo scope.",
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

  const validate = (): LeadErrors => {
    const nextErrors: LeadErrors = {};
    const name = String(formData.name || "").trim();
    const email = String(formData.email || "").trim();
    const organization = String(formData.organization || "").trim();

    if (name.length < 2) nextErrors.name = "Name is required.";
    if (!EMAIL_REGEX.test(email)) nextErrors.email = "Valid email is required.";
    if (organization.length < 2) nextErrors.organization = `${copy.companyLabel} is required.`;
    if (challenge?.enabled && String(challengeAnswer || "").trim().length < 1) nextErrors.challenge = "Challenge answer is required.";

    return nextErrors;
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    const field = name as keyof LeadForm;
    if (!formStartedTrackedRef.current && String(value || "").trim().length > 0) {
      formStartedTrackedRef.current = true;
      trackEvent("lead_form_start", {
        category: "conversion",
        pagePath,
        requestType: resolvedMode,
        properties: { field, mode: resolvedMode },
      });
    }

    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
      const resolvedMessage = withFallback(formData.message, copy.defaultMessage);
      const payload: LeadSubmitPayload = {
        name: String(formData.name || "").trim(),
        email: String(formData.email || "").trim(),
        organization: withFallback(formData.organization, copy.companyPlaceholder),
        use_case: withFallback(formData.use_case, copy.defaultUseCase),
        message: isDemo ? appendMeetingPreference(resolvedMessage, preferredMeetingWindow, browserTimezone) : resolvedMessage,
        referral_code: String(formData.referral_code || ""),
        challenge_answer: String(challengeAnswer || "").trim(),
        submitted_at_ms: formStartedAtRef.current,
      };
      if (challenge?.challenge_id) {
        payload.challenge_id = challenge.challenge_id;
      }

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search || "");
        payload.source = window.location.pathname || pagePath;
        const campaign = params.get("campaign");
        const utmSource = params.get("utm_source");
        const utmMedium = params.get("utm_medium");
        const utmCampaign = params.get("utm_campaign");
        if (campaign) payload.campaign = campaign;
        if (utmSource) payload.utm_source = utmSource;
        if (utmMedium) payload.utm_medium = utmMedium;
        if (utmCampaign) payload.utm_campaign = utmCampaign;
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
      setPreferredMeetingWindow("");
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

  const applyQuickStart = (item: ModeConfig["quickStarts"][number]) => {
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

  const proofStrip = (
    <div className="lead-proof-strip">
      {copy.proofStrip.map((item) => (
        <div key={item.label} className="lead-proof-item">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );

  const directBookingButton = hasDirectBooking ? (
    <a
      href={bookingUrl}
      target="_blank"
      rel="noreferrer"
      className="lead-btn lead-btn-secondary lead-btn-booking"
      onClick={() => trackCtaClick("book_demo_calendar", pagePath)}
    >
      <Clock3 size={14} />
      {bookingLabel}
    </a>
  ) : null;

  const formPanel = (
    <aside id="lead-form" className="marketing-card lead-form-panel">
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
            {hasDirectBooking ? (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="lead-btn lead-btn-secondary"
                onClick={() => trackCtaClick("book_demo_calendar_success", pagePath)}
              >
                <Clock3 size={14} />
                {bookingLabel}
              </a>
            ) : null}
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
          {isDemo ? (
            <div className="lead-booking-panel">
              <div className="lead-booking-copy">
                <p className="marketing-kicker">Scheduling</p>
                <h3>{hasDirectBooking ? "Book a slot instantly or share context first." : "Share a preferred meeting window now."}</h3>
                <p>
                  {hasDirectBooking
                    ? "Use the direct booking link if your team already wants a fixed slot. The form is still useful if you want the walkthrough shaped around a specific exposure story first."
                    : "Add a preferred meeting window below and we will use it to line up the walkthrough reply with your team."}
                </p>
              </div>
              <div className="lead-booking-actions">
                {directBookingButton}
                <div className="lead-booking-timezone">
                  <span>Timezone</span>
                  <strong>{browserTimezone}</strong>
                </div>
              </div>
              <label className="lead-field lead-field-inline">
                <span>Preferred meeting window (optional)</span>
                <small>We append this to the demo request so the reply can include a workable slot.</small>
                <input
                  type="datetime-local"
                  name="preferred_meeting_window"
                  value={preferredMeetingWindow}
                  onChange={(event) => setPreferredMeetingWindow(event.target.value)}
                />
              </label>
            </div>
          ) : null}

          <div className="lead-form-assist">
            <strong>{copy.formAssistTitle}</strong>
            <ul>
              {copy.formAssistItems.map((item) => (
                <li key={item}>
                  <CheckCircle2 size={14} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

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
            name="referral_code"
            value={formData.referral_code}
            onChange={handleChange}
            autoComplete="new-password"
            tabIndex={-1}
            aria-hidden="true"
            readOnly
            data-1p-ignore="true"
            data-lpignore="true"
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
            label="Work Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            placeholder="name@company.com"
          />
          <Field
            label={copy.companyLabel}
            name="organization"
            value={formData.organization}
            onChange={handleChange}
            error={errors.organization}
            placeholder={copy.companyPlaceholder}
          />
          <div className="lead-field">
            <span>Optional context</span>
            <small>Use case and rollout details help us tailor the reply, but they are not required to get started.</small>
          </div>
          <Field
            label="Primary use case (optional)"
            name="use_case"
            value={formData.use_case}
            onChange={handleChange}
            error={errors.use_case}
            placeholder={copy.defaultUseCase}
          />
          <Field
            label="Anything we should know? (optional)"
            name="message"
            value={formData.message}
            onChange={handleChange}
            error={errors.message}
            placeholder={copy.defaultMessage}
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
    </aside>
  );

  return (
    <div className="marketing-shell lead-marketing-shell">
      <PublicHeader variant="cred" pagePath={pagePath} />

      <main className="marketing-main">
        <section className="marketing-hero">
          <article className="marketing-card marketing-hero-copy lead-hero-copy-premium">
            <Link to="/" className="lead-back-link">
              <ArrowLeft size={14} />
              Back to Home
            </Link>
            <div className="marketing-badge">
              <Icon size={14} />
              {copy.badge}
            </div>
            <h1 className="marketing-title">{copy.title}</h1>
            <p className="marketing-subtitle">{copy.subtitle}</p>
            <div className="marketing-inline-points marketing-inline-points-compact">
              {copy.signals.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="marketing-actions">
              {hasDirectBooking ? (
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="marketing-btn marketing-btn-secondary lead-booking-hero-btn"
                  onClick={() => trackCtaClick("book_demo_calendar_hero", pagePath)}
                >
                  {bookingLabel}
                </a>
              ) : null}
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
            {proofStrip}
            <p className="marketing-page-footnote lead-page-footnote">
              {hasDirectBooking
                ? "Use the calendar button if your team already wants a fixed slot. Use the form if you want the walkthrough shaped around a specific route, buyer, or operator workflow first."
                : "Use the fast-start buttons in the form if you already know the route, buyer, or operator workflow you want the team to focus on first."}
            </p>
          </article>

          {formPanel}
        </section>

        <section className="marketing-section lead-story-section">
          <div className="marketing-grid-2 lead-story-grid">
            <article className="marketing-card lead-story-card">
              <p className="marketing-kicker">{copy.storyKicker}</p>
              <h2>{copy.storyTitle}</h2>
              <ul className="marketing-checklist">
                {copy.checklist.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="marketing-card lead-audience-card">
              <p className="marketing-kicker">{copy.audienceKicker}</p>
              <h2>{copy.audienceTitle}</h2>
              <p>{copy.audienceBody}</p>
              <div className="lead-inline-point-row">
                {copy.inlinePoints.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <div className="lead-audience-note">
                <Users size={16} />
                <span>{isDemo ? "Security lead, operator, and reviewer usually get the most from the same session." : "A short note on scope and blockers makes the first reply materially better."}</span>
              </div>
            </article>
          </div>
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
          <div className="marketing-section-head">
            <p>{copy.agendaKicker}</p>
            <h2>{copy.agendaTitle}</h2>
          </div>
          <div className="marketing-grid-3 lead-agenda-grid">
            {copy.agendaSteps.map((item, index) => {
              const StepIcon = item.icon;
              return (
                <article key={item.title} className="marketing-card lead-agenda-card">
                  <div className="lead-agenda-head">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div className="marketing-icon-box">
                      <StepIcon size={18} />
                    </div>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-authority-band">
            <article className="marketing-card marketing-authority-copy">
              <p className="marketing-kicker">{copy.authorityKicker}</p>
              <h2>{copy.authorityTitle}</h2>
              <p>{copy.authorityBody}</p>
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
            </article>

            <article className="marketing-card marketing-hero-panel lead-hero-panel">
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
              <div className="marketing-summary">
                <div className="marketing-summary-head">
                  <Clock3 size={16} />
                  <span>What the team will focus on</span>
                </div>
                <p>{copy.panelSummary}</p>
              </div>
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

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>{copy.outcomeKicker}</p>
            <h2>{copy.outcomeTitle}</h2>
          </div>
          <div className="marketing-grid-3 lead-outcome-grid">
            {copy.outcomeCards.map((item) => {
              const OutcomeIcon = item.icon;
              return (
                <article key={item.title} className="marketing-card lead-outcome-card">
                  <div className="marketing-icon-box">
                    <OutcomeIcon size={18} />
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

type FieldProps = {
  label: string;
  name: keyof LeadForm | "challenge_answer";
  type?: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string | undefined;
  placeholder?: string;
  multiline?: boolean;
};

function Field({ label, name, type = "text", value, onChange, error, placeholder, multiline = false }: FieldProps) {
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
