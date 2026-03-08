import React from "react";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import PublicFooter from "./PublicFooter";

export default function PrivacyPolicy() {
  useSeo({
    title: "Privacy Policy | CyberSentinel AI",
    description: "Privacy policy for CyberSentinel AI platform, lead forms, telemetry handling, and security controls.",
  });
  usePageAnalytics("privacy_policy");

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
          <Link to="/security">Security</Link>
          <Link to="/contact">Contact</Link>
        </nav>
      </header>
      <main className="cred-main">
        <section className="legal-card">
          <h1>Privacy Policy</h1>
          <p>Last updated: March 7, 2026</p>
          <h2>Data We Collect</h2>
          <p>We collect lead form submissions, platform telemetry, and operational events needed for security monitoring and service improvement.</p>
          <h2>How We Use Data</h2>
          <p>Data is used for demo/contact response, attacker behavior analysis, product operations, and abuse prevention.</p>
          <h2>Retention and Access</h2>
          <p>Access is role-based and limited to authorized operators. Retention is controlled by environment and deployment settings.</p>
          <h2>Third-Party Services</h2>
          <p>Notification channels and infrastructure providers may process operational metadata required to deliver service alerts.</p>
          <h2>Contact</h2>
          <p>For privacy requests, contact: privacy@cybersentinel.ai</p>
        </section>
        <PublicFooter />
      </main>
    </div>
  );
}
