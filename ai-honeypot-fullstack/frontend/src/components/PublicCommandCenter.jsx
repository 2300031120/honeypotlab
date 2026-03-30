import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { Activity, Command, Search, Sparkles, X } from "lucide-react";
import { API_BASE } from "../apiConfig";
import { trackCtaClick, trackEvent } from "../utils/analytics";
import { isAuthenticated } from "../utils/auth";
import { loadAuthProviders } from "../utils/authProviders";
import { fetchPublicTelemetrySnapshot } from "../utils/publicTelemetry";

const BASE_ACTIONS = [
  {
    id: "home",
    label: "Open Home",
    description: "Main startup landing page",
    to: "/",
    keywords: "home landing startup",
  },
  {
    id: "platform",
    label: "Open Platform",
    description: "Core capabilities and demo proof",
    to: "/platform",
    keywords: "platform modules dashboard",
  },
  {
    id: "architecture",
    label: "Open Architecture",
    description: "Pipeline and component map",
    to: "/architecture",
    keywords: "architecture flow pipeline",
  },
  {
    id: "use_cases",
    label: "Open Use Cases",
    description: "SOC and enterprise scenarios",
    to: "/use-cases",
    keywords: "use cases soc enterprise",
  },
  {
    id: "demo",
    label: "Request Demo",
    description: "Schedule live product walkthrough",
    to: "/demo",
    keywords: "demo walkthrough meeting",
    ctaLabel: "request_demo",
  },
  {
    id: "contact",
    label: "Contact Team",
    description: "Share your deployment goals",
    to: "/contact",
    keywords: "contact sales support",
    ctaLabel: "contact_team",
  },
  {
    id: "login",
    label: "Login",
    description: "Go to secure portal",
    to: "/auth/login",
    keywords: "login auth account",
  },
  {
    id: "signup",
    label: "Sign Up",
    description: "Create secure access",
    to: "/auth/signup",
    keywords: "signup register account",
  },
];

const HOME_ANCHOR_ACTIONS = [
  {
    id: "problem_anchor",
    label: "Jump to Problem",
    description: "Why static traps fail",
    href: "#problem",
    keywords: "problem section",
  },
  {
    id: "features_anchor",
    label: "Jump to Features",
    description: "Core deception capabilities",
    href: "#features",
    keywords: "features section",
  },
  {
    id: "architecture_anchor",
    label: "Jump to Architecture",
    description: "Attacker to AI pipeline",
    href: "#architecture",
    keywords: "architecture section",
  },
  {
    id: "contact_anchor",
    label: "Jump to Contact",
    description: "Demo and contact CTA",
    href: "#contact",
    keywords: "contact section cta",
  },
];

function formatUptime(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default function PublicCommandCenter({ open, onClose, analyticsPath = "/" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [live, setLive] = useState({
    status: "checking",
    uptime: "--",
    activeSessions: 0,
    totalEvents: 0,
    totalAttacks: null,
    criticalThreats: null,
  });

  const actions = useMemo(() => {
    const baseActions = signupEnabled ? BASE_ACTIONS : BASE_ACTIONS.filter((item) => item.id !== "signup");
    if (location.pathname === "/") {
      return [...HOME_ANCHOR_ACTIONS, ...baseActions];
    }
    return baseActions;
  }, [location.pathname, signupEnabled]);

  const filteredActions = useMemo(() => {
    const searchText = String(query || "").trim().toLowerCase();
    if (!searchText) {
      return actions;
    }
    return actions.filter((item) =>
      `${item.label} ${item.description || ""} ${item.keywords || ""}`.toLowerCase().includes(searchText)
    );
  }, [actions, query]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let cancelled = false;

    const loadAuthAvailability = async () => {
      try {
        const providers = await loadAuthProviders({ skipAuthRedirect: true });
        if (!cancelled) {
          setSignupEnabled(providers.signupEnabled !== false);
        }
      } catch {
        if (!cancelled) {
          setSignupEnabled(true);
        }
      }
    };

    loadAuthAvailability();
    setQuery("");
    setActiveIndex(0);
    trackEvent("command_center_open", {
      category: "engagement",
      pagePath: analyticsPath,
      properties: { current_path: location.pathname || "/" },
    });
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 30);
    return () => {
      cancelled = true;
      clearTimeout(focusTimer);
    };
  }, [open, analyticsPath, location.pathname]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let cancelled = false;

    const loadLiveStatus = async () => {
      try {
        const authenticated = isAuthenticated();
        const [healthResult, statsResult] = await Promise.allSettled([
          axios.get(`${API_BASE}/health`, { skipAuthRedirect: true }),
          authenticated
            ? axios.get(`${API_BASE}/dashboard/stats`, {
                params: { include_training: false },
                skipAuthRedirect: true,
              })
            : fetchPublicTelemetrySnapshot(),
        ]);

        if (cancelled) {
          return;
        }

        let nextState = {
          status: "offline",
          uptime: "--",
          activeSessions: 0,
          totalEvents: 0,
          totalAttacks: null,
          criticalThreats: null,
        };

        if (healthResult.status === "fulfilled") {
          const payload = healthResult.value?.data || {};
          const backendState = String(payload?.services?.backend || "").toLowerCase();
          nextState = {
            ...nextState,
            status: payload?.status === "healthy" || backendState === "operational" ? "online" : "degraded",
            uptime: formatUptime(payload?.uptime_seconds),
            activeSessions: Number(payload?.metrics?.active_sessions || 0),
            totalEvents: Number(payload?.metrics?.total_events || 0),
          };
        }

        if (statsResult.status === "fulfilled") {
          const statsPayload = authenticated ? statsResult.value?.data || {} : statsResult.value || {};
          nextState = {
            ...nextState,
            totalAttacks: Number(statsPayload?.summary?.total ?? statsPayload?.summary?.total_events ?? 0),
            criticalThreats: Number(statsPayload?.summary?.critical ?? statsPayload?.summary?.critical_events ?? 0),
          };
        }

        setLive(nextState);
      } catch {
        if (!cancelled) {
          setLive((prev) => ({ ...prev, status: "offline" }));
        }
      }
    };

    loadLiveStatus();
    const interval = setInterval(loadLiveStatus, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, Math.max(0, filteredActions.length - 1)));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        const target = filteredActions[activeIndex];
        if (target) {
          event.preventDefault();
          handleAction(target);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, filteredActions, activeIndex]);

  const handleAction = (item) => {
    const targetPath = item.href ? `/${item.href}` : item.to || "/";
    trackEvent("command_center_select", {
      category: "engagement",
      pagePath: analyticsPath,
      properties: { action_id: item.id, target: targetPath },
    });
    if (item.ctaLabel) {
      trackCtaClick(item.ctaLabel, analyticsPath);
    }

    if (item.href) {
      if (location.pathname !== "/") {
        navigate(`/${item.href}`);
      } else {
        const element = document.querySelector(item.href);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          window.location.hash = item.href;
        }
      }
      onClose();
      return;
    }

    navigate(item.to || "/");
    onClose();
  };

  if (!open) {
    return null;
  }

  return (
    <div className="command-center-backdrop" role="presentation" onClick={onClose}>
      <section
        className="command-center-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Command center"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="command-center-head">
          <div>
            <p>Command Center</p>
            <h3>
              <Sparkles size={15} />
              Startup Navigation + Live Ops
            </h3>
          </div>
          <button type="button" className="command-center-close" onClick={onClose} aria-label="Close command center">
            <X size={16} />
          </button>
        </header>

        <div className="command-center-live">
          <div className={`command-live-status ${live.status}`}>
            <Activity size={14} />
            <span>{live.status === "online" ? "Backend Online" : live.status === "degraded" ? "Degraded" : "Offline"}</span>
          </div>
          <div className="command-live-metric">
            <small>Uptime</small>
            <strong>{live.uptime}</strong>
          </div>
          <div className="command-live-metric">
            <small>Sessions</small>
            <strong>{live.activeSessions}</strong>
          </div>
          <div className="command-live-metric">
            <small>Events</small>
            <strong>{live.totalEvents}</strong>
          </div>
          <div className="command-live-metric">
            <small>Attacks</small>
            <strong>{live.totalAttacks ?? "--"}</strong>
          </div>
          <div className="command-live-metric">
            <small>Critical</small>
            <strong>{live.criticalThreats ?? "--"}</strong>
          </div>
        </div>

        <label className="command-center-search">
          <Search size={15} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages and actions..."
            aria-label="Search command center"
          />
          <kbd>Enter</kbd>
        </label>

        <div className="command-center-results" role="listbox" aria-label="Command results">
          {filteredActions.length === 0 ? (
            <div className="command-center-empty">No matches. Try keywords like demo, platform, or contact.</div>
          ) : (
            filteredActions.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`command-center-item ${index === activeIndex ? "active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => handleAction(item)}
              >
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </div>
                <kbd>{index + 1}</kbd>
              </button>
            ))
          )}
        </div>

        <footer className="command-center-foot">
          <span>
            <Command size={13} /> Ctrl/Cmd + K
          </span>
          <span>Esc to close</span>
        </footer>
      </section>
    </div>
  );
}
