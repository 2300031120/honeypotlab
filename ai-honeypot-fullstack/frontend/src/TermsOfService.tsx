import React from "react";
import { PUBLIC_SITE, toMailto } from "./siteConfig";
import { useSeo } from "./utils/seo";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import PublicHeader from "./PublicHeader";
import PublicFooter from "./PublicFooter";

export default function TermsOfService() {
  useSeo({
    title: `Terms of Service | ${PUBLIC_SITE.siteName}`,
    description: `Terms of service for use of the ${PUBLIC_SITE.siteName} deception-led threat detection platform and related services.`,
  });
  usePageAnalytics("terms_of_service");

  return (
    <div className="cred-page">
      <PublicHeader variant="cred" pagePath="/terms" />
      <main className="cred-main">
        <section className="legal-card">
          <h1>Terms of Service</h1>
          <p>Last updated: April 10, 2026</p>
          <h2>1. Authorized Use</h2>
          <p>
            {PUBLIC_SITE.siteName} is intended for lawful defensive security operations, deception research, incident response support, and approved
            cyber-readiness exercises. Use for offensive operations is strictly prohibited.
          </p>
          <h2>2. Customer Responsibilities</h2>
          <p>
            Customers are responsible for access control, deployment isolation, lawful configuration of decoy services, and protection of their own
            users, data, and connected infrastructure. You must comply with all applicable laws and regulations.
          </p>
          <h2>3. Operational Boundaries</h2>
          <p>
            The service must not be used for retaliation, unauthorized access, indiscriminate collection of third-party data, or any activity that
            violates law, contract, or acceptable-use rules of hosting providers. Offensive cyber operations are prohibited.
          </p>
          <h2>4. Service Availability</h2>
          <p>
            We aim to operate the service reliably, but security software may change as threats, dependencies, or infrastructure evolve. Features may
            be updated to preserve safety, resilience, or product quality. We reserve the right to suspend service for abuse or security reasons.
          </p>
          <h2>5. Third-Party Services</h2>
          <p>
            Some workflows rely on infrastructure, identity, notification, or edge-security providers. Their separate terms and service behavior can
            affect parts of the platform. You are responsible for reviewing third-party terms.
          </p>
          <h2>6. Intellectual Property</h2>
          <p>
            All software, documentation, and branding are owned by {PUBLIC_SITE.companyName}. You may not reverse engineer, copy, or redistribute the platform
            without explicit written permission.
          </p>
          <h2>7. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, {PUBLIC_SITE.companyName} shall not be liable for indirect, incidental, special, consequential, or
            punitive damages arising from use of the service.
          </p>
          <h2>8. Commercial Terms</h2>
          <p>
            If you have a signed order form, MSA, or statement of work with {PUBLIC_SITE.companyName}, those commercial documents control pricing,
            service levels, and any jurisdiction-specific terms.
          </p>
          <h2>9. Termination</h2>
          <p>
            We may terminate your access to the service for violation of these terms, abuse, or security concerns. You may terminate your use at any time
            by providing notice.
          </p>
          <h2>10. Contact</h2>
          <p>
            Commercial or legal questions can be sent to <a href={toMailto(PUBLIC_SITE.contactEmail)}>{PUBLIC_SITE.contactEmail}</a>.
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
