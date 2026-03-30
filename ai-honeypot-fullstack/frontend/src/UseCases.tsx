import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, CheckCircle2, Cloud, FlaskConical, GraduationCap, ShieldCheck } from "lucide-react";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { PUBLIC_SITE } from "./siteConfig";
import { trackCtaClick } from "./utils/analytics";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

const BUYER_BADGES = ["SOC", "Public services", "Higher education", "Research labs", "Critical services", "Security teams"];

const USE_CASE_SIGNALS = ["Earlier visibility", "Readable response context", "Readiness support"];

const USE_CASE_CHECKLIST = [
  "Supports SOC monitoring, incident review, and cyber-readiness drills",
  "Fits exposed login, admin, API, and internal-style workflows",
  "Useful for public services, campuses, labs, and cloud-heavy teams that need earlier warning before real damage",
];

const USE_CASE_AUTHORITY = [
  {
    title: "Public-sector and campus readiness",
    detail: "The platform fits teams protecting citizen-facing portals, campus services, and internal applications that attract reconnaissance and phishing-led probing.",
  },
  {
    title: "Operational training value",
    detail: "Use the same deception workflow for analyst practice, awareness programs, cyber labs, and live readiness exercises.",
  },
  {
    title: "Real-world monitoring fit",
    detail: "Map deception directly to SOC triage, cloud reconnaissance, exposed admin paths, and incident review without extra complexity.",
  },
];

const USE_CASES = [
  {
    title: "Security teams",
    detail: "Review suspicious sessions quickly, preserve the incident trail, and shorten time to meaningful analyst context.",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "Public services",
    detail: "Place decoys near citizen-facing portals or internal administrative paths to surface hostile behavior before service disruption.",
    icon: <Building2 size={18} />,
  },
  {
    title: "Cloud-focused teams",
    detail: "Use cloud-like paths and API surfaces to observe credential abuse, automation, and reconnaissance behavior.",
    icon: <Cloud size={18} />,
  },
  {
    title: "Higher education and labs",
    detail: "Run controlled high-interaction experiments and help students or researchers study how attackers progress through a session.",
    icon: <FlaskConical size={18} />,
  },
  {
    title: "Training programs",
    detail: "Show analysts realistic attacker paths, replay steps, and AI summaries during readiness drills and exercises.",
    icon: <GraduationCap size={18} />,
  },
];

const PEOPLE_OUTCOMES = [
  {
    title: "For citizens and service users",
    detail: "Earlier detection around exposed service workflows helps reduce disruption and lowers the chance of silent attacker movement reaching real systems.",
    icon: <Building2 size={18} />,
    signal: "Safer public access",
    points: ["Catch hostile recon near service entry points", "Lower the risk of unnoticed escalation"],
  },
  {
    title: "For students and learners",
    detail: "Controlled deception environments make cyber training more practical, helping learners see real attacker behavior without touching production systems.",
    icon: <GraduationCap size={18} />,
    signal: "Real practice",
    points: ["Show believable attacker paths", "Train safely away from live systems"],
  },
  {
    title: "For operators and leaders",
    detail: "Readable summaries and replay paths help analysts respond faster and help leadership understand risk without digging through raw logs.",
    icon: <ShieldCheck size={18} />,
    signal: "Clear decisions",
    points: ["Speed up analyst triage", "Give leadership a cleaner incident picture"],
  },
];

const DEPLOYMENT_CONTEXTS = [
  {
    title: "Citizen-facing portals",
    detail: "Place deception near exposed login, admin, and service paths used by the public.",
    icon: <Building2 size={18} />,
    signal: "Service edge",
  },
  {
    title: "Universities and cyber labs",
    detail: "Support campus readiness, learning labs, and structured attacker-behavior exercises.",
    icon: <GraduationCap size={18} />,
    signal: "Learning environments",
  },
  {
    title: "Cloud and API surfaces",
    detail: "Observe automation, credential abuse, and reconnaissance across exposed application routes.",
    icon: <Cloud size={18} />,
    signal: "Cloud watch",
  },
  {
    title: "SOC and readiness teams",
    detail: "Use the same environment for monitoring, replay, drills, and analyst improvement.",
    icon: <ShieldCheck size={18} />,
    signal: "Operational workflow",
  },
];

export default function UseCases() {
  usePageAnalytics("use_cases");
  const productName = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;
  useSeo({
    title: `Use Cases | ${PUBLIC_SITE.siteName}`,
    description: `See where ${PUBLIC_SITE.siteName} fits across security teams, public services, cloud defense, and training environments.`,
    ogTitle: `${PUBLIC_SITE.siteName} Use Cases`,
    ogDescription: "A clearer view of who the product is for and how it can be used.",
  });

  return (
    <div className="marketing-shell">
      <PublicHeader variant="cred" pagePath="/use-cases" />
      <main className="marketing-main">
        <section className="marketing-hero">
          <article className="marketing-card marketing-hero-copy">
            <div className="marketing-badge">Use cases</div>
            <div className="marketing-hero-signal">
              {USE_CASE_SIGNALS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <h1 className="marketing-title">Built for teams that need earlier attacker visibility without another noisy tool.</h1>
            <p className="marketing-subtitle">
              {productName} fits public services, campuses, SOC teams, and cloud-heavy environments that need believable decoys,
              clearer telemetry, and a reusable workflow for monitoring, investigation, labs, and cyber-readiness programs before attackers touch real systems.
            </p>
            <div className="marketing-inline-points">
              {BUYER_BADGES.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="marketing-actions">
              <Link to="/demo" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("request_demo", "/use-cases")}>
                Request Demo <ArrowRight size={16} />
              </Link>
              <Link to="/platform" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("view_platform", "/use-cases")}>
                View Platform
              </Link>
            </div>
            <div className="marketing-hero-story">
              <div className="marketing-hero-story-head">
                <span className="marketing-kicker">Why these environments fit</span>
                <strong>The strongest fit is where early visibility, preserved evidence, and readiness all matter.</strong>
              </div>
              <ul className="marketing-checklist marketing-checklist-compact">
                {USE_CASE_CHECKLIST.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <aside className="marketing-card marketing-hero-panel">
            <div className="marketing-panel-head">
              <div>
                <div className="marketing-kicker">Best fit</div>
                <h3>Where the product helps most</h3>
              </div>
            </div>
            <ul className="marketing-list">
              <li className="simple"><span>1</span><strong>Public services and internal admin workflows</strong></li>
              <li className="simple"><span>2</span><strong>Higher education, research, and cyber labs</strong></li>
              <li className="simple"><span>3</span><strong>SOC teams running monitoring and readiness drills across distributed environments</strong></li>
            </ul>
            <div className="marketing-summary">
              <div className="marketing-summary-head">
                <ShieldCheck size={16} />
                <span>Ideal motion</span>
              </div>
              <p>Best where teams need early visibility, preserved evidence, and a clean way to explain risk to operators, leadership, and training programs.</p>
            </div>
          </aside>
        </section>

        <section className="marketing-card marketing-live-ribbon">
          <div className="marketing-live-ribbon-head">
            <ShieldCheck size={15} />
            <strong>Common deployment goals</strong>
          </div>
          <div className="marketing-live-ribbon-stream">
            <div className="marketing-live-pill-item">
              <span>Goal</span>
              <code>Expose hostile recon before production systems are touched</code>
            </div>
            <div className="marketing-live-pill-item">
              <span>Goal</span>
              <code>Give responders readable summaries instead of raw noise</code>
            </div>
            <div className="marketing-live-pill-item">
              <span>Goal</span>
              <code>Run training and readiness exercises on a believable platform</code>
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-authority-band">
            <article className="marketing-card marketing-authority-copy">
              <p className="marketing-kicker">Why these use cases win</p>
              <h2>The strongest use cases combine operational value, training value, and stronger readiness.</h2>
              <p>
                {productName} works best where teams must detect suspicious behavior early, preserve the incident path,
                and reuse the same environment for exercises, demonstrations, or analyst development.
              </p>
              <ul className="marketing-checklist marketing-checklist-compact">
                {USE_CASE_CHECKLIST.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="marketing-card marketing-authority-list">
              {USE_CASE_AUTHORITY.map((item) => (
                <div key={item.title} className="marketing-authority-item">
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </article>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>Who it serves</p>
            <h2>Common environments where the platform creates the most value</h2>
          </div>
          <div className="marketing-grid-3">
            {USE_CASES.map((item) => (
              <article key={item.title} className="marketing-card marketing-feature">
                <div className="marketing-icon-box">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <p>How it helps people</p>
            <h2>Keep human impact visible alongside the technical workflow</h2>
          </div>
          <div className="marketing-grid-3">
            {PEOPLE_OUTCOMES.map((item) => (
              <article key={item.title} className="marketing-card marketing-feature marketing-impact-card">
                <div className="marketing-impact-head">
                  <div className="marketing-icon-box">{item.icon}</div>
                  <span className="marketing-impact-signal">{item.signal}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <ul className="marketing-impact-list">
                  {item.points.map((point) => (
                    <li key={point}>
                      <CheckCircle2 size={14} />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-split-proof">
            <article className="marketing-card marketing-showcase marketing-proof-copy-card">
              <p className="marketing-kicker">Best fit</p>
              <h3>Most valuable where the team needs both monitoring and readiness.</h3>
              <p>
                The platform works best for environments that need believable surfaces, cleaner analyst output, and a
                workflow that can support both daily review and structured cyber exercises.
              </p>
            </article>
            <article className="marketing-card marketing-list-card">
              <ul className="marketing-list">
                <li className="simple"><span>01</span><strong>Exposed login, admin, or internal-style workflows</strong></li>
                <li className="simple"><span>02</span><strong>Cloud, API, and public-facing service environments</strong></li>
                <li className="simple"><span>03</span><strong>Research, training, and response-ready teams</strong></li>
              </ul>
            </article>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-grid-2 marketing-split-proof">
            <article className="marketing-card marketing-showcase marketing-proof-copy-card">
              <p className="marketing-kicker">Where it deploys</p>
              <h3>Real environments where teams can deploy, monitor, and train.</h3>
              <p>
                Practical value is strongest when people can see exactly where {productName} sits, what it observes,
                and how that helps the team protecting the environment.
              </p>
            </article>
            <article className="marketing-card marketing-list-card marketing-impact-grid">
              {DEPLOYMENT_CONTEXTS.map((item) => (
                <div key={item.title} className="marketing-impact-line">
                  <div className="marketing-icon-box">{item.icon}</div>
                  <div>
                    <div className="marketing-impact-line-head">
                      <strong>{item.title}</strong>
                      <span className="marketing-impact-signal">{item.signal}</span>
                    </div>
                    <p>{item.detail}</p>
                  </div>
                </div>
              ))}
            </article>
          </div>
        </section>

        <section className="marketing-card marketing-cta">
          <div className="marketing-cta-copy">
            <h2>Need help mapping {productName} to your environment?</h2>
            <p>We can align the workflow for your team, service exposure, training goals, and security posture.</p>
          </div>
          <div className="marketing-actions">
            <Link to="/demo" className="marketing-btn marketing-btn-primary" onClick={() => trackCtaClick("request_demo", "/use-cases")}>
              Request Demo
            </Link>
            <Link to="/contact" className="marketing-btn marketing-btn-secondary" onClick={() => trackCtaClick("contact_team", "/use-cases")}>
              Contact Team
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
