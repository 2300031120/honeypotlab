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
          <p>Last updated: March 29, 2026</p>
          <h2>Authorized Use</h2>
          <p>
            {PUBLIC_SITE.siteName} is intended for lawful defensive security operations, deception research, incident response support, and approved
            cyber-readiness exercises.
          </p>
          <h2>Customer Responsibilities</h2>
          <p>
            Customers are responsible for access control, deployment isolation, lawful configuration of decoy services, and protection of their own
            users, data, and connected infrastructure.
          </p>
          <h2>Operational Boundaries</h2>
          <p>
            The service must not be used for retaliation, unauthorized access, indiscriminate collection of third-party data, or any activity that
            violates law, contract, or acceptable-use rules of hosting providers.
          </p>
          <h2>Availability and Changes</h2>
          <p>
            We aim to operate the service reliably, but security software may change as threats, dependencies, or infrastructure evolve. Features may
            be updated to preserve safety, resilience, or product quality.
          </p>
          <h2>Third-Party Services</h2>
          <p>
            Some workflows rely on infrastructure, identity, notification, or edge-security providers. Their separate terms and service behavior can
            affect parts of the platform.
          </p>
          <h2>Commercial Terms</h2>
          <p>
            If you have a signed order form, MSA, or statement of work with {PUBLIC_SITE.companyName}, those commercial documents control pricing,
            service levels, and any jurisdiction-specific terms.
          </p>
          <h2>Contact</h2>
          <p>
            Commercial or legal questions can be sent to <a href={toMailto(PUBLIC_SITE.contactEmail)}>{PUBLIC_SITE.contactEmail}</a>.
          </p>
        </section>
        <PublicFooter />
      </main>
    </div>
  );
}
