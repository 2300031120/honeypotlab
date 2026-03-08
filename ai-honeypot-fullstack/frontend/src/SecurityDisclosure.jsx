import React from "react";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import PublicFooter from "./PublicFooter";

export default function SecurityDisclosure() {
  useSeo({
    title: "Security and Responsible Disclosure | CyberSentinel AI",
    description: "Security practices and responsible disclosure process for CyberSentinel AI platform.",
  });
  usePageAnalytics("security_disclosure");

  return (
    <div className="cred-page">
      <header className="cred-nav">
        <Link to="/" className="cred-brand">
          <Shield size={16} />
          CYBERSENTINEL
        </Link>
        <nav className="cred-nav-links">
          <Link to="/">Home</Link>
          <Link to="/platform">Platform</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/contact">Contact</Link>
        </nav>
      </header>
      <main className="cred-main">
        <section className="legal-card">
          <h1>Security and Responsible Disclosure</h1>
          <p>Last updated: March 7, 2026</p>
          <h2>Security Controls</h2>
          <p>The platform uses role-based access control, server-side validation, lead intake protection, and notification idempotency safeguards.</p>
          <h2>Data Isolation</h2>
          <p>Deception environments are designed to remain believable for attackers while controlled for operational safety.</p>
          <h2>Responsible Disclosure</h2>
          <p>If you identify a vulnerability, report it to security@cybersentinel.ai with clear reproduction details.</p>
          <h2>Disclosure Process</h2>
          <p>We acknowledge reports quickly, triage severity, and coordinate remediation updates responsibly.</p>
          <h2>Out of Scope</h2>
          <p>Testing that impacts production stability, privacy, or third-party systems is prohibited without written approval.</p>
        </section>
        <PublicFooter />
      </main>
    </div>
  );
}
