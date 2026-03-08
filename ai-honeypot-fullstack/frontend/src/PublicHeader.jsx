import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useLocation } from "react-router-dom";
import { Activity, Command, Menu, Shield, Sparkles, X } from "lucide-react";
import { API_BASE } from "./apiConfig";
import { trackCtaClick, trackEvent } from "./utils/analytics";
import PublicCommandCenter from "./components/PublicCommandCenter";

const CORE_LINKS = [
  { label: "Home", to: "/" },
  { label: "Platform", to: "/platform" },
  { label: "Architecture", to: "/architecture" },
  { label: "Use Cases", to: "/use-cases" },
  { label: "Demo", to: "/demo" },
  { label: "Contact", to: "/contact" },
];

const HOME_ANCHOR_LINKS = [
  { label: "Problem", href: "#problem" },
  { label: "Features", href: "#features" },
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
  brandText = "CYBERSENTINEL",
}) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [uiMode, setUiMode] = useState(() => {
    try {
      return localStorage.getItem("public_ui_mode") || "startup";
    } catch {
      return "startup";
    }
  });
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

  useEffect(() => {
    const mode = uiMode === "futuristic" ? "futuristic" : "startup";
    document.documentElement.setAttribute("data-public-mode", mode);
    try {
      localStorage.setItem("public_ui_mode", mode);
    } catch {
      // Ignore local storage write failures.
    }
  }, [uiMode]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const isShortcut = (event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "k";
      if (!isShortcut) {
        return;
      }
      event.preventDefault();
      setCommandOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadHealth = async () => {
      try {
        const res = await axios.get(`${API_BASE}/health`, { skipAuthRedirect: true });
        if (cancelled) {
          return;
        }
        const payload = res.data || {};
        const backendState = String(payload?.services?.backend || "").toLowerCase();
        setLiveStatus({
          online: payload?.status === "healthy" || backendState === "operational",
          sessions: Number(payload?.metrics?.active_sessions || 0),
          totalEvents: Number(payload?.metrics?.total_events || 0),
        });
      } catch {
        if (!cancelled) {
          setLiveStatus((prev) => ({ ...prev, online: false }));
        }
      }
    };

    loadHealth();
    const interval = setInterval(loadHealth, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleTrackedClick = (label) => {
    trackCtaClick(`nav_${slugify(label)}`, analyticsPath);
    closeMobile();
  };

  const toggleUiMode = () => {
    setUiMode((prev) => {
      const next = prev === "futuristic" ? "startup" : "futuristic";
      trackEvent("ui_mode_toggle", {
        category: "engagement",
        pagePath: analyticsPath,
        properties: { mode: next },
      });
      return next;
    });
  };

  const openCommandCenter = () => {
    setCommandOpen(true);
    closeMobile();
  };

  return (
    <>
      <header className={`${navClass} public-nav-shell`}>
        <Link
          to="/"
          className={brandClass}
          onClick={() => handleTrackedClick("brand_home")}
        >
          <Shield size={16} />
          <span>{brandText}</span>
        </Link>

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
                to={link.to}
                className={isActiveRoute(currentPath, link.to) ? "is-active" : ""}
                onClick={() => handleTrackedClick(link.label)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="public-util-group">
          <button type="button" className="public-util-btn" onClick={openCommandCenter} aria-label="Open command center">
            <Command size={14} />
            <span>Command</span>
          </button>
          <button type="button" className="public-util-btn" onClick={toggleUiMode} aria-label="Toggle futuristic mode">
            <Sparkles size={14} />
            <span>{uiMode === "futuristic" ? "Startup" : "Futuristic"}</span>
          </button>
          <button type="button" className={`public-live-pill ${liveStatus.online ? "online" : "offline"}`} onClick={openCommandCenter}>
            <Activity size={13} />
            <span>{liveStatus.online ? "LIVE" : "OFFLINE"}</span>
            <small>{liveStatus.sessions}</small>
          </button>
        </div>

        <div className={actionsClass}>
          <Link to="/auth/login" className={ghostBtnClass} onClick={() => handleTrackedClick("login")}>
            Login
          </Link>
          <Link to="/auth/signup" className={primaryBtnClass} onClick={() => handleTrackedClick("sign_up")}>
            Sign Up
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
                  to={link.to}
                  className={isActiveRoute(currentPath, link.to) ? "is-active" : ""}
                  onClick={() => handleTrackedClick(link.label)}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
          <div className="public-nav-mobile-actions">
            <button type="button" className="public-mobile-meta-btn" onClick={openCommandCenter}>
              <Command size={14} />
              Open Command Center
            </button>
            <button type="button" className="public-mobile-meta-btn" onClick={toggleUiMode}>
              <Sparkles size={14} />
              {uiMode === "futuristic" ? "Switch to Startup Mode" : "Switch to Futuristic Mode"}
            </button>
            <Link to="/demo" className={ghostBtnClass} onClick={() => handleTrackedClick("request_demo")}>
              Request Demo
            </Link>
            <Link to="/auth/login" className={ghostBtnClass} onClick={() => handleTrackedClick("login")}>
              Login
            </Link>
            <Link to="/auth/signup" className={primaryBtnClass} onClick={() => handleTrackedClick("sign_up")}>
              Sign Up
            </Link>
          </div>
        </div>
      </header>
      <PublicCommandCenter open={commandOpen} onClose={() => setCommandOpen(false)} analyticsPath={analyticsPath} />
    </>
  );
}
