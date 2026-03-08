import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, FlaskConical, GraduationCap, ShieldCheck, Cloud } from "lucide-react";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { trackCtaClick } from "./utils/analytics";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

const USE_CASES = [
  {
    title: "SOC Teams",
    detail: "Prioritize live attacker sessions, reduce triage noise, and get AI-generated incident narratives faster.",
    icon: <ShieldCheck size={18} />,
  },
  {
    title: "Enterprise Security",
    detail: "Deploy adaptive decoys across admin surfaces and internal-style portals to detect early intrusion stages.",
    icon: <Building2 size={18} />,
  },
  {
    title: "Research Labs",
    detail: "Run controlled high-interaction deception experiments and map attacker behavior progression.",
    icon: <FlaskConical size={18} />,
  },
  {
    title: "Cloud Security Teams",
    detail: "Simulate cloud console and API decoys to detect credential abuse and reconnaissance targeting cloud assets.",
    icon: <Cloud size={18} />,
  },
  {
    title: "Security Training Programs",
    detail: "Use realistic decoy journeys to train analysts on attacker patterns and response playbooks.",
    icon: <GraduationCap size={18} />,
  },
];

export default function UseCases() {
  usePageAnalytics("use_cases");
  useSeo({
    title: "Use Cases | CyberSentinel AI Dynamic Deception Platform",
    description:
      "Explore CyberSentinel AI use cases for SOC teams, enterprise security, research labs, and cloud defense programs.",
    ogTitle: "CyberSentinel AI Use Cases",
    ogDescription:
      "AI-enhanced dynamic deception platform use cases for SOC operations, enterprise environments, and security research.",
  });

  return (
    <div className="cred-page use-cases-page">
      <div className="cred-ambient cred-ambient-a" />
      <div className="cred-ambient cred-ambient-b" />

      <PublicHeader variant="cred" pagePath="/use-cases" />

      <main className="cred-main">
        <section className="cred-hero">
          <p className="cred-badge">AI-Enhanced Dynamic Deception Platform</p>
          <h1>Use Cases for Modern Cyber Defense Teams</h1>
          <p className="cred-subtitle">
            Adaptive deception for modern cyber defense across SOC operations, enterprise environments, cloud targets,
            research labs, and analyst training workflows.
          </p>
          <div className="cred-actions">
            <Link to="/demo" className="cred-btn cred-btn-primary" onClick={() => trackCtaClick("request_demo", "/use-cases")}>
              Request Demo <ArrowRight size={15} />
            </Link>
            <Link to="/platform" className="cred-btn cred-btn-ghost" onClick={() => trackCtaClick("explore_platform", "/use-cases")}>
              Explore Platform
            </Link>
            <Link to="/contact" className="cred-btn cred-btn-ghost" onClick={() => trackCtaClick("contact_team", "/use-cases")}>
              Contact Team
            </Link>
          </div>
        </section>

        <section className="cred-section">
          <div className="cred-section-head">
            <p>Target environments</p>
            <h2>Where this platform delivers immediate value</h2>
          </div>
          <div className="use-cases-grid">
            {USE_CASES.map((item) => (
              <article key={item.title} className="use-case-card">
                <div className="use-case-icon">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cred-card cred-cta">
          <div>
            <p>Ready to map your use case?</p>
            <h2>Turn deception telemetry into practical operator workflows</h2>
            <span>Get a guided walkthrough tailored to your environment and threat model.</span>
          </div>
          <div className="cred-actions">
            <Link to="/demo" className="cred-btn cred-btn-primary" onClick={() => trackCtaClick("request_demo", "/use-cases")}>
              Request Demo
            </Link>
            <Link to="/platform" className="cred-btn cred-btn-ghost" onClick={() => trackCtaClick("explore_platform", "/use-cases")}>
              Explore Platform
            </Link>
            <Link to="/contact" className="cred-btn cred-btn-ghost" onClick={() => trackCtaClick("contact_team", "/use-cases")}>
              Contact Team
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
