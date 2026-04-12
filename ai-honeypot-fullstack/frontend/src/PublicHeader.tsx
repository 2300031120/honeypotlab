import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { PUBLIC_SITE, resolvePublicBrandText } from "./siteConfig";
import { trackCtaClick } from "./utils/analytics";
import { AUTH_CHANGED_EVENT, isAuthenticated } from "./utils/auth";
import { loadAuthProviders } from "./utils/authProviders";
import { buildCampaignAwarePath } from "./utils/campaignLinks";

type MegaMenuEntry = { label: string; to: string; description: string };
type MegaMenuSection = { title: string; items: MegaMenuEntry[] };
type NavLink = {
  label: string;
  to?: string;
  sections?: MegaMenuSection[];
  promo?: {
    eyebrow: string;
    title: string;
    description: string;
    to: string;
    cta: string;
  };
};
type AnchorLink = { label: string; href: string };
type LinkItem = NavLink | AnchorLink;

const CORE_LINKS: NavLink[] = [
  {
    label: "Platform",
    to: "/platform",
    sections: [
      {
        title: "See the product",
        items: [
          { label: "Platform overview", to: "/platform", description: "View decoys, replay, and analyst evidence." },
          { label: "Integrations", to: "/integrations", description: "See Cloudflare, Microsoft 365, Splunk, and API links." },
          { label: "Deployment", to: "/deployment", description: "Review pilot setup, isolation, and rollout." },
        ],
      },
      {
        title: "Trust and design",
        items: [
          { label: "Architecture", to: "/architecture", description: "Understand trap, ingest, and evidence flow." },
          { label: "Security", to: "/security", description: "Read guardrails and disclosure policy." },
          { label: "Sample Incident", to: "/case-study", description: "Open one attack path with proof." },
        ],
      },
    ],
    promo: {
      eyebrow: "Platform",
      title: "See the product first.",
      description: "Start with the overview, then open deployment and proof.",
      to: "/platform",
      cta: "Open platform",
    },
  },
  {
    label: "Start Here",
    sections: [
      {
        title: "Choose your path",
        items: [
          { label: "Use cases", to: "/use-cases", description: "Find the best fit for SaaS, SOC, and MSSP teams." },
          { label: "Pricing", to: "/pricing", description: "Compare pilot, rollout, and MSSP plans." },
          { label: "Request Demo", to: "/demo", description: "Book a live walkthrough." },
        ],
      },
      {
        title: "Talk to the team",
        items: [
          { label: "Contact Team", to: "/contact", description: "Ask about fit, rollout, or buying." },
          { label: "Screenshots", to: "/screenshots", description: "Preview the product before the call." },
        ],
      },
    ],
    promo: {
      eyebrow: "Start here",
      title: "Pick the fastest evaluation path.",
      description: "Use cases, pricing, demo, and contact are all one click away.",
      to: "/use-cases",
      cta: "Start evaluation",
    },
  },
  {
    label: "Proof",
    sections: [
      {
        title: "See proof",
        items: [
          { label: "Sample Incident", to: "/case-study", description: "Follow one route from probe to analyst brief." },
          { label: "Screenshots", to: "/screenshots", description: "Review the UI before the demo." },
          { label: "Integrations", to: "/integrations", description: "Check the systems behind the workflow." },
        ],
      },
      {
        title: "Before rollout",
        items: [
          { label: "Deployment", to: "/deployment", description: "See rollout limits and isolation." },
          { label: "Security", to: "/security", description: "Read trust notes and disclosure policy." },
          { label: "Architecture", to: "/architecture", description: "See how telemetry becomes evidence." },
        ],
      },
    ],
    promo: {
      eyebrow: "Proof",
      title: "Open proof before you buy.",
      description: "Show the incident story, screenshots, and rollout notes.",
      to: "/case-study",
      cta: "Open proof",
    },
  },
];

const HOME_ANCHOR_LINKS: AnchorLink[] = [
  { label: "Proof", href: "#proof" },
  { label: "Why Us", href: "#why-us" },
];

function slugify(textValue?: string | null) {
  return String(textValue || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isActiveRoute(currentPath: string, targetPath: string) {
  if (targetPath === "/") {
    return currentPath === "/";
  }
  return currentPath.startsWith(targetPath);
}

function hasSections(link: LinkItem): link is NavLink & { sections: MegaMenuSection[] } {
  return !("href" in link) && Array.isArray(link.sections) && link.sections.length > 0;
}

function isDirectNavLink(link: LinkItem): link is NavLink & { to: string } {
  return !("href" in link) && typeof link.to === "string" && !Array.isArray(link.sections);
}

function isMegaMenuActive(currentPath: string, link: NavLink) {
  if (link.to && isActiveRoute(currentPath, link.to)) {
    return true;
  }
  return Boolean(link.sections?.some((section) => section.items.some((item) => isActiveRoute(currentPath, item.to))));
}

type PublicHeaderProps = {
  variant?: "cred" | "home";
  pagePath?: string;
  includeHomeAnchors?: boolean;
  brandText?: string;
  showLoginAction?: boolean;
};

export default function PublicHeader({
  variant = "cred",
  pagePath = "/",
  includeHomeAnchors = false,
  brandText = PUBLIC_SITE.brandText || "CYBERSENTIL",
  showLoginAction = true,
}: PublicHeaderProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean>(() => isAuthenticated());
  const [signupEnabled, setSignupEnabled] = useState<boolean>(true);
  const headerRef = useRef<HTMLElement | null>(null);

  const isHomeVariant = variant === "home";
  const navClass = isHomeVariant ? "home-v2-nav" : "cred-nav";
  const brandClass = isHomeVariant ? "home-v2-brand" : "cred-brand";
  const linksClass = isHomeVariant ? "home-v2-nav-links" : "cred-nav-links";
  const actionsClass = isHomeVariant ? "home-v2-nav-actions" : "cred-nav-actions";
  const ghostBtnClass = isHomeVariant ? "home-v2-btn home-v2-btn-ghost" : "cred-btn cred-btn-ghost";
  const primaryBtnClass = isHomeVariant ? "home-v2-btn home-v2-btn-primary" : "cred-btn cred-btn-primary";

  const links = useMemo<LinkItem[]>(() => {
    if (!includeHomeAnchors) {
      return CORE_LINKS;
    }
    return [...HOME_ANCHOR_LINKS, ...CORE_LINKS];
  }, [includeHomeAnchors]);

  const closeAllMenus = () => {
    setOpenMenu(null);
    setMobileOpen(false);
    setMobileMenu(null);
  };
  const closeMobile = () => {
    setMobileOpen(false);
    setMobileMenu(null);
  };
  const currentPath = location.pathname || "/";
  const analyticsPath = pagePath || currentPath;
  const resolvedBrandText = resolvePublicBrandText(brandText);
  const toCampaignPath = (path: string) => buildCampaignAwarePath(path, location.search);
  const loginHref = PUBLIC_SITE.loginUrl.startsWith("/") ? toCampaignPath(PUBLIC_SITE.loginUrl) : PUBLIC_SITE.loginUrl;
  const activeMegaMenu = useMemo(
    () =>
      links.find(
        (link): link is NavLink & { sections: MegaMenuSection[] } => hasSections(link) && link.label === openMenu
      ) ?? null,
    [links, openMenu]
  );
  const primaryAction = authenticated
    ? { label: "Dashboard", to: "/dashboard", tracking: "dashboard" }
    : signupEnabled && pagePath !== "/auth/signup"
      ? { label: "Sign Up", to: "/auth/signup", tracking: "sign_up" }
      : { label: "Request Demo", to: "/demo", tracking: "request_demo" };
  const showLoginLink = showLoginAction && !authenticated;

  useEffect(() => {
    closeAllMenus();
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const syncAuthState = () => {
      setAuthenticated(isAuthenticated());
    };
    syncAuthState();
    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthState);
    window.addEventListener("storage", syncAuthState);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthState);
      window.removeEventListener("storage", syncAuthState);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const fetchProviders = async () => {
      try {
        const providers = await loadAuthProviders();
        if (active) {
          setSignupEnabled(providers.signupEnabled !== false);
        }
      } catch {
        // Keep the public CTA path open if provider discovery is temporarily unavailable.
      }
    };

    void fetchProviders();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!headerRef.current || headerRef.current.contains(event.target as Node)) {
        return;
      }
      closeAllMenus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAllMenus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleTrackedClick = (label: string) => {
    trackCtaClick(`nav_${slugify(label)}`, analyticsPath);
    closeAllMenus();
  };

  return (
    <header ref={headerRef} className={`${navClass} public-nav-shell ${activeMegaMenu ? "has-open-menu" : ""}`} onMouseLeave={() => setOpenMenu(null)}>
      <div className="public-brand-block">
        <Link to={toCampaignPath("/")} className={`${brandClass} public-brand-link`} onClick={() => handleTrackedClick("brand_home")}>
          <span className="public-brand-mark" aria-hidden="true">
            <span className="public-brand-mark-core">CS</span>
          </span>
          <span className="public-brand-copy">
            <span className="public-brand-title">{resolvedBrandText}</span>
            <span className="public-brand-subtitle">Deception Defense Platform</span>
          </span>
        </Link>
        <span className="public-category-pill">AI deception platform</span>
      </div>

      <nav className={linksClass}>
        {links.map((link) => {
          if ("href" in link) {
            return (
              <a key={link.label} href={link.href} onClick={() => handleTrackedClick(link.label)}>
                {link.label}
              </a>
            );
          }

          if (hasSections(link)) {
            const active = isMegaMenuActive(currentPath, link);
            const expanded = openMenu === link.label;
            return (
              <div key={link.label} className="public-nav-item public-nav-item-menu">
                <button
                  type="button"
                  className={`public-nav-trigger ${active ? "is-active-route" : ""} ${expanded ? "is-open" : ""}`}
                  aria-expanded={expanded}
                  onMouseEnter={() => setOpenMenu(link.label)}
                  onFocus={() => setOpenMenu(link.label)}
                  onClick={() => setOpenMenu((prev) => (prev === link.label ? null : link.label))}
                >
                  <span>{link.label}</span>
                  <ChevronDown size={15} />
                </button>
              </div>
            );
          }

          if (isDirectNavLink(link)) {
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
          }

          return null;
        })}
      </nav>

      <div className={actionsClass}>
        {showLoginLink ? (
          <a href={loginHref} className={ghostBtnClass} onClick={() => handleTrackedClick("login")}>
            Login
          </a>
        ) : null}
        <Link to={toCampaignPath(primaryAction.to)} className={primaryBtnClass} onClick={() => handleTrackedClick(primaryAction.tracking)}>
          {primaryAction.label}
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

      {activeMegaMenu ? (
        <div className="public-mega-menu" onMouseEnter={() => setOpenMenu(activeMegaMenu.label)}>
          <div className="public-mega-menu-top">
            <span>{activeMegaMenu.promo?.eyebrow || activeMegaMenu.label}</span>
            <Link to={toCampaignPath(activeMegaMenu.promo?.to || activeMegaMenu.to || "/")} onClick={() => handleTrackedClick(`${activeMegaMenu.label}_promo`)}>
              {activeMegaMenu.promo?.cta || "Open"} <ArrowRight size={15} />
            </Link>
          </div>
          <div className="public-mega-menu-grid">
            {activeMegaMenu.sections?.map((section) => (
              <section key={section.title} className="public-mega-section">
                <span className="public-mega-section-title">{section.title}</span>
                <div className="public-mega-link-list">
                  {section.items.map((item) => (
                    <Link
                      key={item.to}
                      to={toCampaignPath(item.to)}
                      className={`public-mega-link ${isActiveRoute(currentPath, item.to) ? "is-active" : ""}`}
                      onClick={() => handleTrackedClick(`${activeMegaMenu.label}_${item.label}`)}
                    >
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
            {activeMegaMenu.promo ? (
              <aside className="public-mega-promo">
                <span>{activeMegaMenu.promo.eyebrow}</span>
                <strong>{activeMegaMenu.promo.title}</strong>
                <p>{activeMegaMenu.promo.description}</p>
                <Link to={toCampaignPath(activeMegaMenu.promo.to)} onClick={() => handleTrackedClick(`${activeMegaMenu.label}_promo_cta`)}>
                  {activeMegaMenu.promo.cta} <ArrowRight size={15} />
                </Link>
              </aside>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={`public-nav-mobile ${mobileOpen ? "open" : ""}`}>
        <div className="public-nav-mobile-links">
          {links.map((link) => {
            if ("href" in link) {
              return (
                <a key={`m-${link.label}`} href={link.href} onClick={() => handleTrackedClick(link.label)}>
                  {link.label}
                </a>
              );
            }

            if (hasSections(link)) {
              const expanded = mobileMenu === link.label;
              return (
                <div key={`m-${link.label}`} className="public-nav-mobile-group">
                  <button
                    type="button"
                    className={`public-nav-mobile-trigger ${expanded ? "is-open" : ""}`}
                    aria-expanded={expanded}
                    onClick={() => setMobileMenu((prev) => (prev === link.label ? null : link.label))}
                  >
                    <span>{link.label}</span>
                    <ChevronDown size={16} />
                  </button>
                  <div className={`public-nav-mobile-submenu ${expanded ? "open" : ""}`}>
                    {link.sections?.map((section) => (
                      <div key={section.title} className="public-nav-mobile-subsection">
                        <span className="public-nav-mobile-subtitle">{section.title}</span>
                        {section.items.map((item) => (
                          <Link key={item.to} to={toCampaignPath(item.to)} onClick={() => handleTrackedClick(`${link.label}_${item.label}`)}>
                            <strong>{item.label}</strong>
                            <span>{item.description}</span>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (isDirectNavLink(link)) {
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
            }

            return null;
          })}
        </div>
        <div className="public-nav-mobile-actions">
          <Link to={toCampaignPath("/")} className={ghostBtnClass} onClick={() => handleTrackedClick("mobile_home")}>
            Home
          </Link>
          {showLoginLink ? (
            <a href={loginHref} className={ghostBtnClass} onClick={() => handleTrackedClick("login")}>
              Login
            </a>
          ) : null}
          <Link to={toCampaignPath(primaryAction.to)} className={primaryBtnClass} onClick={() => handleTrackedClick(primaryAction.tracking)}>
            {primaryAction.label}
          </Link>
        </div>
      </div>
    </header>
  );
}
