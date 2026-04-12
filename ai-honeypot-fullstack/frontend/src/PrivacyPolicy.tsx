import React from "react";
import { PUBLIC_SITE, toMailto } from "./siteConfig";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import PublicHeader from "./PublicHeader";
import PublicFooter from "./PublicFooter";

export default function PrivacyPolicy() {
  useSeo({
    title: `Privacy Policy | ${PUBLIC_SITE.siteName}`,
    description: `Privacy policy for ${PUBLIC_SITE.siteName}, lead forms, telemetry handling, and security controls.`,
  });
  usePageAnalytics("privacy_policy");

  return (
    <div className="cred-page">
      <PublicHeader variant="cred" pagePath="/privacy" />
      <main className="cred-main">
        <section className="legal-card">
          <h1>Privacy Policy</h1>
          <p>Last updated: April 10, 2026</p>
          <h2>1. Scope</h2>
          <p>
            This policy explains how {PUBLIC_SITE.companyName} handles personal data when you visit {PUBLIC_SITE.siteName}, request a demo,
            contact the team, or use an authorized deployment of the platform.
          </p>
          <h2>2. Data Categories</h2>
          <p>
            We may process contact details (name, email, organization), support communications, authentication records, and security telemetry that
            operators intentionally collect through approved deployments. We do not permit unlawful monitoring or offensive use.
          </p>
          <h2>3. Why We Use Data</h2>
          <p>
            Data is used to respond to commercial requests, secure accounts, investigate abuse, operate deception workflows, and improve platform
            reliability and analyst experience.
          </p>
          <h2>4. Legal Basis for Processing</h2>
          <p>
            We process personal data based on: (a) your consent for marketing communications, (b) legitimate interest for security telemetry,
            (c) contract performance for service delivery, and (d) legal obligations where applicable.
          </p>
          <h2>5. Data Retention</h2>
          <p>
            Access is role-based and limited to authorized operators. Retention depends on contract, deployment settings, and legal obligations.
            Contact data is retained until you request deletion. Security telemetry retention is configurable by operators (default: 30 days).
          </p>
          <h2>6. Your Rights</h2>
          <p>
            You have the right to: access your personal data, correct inaccurate data, request deletion (where legally permitted), object to processing,
            restrict processing, and data portability. Some requests may be limited by security, audit, or legal obligations.
          </p>
          <h2>7. Cookies</h2>
          <p>
            We use essential cookies for authentication, analytics cookies to improve user experience, and marketing cookies with your consent.
            You can manage cookie preferences through our cookie consent banner.
          </p>
          <h2>8. International Processing</h2>
          <p>
            The platform may use infrastructure or notification providers in multiple regions. When cross-border processing applies, we use
            appropriate safeguards including EU Standard Contractual Clauses where required.
          </p>
          <h2>9. Data Deletion Requests</h2>
          <p>
            You can request deletion of your personal data through our data deletion request endpoint. We will process such requests within
            30 days, subject to legal and security obligations.
          </p>
          <h2>10. Contact</h2>
          <p>
            Privacy requests can be sent to <a href={toMailto(PUBLIC_SITE.privacyEmail)}>{PUBLIC_SITE.privacyEmail}</a>.
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
