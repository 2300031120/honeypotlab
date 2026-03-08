import React from "react";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import PublicFooter from "./PublicFooter";

export default function TermsOfService() {
  useSeo({
    title: "Terms of Service | CyberSentinel AI",
    description: "Terms of service for use of CyberSentinel AI deception platform and related services.",
  });
  usePageAnalytics("terms_of_service");

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
          <h1>Terms of Service</h1>
          <p>Last updated: March 7, 2026</p>
          <h2>Use of Service</h2>
          <p>The platform is provided for authorized security operations, deception research, and lawful defensive monitoring.</p>
          <h2>Account Responsibility</h2>
          <p>Customers are responsible for account security, access control, and lawful operation of configured decoy environments.</p>
          <h2>Acceptable Use</h2>
          <p>Users must not misuse the service for offensive actions, unauthorized access, or unlawful data collection.</p>
          <h2>Service Availability</h2>
          <p>We aim for reliable service but do not guarantee uninterrupted availability in all environments.</p>
          <h2>Limitation</h2>
          <p>Liability is limited to the maximum extent permitted by law and contract.</p>
        </section>
        <PublicFooter />
      </main>
    </div>
  );
}
