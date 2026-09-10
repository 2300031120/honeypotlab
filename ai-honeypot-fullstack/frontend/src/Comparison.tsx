import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { trackCtaClick } from "./utils/analytics";
import { PUBLIC_SITE } from "./siteConfig";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

const FEATURE_COMPARISON = [
  {
    category: "Deception & Traps",
    features: [
      { name: "Exposed-route decoys (login, admin, API)", cyberSentil: true, canaryTokens: true, cowrieHoneypots: false, enterpriseDeception: true },
      { name: "Multi-step session capture", cyberSentil: true, canaryTokens: false, cowrieHoneypots: true, enterpriseDeception: true },
      { name: "AI-powered attacker summarization", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: false },
      { name: "Route-order path preservation", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: false },
      { name: "Realistic web admin panel decoys", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: true },
      { name: "Credential spray detection", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: false },
    ],
  },
  {
    category: "Analysis & Evidence",
    features: [
      { name: "Analyst-ready incident brief", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: false },
      { name: "MITRE ATT&CK technique mapping", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: true },
      { name: "Signed evidence handoff", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: false },
      { name: "Replay and session forensics", cyberSentil: true, canaryTokens: false, cowrieHoneypots: true, enterpriseDeception: true },
      { name: "SIEM-ready ingest (Splunk, Sentinel)", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: true },
      { name: "Low false-positive signal", cyberSentil: true, canaryTokens: true, cowrieHoneypots: false, enterpriseDeception: true },
    ],
  },
  {
    category: "Deployment & Operations",
    features: [
      { name: "Docker + PostgreSQL pilot path", cyberSentil: true, canaryTokens: false, cowrieHoneypots: true, enterpriseDeception: false },
      { name: "Cloudflare Worker relay", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: false },
      { name: "Microsoft 365 Logic App integration", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: false },
      { name: "Public API health endpoint", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: false },
      { name: "Production-adjacent pilot", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: true },
      { name: "Trusted-host and HTTPS guardrails", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: false },
    ],
  },
  {
    category: "Compliance & Trust",
    features: [
      { name: "SOC 2 Ready controls", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: true },
      { name: "ISO 27001-aligned controls", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: true },
      { name: "OWASP-aligned decoys", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: false },
      { name: "GDPR-ready evidence handling", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: true },
      { name: "Security disclosure policy", cyberSentil: true, canaryTokens: false, cowrieHoneypots: false, enterpriseDeception: false },
      { name: "No attack-back or offensive actions", cyberSentil: true, canaryTokens: true, cowrieHoneypots: true, enterpriseDeception: true },
    ],
  },
];

const COLUMNS = [
  { key: "cyberSentil", label: "CyberSentil", accent: true },
  { key: "canaryTokens", label: "Canary Tokens" },
  { key: "cowrieHoneypots", label: "Cowrie / Honeypots" },
  { key: "enterpriseDeception", label: "Enterprise Deception" },
];

const TAKEAWAYS = [
  {
    title: "Canary tokens flag first touch, then stop",
    detail: "They tell you someone knocked — CyberSentil tells you who they are, what they touched, and in what order.",
  },
  {
    title: "Cowrie excels at protocol shells",
    detail: "SSH and Telnet coverage is deep, but modern web attack surfaces (login, admin, API routes) need different deception.",
  },
  {
    title: "Enterprise platforms are powerful but heavyweight",
    detail: "Full AD and network deception works for large fleets. CyberSentil targets a single exposed app with a bounded pilot.",
  },
];

export default function Comparison() {
  usePageAnalytics("comparison");
  useSeo({
    title: `Comparison — ${PUBLIC_SITE.siteName || "CyberSentil"}`,
    description:
      "See how CyberSentil compares to canary tokens, Cowrie honeypots, and enterprise deception platforms on session capture, analysis, deployment, and compliance.",
    ogTitle: `${PUBLIC_SITE.siteName} comparison`,
    ogDescription: "CyberSentil vs canary tokens, Cowrie, and enterprise deception — feature-by-feature.",
  });

  return (
    <div className="marketing-shell">
      <PublicHeader variant="cred" pagePath="/comparison" />

      <main className="marketing-main" id="main-content" tabIndex={-1}>
        <section className="marketing-section marketing-lazy-section">
          <div className="marketing-section-head">
            <p className="marketing-kicker">Competitive comparison</p>
            <h1>How CyberSentil compares to the alternatives security teams already know.</h1>
            <p style={{ maxWidth: "52rem", margin: "0 auto", opacity: 0.8 }}>
              A feature-by-feature look at CyberSentil against canary tokens, protocol honeypots, and enterprise deception platforms — so you can decide which approach fits your rollout.
            </p>
          </div>
        </section>

        <section className="marketing-card marketing-section marketing-lazy-section" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", lineHeight: 1.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #21262d", color: "#8b949e", fontWeight: 600 }}>Feature</th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    style={{
                      textAlign: "center",
                      padding: "10px 12px",
                      borderBottom: "1px solid #21262d",
                      color: col.accent ? "#63d7ff" : "#8b949e",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_COMPARISON.map((group) => (
                <Fragment key={group.category}>
                  <tr>
                    <td
                      colSpan={COLUMNS.length + 1}
                      style={{
                        padding: "14px 12px 6px",
                        fontWeight: 700,
                        color: "#e6edf3",
                        fontSize: "0.9rem",
                        borderBottom: "1px solid #21262d",
                      }}
                    >
                      {group.category}
                    </td>
                  </tr>
                  {group.features.map((feat) => (
                    <tr key={feat.name}>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #161b22", color: "#c9d1d9" }}>
                        {feat.name}
                      </td>
                      {COLUMNS.map((col) => (
                        <td
                          key={`${feat.name}-${col.key}`}
                          style={{
                            textAlign: "center",
                            padding: "8px 12px",
                            borderBottom: "1px solid #161b22",
                          }}
                        >
                          {feat[col.key as keyof typeof feat] ? (
                            <CheckCircle2 size={16} style={{ color: col.accent ? "#63d7ff" : "#3fb950" }} />
                          ) : (
                            <XCircle size={16} style={{ color: "#484f58" }} />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </section>

        <section className="marketing-section marketing-lazy-section">
          <div className="marketing-section-head">
            <p className="marketing-kicker">Key takeaways</p>
            <h2>What the comparison reveals for security teams.</h2>
          </div>
          <div className="marketing-grid-3">
            {TAKEAWAYS.map((item) => (
              <article key={item.title} className="marketing-card marketing-feature">
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-card marketing-cta marketing-lazy-section">
          <div className="marketing-cta-copy">
            <h2>See CyberSentil in your own environment.</h2>
            <p>
              Start with one exposed app, one team, and one clear operator workflow. Create a workspace or book a guided walkthrough.
            </p>
          </div>
          <div className="marketing-actions">
            <Link
              to="/auth/signup"
              className="marketing-btn marketing-btn-primary"
              onClick={() => trackCtaClick("comparison_create_workspace", "/comparison")}
            >
              Create Workspace <ArrowRight size={15} />
            </Link>
            <Link
              to="/demo"
              className="marketing-btn marketing-btn-secondary"
              onClick={() => trackCtaClick("comparison_request_demo", "/comparison")}
            >
              Request Demo
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
