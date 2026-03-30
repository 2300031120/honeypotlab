import React from "react";
import { PUBLIC_SITE, toMailto } from "./siteConfig";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import PublicHeader from "./PublicHeader";
import PublicFooter from "./PublicFooter";

export default function SecurityDisclosure() {
  useSeo({
    title: `Security and Responsible Disclosure | ${PUBLIC_SITE.siteName}`,
    description: `Security practices and responsible disclosure process for ${PUBLIC_SITE.siteName}.`,
  });
  usePageAnalytics("security_disclosure");

  return (
    <div className="cred-page">
      <PublicHeader variant="cred" pagePath="/security" />
      <main className="cred-main">
        <section className="legal-card">
          <h1>Security and Responsible Disclosure</h1>
          <p>Last updated: March 29, 2026</p>
          <h2>How to Report</h2>
          <p>
            Send vulnerability reports to <a href={toMailto(PUBLIC_SITE.securityEmail)}>{PUBLIC_SITE.securityEmail}</a> with affected asset,
            impact summary, reproduction steps, and any supporting logs or screenshots.
          </p>
          <h2>Safe Handling</h2>
          <p>
            We ask researchers to avoid privacy impact, service disruption, persistence, lateral movement, or data exfiltration. Good-faith reports
            that respect these limits help us triage quickly and responsibly.
          </p>
          <h2>Response Targets</h2>
          <p>
            We aim to acknowledge valid reports promptly, assess severity, and coordinate remediation updates with reasonable transparency based on
            risk and operational safety.
          </p>
          <h2>Platform Controls</h2>
          <p>
            The platform uses authenticated operator workflows, server-side validation, rate limiting, lead-intake protections, and deployment
            isolation guidance to reduce exposure.
          </p>
          <h2>Out of Scope</h2>
          <p>
            Testing that degrades availability, touches customer data without authorization, targets third-party infrastructure, or bypasses written
            approval is out of scope.
          </p>
          <h2>No Offensive Use</h2>
          <p>
            {PUBLIC_SITE.siteName} is built for deception-led defense. We do not authorize use of the platform for retaliation, attack-back behavior,
            or unlawful collection.
          </p>
        </section>
        <PublicFooter />
      </main>
    </div>
  );
}
