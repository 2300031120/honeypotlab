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
          <p>Last updated: March 29, 2026</p>
          <h2>Scope</h2>
          <p>
            This policy explains how {PUBLIC_SITE.companyName} handles personal data when you visit {PUBLIC_SITE.siteName}, request a demo,
            contact the team, or use an authorized deployment of the platform.
          </p>
          <h2>Data Categories</h2>
          <p>
            We may process contact details, organization details, support communications, authentication records, and security telemetry that
            operators intentionally collect through approved deployments. We do not permit unlawful monitoring or offensive use.
          </p>
          <h2>Why We Use Data</h2>
          <p>
            Data is used to respond to commercial requests, secure accounts, investigate abuse, operate deception workflows, and improve platform
            reliability and analyst experience.
          </p>
          <h2>Retention and Access</h2>
          <p>
            Access is role-based and limited to authorized operators. Retention depends on contract, deployment settings, and legal obligations.
            Customers are responsible for configuring reasonable retention inside their own environments.
          </p>
          <h2>International Processing</h2>
          <p>
            The platform may use infrastructure or notification providers in multiple regions. When cross-border processing applies, we expect
            customers and operators to use appropriate contractual and technical safeguards.
          </p>
          <h2>Your Requests</h2>
          <p>
            Where applicable, you may request access, correction, deletion, or clarification about the personal data we control. Some requests may
            be limited by security, audit, or legal obligations.
          </p>
          <h2>Contact</h2>
          <p>
            Privacy requests can be sent to <a href={toMailto(PUBLIC_SITE.privacyEmail)}>{PUBLIC_SITE.privacyEmail}</a>.
          </p>
        </section>
        <PublicFooter />
      </main>
    </div>
  );
}
