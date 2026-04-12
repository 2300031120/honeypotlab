import React from "react";
import { Link, useLocation } from "react-router-dom";
import { PUBLIC_SITE, toMailto } from "./siteConfig";
import { trackCtaClick } from "./utils/analytics";
import { buildCampaignAwarePath } from "./utils/campaignLinks";

export default function PublicFooter() {
  const location = useLocation();
  const pagePath = location.pathname || "/";
  const toCampaignPath = (path: string) => buildCampaignAwarePath(path, location.search);
  const contactHref = toMailto(PUBLIC_SITE.contactEmail);
  const securityHref = toMailto(PUBLIC_SITE.securityEmail);
  const privacyHref = toMailto(PUBLIC_SITE.privacyEmail);

  return (
    <footer className="public-footer">
      <div className="public-footer-main">
        <div className="public-footer-brand">
          <strong>{PUBLIC_SITE.siteName}</strong>
          <span>AI-enhanced deception for exposed login, admin, and API routes, with operational proof teams can validate before a rollout.</span>
        </div>
        <div className="public-footer-cta">
          <Link to={toCampaignPath("/case-study")} onClick={() => trackCtaClick("footer_case_study_cta", pagePath)}>Sample Incident</Link>
          <Link to={toCampaignPath("/integrations")} onClick={() => trackCtaClick("footer_integrations_cta", pagePath)}>Integrations</Link>
          <Link to={toCampaignPath("/pricing")} onClick={() => trackCtaClick("footer_pricing_cta", pagePath)}>Pricing</Link>
          <Link to={toCampaignPath("/demo")} onClick={() => trackCtaClick("footer_demo", pagePath)}>Request Demo</Link>
        </div>
      </div>
      <div className="public-footer-grid">
        <div className="public-footer-column">
          <span className="public-footer-label">Evaluate</span>
          <Link to={toCampaignPath("/case-study")} onClick={() => trackCtaClick("footer_case_study", pagePath)}>Sample Incident</Link>
          <Link to={toCampaignPath("/screenshots")} onClick={() => trackCtaClick("footer_screenshots", pagePath)}>Screenshots</Link>
          <Link to={toCampaignPath("/pricing")} onClick={() => trackCtaClick("footer_pricing", pagePath)}>Pricing</Link>
          <Link to={toCampaignPath("/demo")} onClick={() => trackCtaClick("footer_demo_start", pagePath)}>Request Demo</Link>
        </div>
        <div className="public-footer-column">
          <span className="public-footer-label">Product</span>
          <Link to={toCampaignPath("/platform")} onClick={() => trackCtaClick("footer_platform", pagePath)}>Platform</Link>
          <Link to={toCampaignPath("/integrations")} onClick={() => trackCtaClick("footer_integrations", pagePath)}>Integrations</Link>
          <Link to={toCampaignPath("/security")} onClick={() => trackCtaClick("footer_security", pagePath)}>Security</Link>
        </div>
        <div className="public-footer-column">
          <span className="public-footer-label">Company</span>
          <Link to={toCampaignPath("/contact")} onClick={() => trackCtaClick("footer_contact", pagePath)}>Contact Team</Link>
          <Link to={toCampaignPath("/privacy")} onClick={() => trackCtaClick("footer_privacy", pagePath)}>Privacy Policy</Link>
          <Link to={toCampaignPath("/terms")} onClick={() => trackCtaClick("footer_terms", pagePath)}>Terms</Link>
          <a href="/sample-incident-report.md" download onClick={() => trackCtaClick("footer_sample_report", pagePath)}>Sample Report</a>
          <div className="public-footer-note">
            <strong>Startup-ready positioning, not generic cyber noise.</strong>
            <span>Believable exposed-route traps, readable evidence, and one clear pilot path for real buyer conversations.</span>
          </div>
        </div>
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
