import React from "react";
import { Link } from "react-router-dom";
import { trackCtaClick } from "./utils/analytics";

export default function PublicFooter() {
  const pagePath = typeof window !== "undefined" ? window.location.pathname : "/";
  return (
    <footer className="public-footer">
      <div className="public-footer-main">
        <strong>CyberSentinel AI</strong>
        <span>AI-enhanced dynamic deception platform for modern cyber defense.</span>
      </div>
      <div className="public-footer-links">
        <Link to="/privacy" onClick={() => trackCtaClick("footer_privacy", pagePath)}>Privacy Policy</Link>
        <Link to="/terms" onClick={() => trackCtaClick("footer_terms", pagePath)}>Terms</Link>
        <Link to="/security" onClick={() => trackCtaClick("footer_security", pagePath)}>Security / Disclosure</Link>
        <Link to="/contact" onClick={() => trackCtaClick("footer_contact", pagePath)}>Contact Team</Link>
      </div>
      <div className="public-footer-contact">
        <span>Email: contact@cybersentinel.ai</span>
        <span>Security: security@cybersentinel.ai</span>
        <span>Company: CyberSentinel AI Labs</span>
      </div>
    </footer>
  );
}
