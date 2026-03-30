import React from "react";
import { Link } from "react-router-dom";
import { PUBLIC_SITE, toMailto } from "./siteConfig";
import { trackCtaClick } from "./utils/analytics";

export default function PublicFooter() {
  const pagePath = typeof window !== "undefined" ? window.location.pathname : "/";
  const contactHref = toMailto(PUBLIC_SITE.contactEmail);
  const securityHref = toMailto(PUBLIC_SITE.securityEmail);
  const privacyHref = toMailto(PUBLIC_SITE.privacyEmail);

  return (
    <footer className="public-footer">
      <div className="public-footer-main">
        <div className="public-footer-brand">
          <strong>{PUBLIC_SITE.siteName}</strong>
          <span>{PUBLIC_SITE.siteDescription}</span>
        </div>
        <div className="public-footer-cta">
          <Link to="/demo" onClick={() => trackCtaClick("footer_demo", pagePath)}>Request Demo</Link>
          <Link to="/contact" onClick={() => trackCtaClick("footer_contact_cta", pagePath)}>Talk to Team</Link>
        </div>
      </div>
      <div className="public-footer-links">
        <Link to="/" onClick={() => trackCtaClick("footer_home", pagePath)}>Home</Link>
        <Link to="/platform" onClick={() => trackCtaClick("footer_platform", pagePath)}>Platform</Link>
        <Link to="/integrations" onClick={() => trackCtaClick("footer_integrations", pagePath)}>Integrations</Link>
        <Link to="/deployment" onClick={() => trackCtaClick("footer_deployment", pagePath)}>Deployment</Link>
        <Link to="/pricing" onClick={() => trackCtaClick("footer_pricing", pagePath)}>Plans</Link>
        <Link to="/case-study" onClick={() => trackCtaClick("footer_case_study", pagePath)}>Case Study</Link>
        <Link to="/screenshots" onClick={() => trackCtaClick("footer_screenshots", pagePath)}>Screenshots</Link>
        <Link to="/architecture" onClick={() => trackCtaClick("footer_architecture", pagePath)}>Architecture</Link>
        <Link to="/use-cases" onClick={() => trackCtaClick("footer_use_cases", pagePath)}>Use Cases</Link>
        <Link to="/privacy" onClick={() => trackCtaClick("footer_privacy", pagePath)}>Privacy Policy</Link>
        <Link to="/terms" onClick={() => trackCtaClick("footer_terms", pagePath)}>Terms</Link>
        <Link to="/security" onClick={() => trackCtaClick("footer_security", pagePath)}>Security / Disclosure</Link>
        <Link to="/contact" onClick={() => trackCtaClick("footer_contact", pagePath)}>Contact Team</Link>
      </div>
      <div className="public-footer-contact">
        {PUBLIC_SITE.contactEmail ? <a href={contactHref}>Email: {PUBLIC_SITE.contactEmail}</a> : null}
        {PUBLIC_SITE.securityEmail ? <a href={securityHref}>Security: {PUBLIC_SITE.securityEmail}</a> : null}
        {PUBLIC_SITE.privacyEmail ? <a href={privacyHref}>Privacy: {PUBLIC_SITE.privacyEmail}</a> : null}
        {PUBLIC_SITE.companyName ? <span>Company: {PUBLIC_SITE.companyName}</span> : null}
      </div>
    </footer>
  );
}
