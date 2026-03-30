import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Home, Shield } from "lucide-react";
import { PUBLIC_SITE } from "./siteConfig";
import { useSeo } from "./utils/seo";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

export default function NotFound({ authenticated = false }) {
  useSeo({
    title: `Page Not Found | ${PUBLIC_SITE.siteName}`,
    description: `The page you requested could not be found on ${PUBLIC_SITE.siteName}.`,
    ogTitle: `${PUBLIC_SITE.siteName} | Page Not Found`,
    ogDescription: `Navigate back to live platform pages, deployment guidance, or contact support.`,
  });

  return (
    <div className="marketing-shell">
      <PublicHeader variant="cred" pagePath="/404" />
      <main className="marketing-main">
        <section className="marketing-hero">
          <article className="marketing-card marketing-hero-copy">
            <div className="marketing-badge">
              <AlertTriangle size={14} />
              404 Error
            </div>
            <h1 className="marketing-title">This page is unavailable.</h1>
            <p className="marketing-subtitle">
              The URL might be outdated, moved, or mistyped. Use the links below to continue safely.
            </p>
            <div className="marketing-actions">
              <Link to={authenticated ? "/dashboard" : "/"} className="marketing-btn marketing-btn-primary">
                <Home size={16} />
                {authenticated ? "Open Dashboard" : "Back Home"}
              </Link>
              <Link to="/contact" className="marketing-btn marketing-btn-secondary">
                <Shield size={16} />
                Contact Team
              </Link>
            </div>
          </article>

          <aside className="marketing-card marketing-hero-panel">
            <div className="marketing-panel-head">
              <div>
                <div className="marketing-kicker">Recommended</div>
                <h3>Continue with these pages</h3>
              </div>
            </div>
            <ul className="marketing-list">
              <li>
                <span>1</span>
                <strong>Platform overview and security workflow</strong>
                <Link to="/platform">
                  Open <ArrowRight size={14} />
                </Link>
              </li>
              <li>
                <span>2</span>
                <strong>Deployment readiness and architecture</strong>
                <Link to="/deployment">
                  Open <ArrowRight size={14} />
                </Link>
              </li>
              <li>
                <span>3</span>
                <strong>Book demo or contact security team</strong>
                <Link to="/demo">
                  Open <ArrowRight size={14} />
                </Link>
              </li>
            </ul>
          </aside>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
