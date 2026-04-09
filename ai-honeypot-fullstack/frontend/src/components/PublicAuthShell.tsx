import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import PublicHeader from "../PublicHeader";
import "../public-auth-shell.css";

type ShellAction = {
  label: string;
  to: string;
  variant: "primary" | "secondary";
};

type StoryCard = {
  label: string;
  title: string;
  detail: string;
  icon?: ReactNode;
};

type SidebarMetric = {
  label: string;
  value: string;
};

type SidebarLink = {
  title: string;
  detail: string;
  to: string;
  action: string;
};

type PublicAuthShellProps = {
  pagePath: string;
  showLoginAction?: boolean;
  authLabel: string;
  story: {
    kicker: string;
    signals: string[];
    title: ReactNode;
    description: ReactNode;
    actions: ShellAction[];
    cards: StoryCard[];
  };
  sidebar: {
    primary: {
      kicker: string;
      title: ReactNode;
      items: string[];
      metrics?: SidebarMetric[];
    };
    secondary: {
      kicker: string;
      links: SidebarLink[];
      backLinkLabel: string;
      backLinkTo: string;
    };
  };
  authCard: ReactNode;
  authFooterNote?: ReactNode;
};

export default function PublicAuthShell({
  pagePath,
  showLoginAction = true,
  authLabel,
  story,
  sidebar,
  authCard,
  authFooterNote,
}: PublicAuthShellProps) {
  return (
    <div className="public-auth-page">
      <PublicHeader variant="cred" pagePath={pagePath} showLoginAction={showLoginAction} />
      <main className="public-auth-main">
        <div className="public-auth-shell">
          <div className="public-auth-main-column">
            <section className="public-auth-story-panel">
              <div className="public-auth-kicker">{story.kicker}</div>
              <div className="public-auth-signal-row">
                {story.signals.map((signal) => (
                  <span key={signal}>{signal}</span>
                ))}
              </div>
              <h1>{story.title}</h1>
              <p>{story.description}</p>
              <div className="public-auth-action-row">
                {story.actions.map((action) => (
                  <Link
                    key={`${action.to}-${action.label}`}
                    to={action.to}
                    className={`public-auth-story-btn public-auth-story-btn-${action.variant}`}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
              <div className="public-auth-story-grid">
                {story.cards.map((card) => (
                  <article key={card.title} className="public-auth-story-card">
                    <div className="public-auth-story-card-head">
                      {card.icon}
                      <span>{card.label}</span>
                    </div>
                    <strong>{card.title}</strong>
                    <p>{card.detail}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="public-auth-form-column">
              <div className="public-auth-label">{authLabel}</div>
              {authCard}
              {authFooterNote ? <div className="public-auth-footer-note">{authFooterNote}</div> : null}
            </section>
          </div>

          <aside className="public-auth-side-stack">
            <article className="public-auth-side-panel">
              <div className="public-auth-kicker">{sidebar.primary.kicker}</div>
              <h3>{sidebar.primary.title}</h3>
              <ul>
                {sidebar.primary.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {sidebar.primary.metrics?.length ? (
                <div className="public-auth-side-metrics">
                  {sidebar.primary.metrics.map((metric) => (
                    <div key={metric.label} className="public-auth-side-metric">
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>

            <article className="public-auth-side-panel public-auth-proof-panel">
              <div className="public-auth-kicker">{sidebar.secondary.kicker}</div>
              <div className="public-auth-proof-links">
                {sidebar.secondary.links.map((link) => (
                  <Link key={link.title} to={link.to} className="public-auth-proof-link">
                    <strong>{link.title}</strong>
                    <span>{link.detail}</span>
                    <small>{link.action}</small>
                  </Link>
                ))}
              </div>
              <Link to={sidebar.secondary.backLinkTo} className="public-auth-back-link">
                {sidebar.secondary.backLinkLabel}
              </Link>
            </article>
          </aside>
        </div>
      </main>
    </div>
  );
}
