import React, { startTransition, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Activity, Menu, Shield, X } from "lucide-react";
import { API_BASE } from "./apiConfig";
import { PUBLIC_SITE, resolvePublicBrandText } from "./siteConfig";
import { trackCtaClick } from "./utils/analytics";
import { buildCampaignAwarePath } from "./utils/campaignLinks";

const CORE_LINKS = [
  { label: "Home", to: "/" },
  { label: "Platform", to: "/platform" },
  { label: "Integrations", to: "/integrations" },
  { label: "Deploy", to: "/deployment" },
  { label: "Use Cases", to: "/use-cases" },
];

const HOME_ANCHOR_LINKS = [
  { label: "Why It Works", href: "#problem" },
  { label: "How It Works", href: "#features" },
  { label: "Telemetry", href: "#telemetry" },
];

function slugify(textValue) {
  return String(textValue || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isActiveRoute(currentPath, targetPath) {
  if (targetPath === "/") {
    return currentPath === "/";
  }
  return currentPath.startsWith(targetPath);
}

export default function PublicHeader({
  variant = "cred",
  pagePath = "/",
  includeHomeAnchors = false,
  brandText = PUBLIC_SITE.brandText || "CYBERSENTINEL",
}) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [liveStatus, setLiveStatus] = useState({
    online: false,
    sessions: 0,
    totalEvents: 0,
  });

  const isHomeVariant = variant === "home";
  const navClass = isHomeVariant ? "home-v2-nav" : "cred-nav";
  const brandClass = isHomeVariant ? "home-v2-brand" : "cred-brand";
  const linksClass = isHomeVariant ? "home-v2-nav-links" : "cred-nav-links";
  const actionsClass = isHomeVariant ? "home-v2-nav-actions" : "cred-nav-actions";
  const ghostBtnClass = isHomeVariant ? "home-v2-btn home-v2-btn-ghost" : "cred-btn cred-btn-ghost";
  const primaryBtnClass = isHomeVariant ? "home-v2-btn home-v2-btn-primary" : "cred-btn cred-btn-primary";

  const links = useMemo(() => {
    if (!includeHomeAnchors) {
      return CORE_LINKS;
    }
    return [...HOME_ANCHOR_LINKS, ...CORE_LINKS.filter((item) => item.to !== "/")];
  }, [includeHomeAnchors]);

  const closeMobile = () => setMobileOpen(false);
  const currentPath = location.pathname || "/";
  const analyticsPath = pagePath || currentPath;
  const resolvedBrandText = resolvePublicBrandText(brandText);
  const toCampaignPath = (path) => buildCampaignAwarePath(path, location.search);

  useEffect(() => {
    if (!PUBLIC_SITE.showStatusPill) {
      return undefined;
    }

    let cancelled = false;
    const loadHealth = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/health`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          throw new Error(`Health request failed: ${res.status}`);
        }
        const payload = await res.json();
        if (cancelled) {
          return;
        }
        const safePayload = payload || {};
        const backendState = String(safePayload?.services?.backend || "").toLowerCase();
        startTransition(() => {
          setLiveStatus({
            online: safePayload?.status === "healthy" || backendState === "operational",
            sessions: Number(safePayload?.metrics?.active_sessions || 0),
            totalEvents: Number(safePayload?.metrics?.total_events || 0),
          });
        });
      } catch {
        if (!cancelled) {
          startTransition(() => {
            setLiveStatus((prev) => ({ ...prev, online: false }));
          });
        }
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") {
        return;
      }
      void loadHealth();
    };

    void loadHealth();
    const interval = setInterval(() => {
      void loadHealth();
    }, 30000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const handleTrackedClick = (label) => {
    trackCtaClick(`nav_${slugify(label)}`, analyticsPath);
    closeMobile();
  };

  return (
    <header className={`${navClass} public-nav-shell`}>
      <div className="public-brand-block">
        <Link to={toCampaignPath("/")} className={brandClass} onClick={() => handleTrackedClick("brand_home")}>
          <span className="public-brand-mark">
            <Shield size={16} />
          </span>
          <span>{resolvedBrandText}</span>
        </Link>
        <small className="public-brand-sub">{PUBLIC_SITE.tagline}</small>
      </div>

      <nav className={linksClass}>
        {links.map((link) => {
          if (link.href) {
            return (
              <a key={link.label} href={link.href} onClick={() => handleTrackedClick(link.label)}>
                {link.label}
              </a>
            );
          }

          return (
              <Link
                key={link.to}
                to={toCampaignPath(link.to)}
                className={isActiveRoute(currentPath, link.to) ? "is-active" : ""}
                onClick={() => handleTrackedClick(link.label)}
              >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {PUBLIC_SITE.showStatusPill ? (
        <div className="public-util-group">
          <div className={`public-live-pill ${liveStatus.online ? "online" : "offline"}`}>
            <Activity size={13} />
            <span>{liveStatus.online ? "Live" : "Offline"}</span>
            <small>{liveStatus.sessions}</small>
          </div>
        </div>
      ) : null}

      <div className={actionsClass}>
        <a href={PUBLIC_SITE.loginUrl} className={ghostBtnClass} onClick={() => handleTrackedClick("login")}>
          Login
        </a>
        <Link to={toCampaignPath("/demo")} className={primaryBtnClass} onClick={() => handleTrackedClick("request_demo")}>
          Request Demo
        </Link>
      </div>

      <button
        type="button"
        className="public-nav-toggle"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((prev) => !prev)}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <div className={`public-nav-mobile ${mobileOpen ? "open" : ""}`}>
        <div className="public-nav-mobile-links">
          {links.map((link) => {
            if (link.href) {
              return (
                <a key={`m-${link.label}`} href={link.href} onClick={() => handleTrackedClick(link.label)}>
                  {link.label}
                </a>
              );
            }

            return (
              <Link
                key={`m-${link.to}`}
                to={toCampaignPath(link.to)}
                className={isActiveRoute(currentPath, link.to) ? "is-active" : ""}
                onClick={() => handleTrackedClick(link.label)}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <div className="public-nav-mobile-actions">
          <Link to={toCampaignPath("/")} className={ghostBtnClass} onClick={() => handleTrackedClick("mobile_home")}>
            Home
          </Link>
          <a href={PUBLIC_SITE.loginUrl} className={ghostBtnClass} onClick={() => handleTrackedClick("login")}>
            Login
          </a>
          <Link to={toCampaignPath("/demo")} className={primaryBtnClass} onClick={() => handleTrackedClick("request_demo")}>
            Request Demo
          </Link>
        </div>
      </div>
    </header>
  );
}
