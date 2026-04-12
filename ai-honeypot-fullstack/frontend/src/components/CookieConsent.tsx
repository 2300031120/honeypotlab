import React, { useEffect, useState } from "react";

const COOKIE_CONSENT_KEY = "cybersentil_cookie_consent";

type ConsentType = "essential" | "analytics" | "marketing";

interface ConsentState {
  accepted: boolean;
  preferences: Record<ConsentType, boolean>;
}

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [consent, setConsent] = useState<ConsentState>({
    accepted: false,
    preferences: {
      essential: true,
      analytics: false,
      marketing: false,
    },
  });

  useEffect(() => {
    // Check if user has already made a consent choice
    const savedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (savedConsent) {
      try {
        const parsed = JSON.parse(savedConsent);
        setConsent(parsed);
      } catch {
        // Invalid data, show banner
        setIsVisible(true);
      }
    } else {
      // No consent saved, show banner
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const newConsent: ConsentState = {
      accepted: true,
      preferences: {
        essential: true,
        analytics: true,
        marketing: true,
      },
    };
    setConsent(newConsent);
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(newConsent));
    setIsVisible(false);
  };

  const handleRejectNonEssential = () => {
    const newConsent: ConsentState = {
      accepted: true,
      preferences: {
        essential: true,
        analytics: false,
        marketing: false,
      },
    };
    setConsent(newConsent);
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(newConsent));
    setIsVisible(false);
  };

  const handleSavePreferences = () => {
    const newConsent: ConsentState = {
      accepted: true,
      preferences: consent.preferences,
    };
    setConsent(newConsent);
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(newConsent));
    setIsVisible(false);
    setShowSettings(false);
  };

  const handleTogglePreference = (type: ConsentType) => {
    if (type === "essential") return; // Essential cookies cannot be disabled
    setConsent({
      ...consent,
      preferences: {
        ...consent.preferences,
        [type]: !consent.preferences[type],
      },
    });
  };

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "0",
        left: "0",
        right: "0",
        backgroundColor: "#010409",
        borderTop: "1px solid #30363d",
        padding: "20px",
        zIndex: 9999,
        fontFamily: "Space Grotesk, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {!showSettings ? (
          <>
            <div style={{ color: "#e6edf3" }}>
              <strong style={{ display: "block", marginBottom: "8px", fontSize: "16px" }}>
                Cookie Consent
              </strong>
              <p style={{ margin: 0, fontSize: "14px", color: "#8b949e", lineHeight: "1.5" }}>
                We use cookies to enhance your experience. By continuing to visit this site you agree to our use of cookies.{" "}
                <a href="/privacy" style={{ color: "#58a6ff", textDecoration: "none" }}>
                  Learn more
                </a>
              </p>
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                onClick={handleAcceptAll}
                style={{
                  backgroundColor: "#238636",
                  color: "#ffffff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                Accept All
              </button>
              <button
                onClick={handleRejectNonEssential}
                style={{
                  backgroundColor: "#161b22",
                  color: "#e6edf3",
                  border: "1px solid #30363d",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                Reject Non-Essential
              </button>
              <button
                onClick={() => setShowSettings(true)}
                style={{
                  backgroundColor: "transparent",
                  color: "#8b949e",
                  border: "1px solid #30363d",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                Customize
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ color: "#e6ed3" }}>
              <strong style={{ display: "block", marginBottom: "8px", fontSize: "16px" }}>
                Customize Cookie Preferences
              </strong>
              <p style={{ margin: 0, fontSize: "14px", color: "#8b949e", lineHeight: "1.5" }}>
                Choose which cookies you allow us to use.
              </p>
            </div>
            <div
              style={{
                backgroundColor: "#161b22",
                border: "1px solid #30363d",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  { key: "essential" as ConsentType, label: "Essential Cookies", description: "Required for the site to function" },
                  { key: "analytics" as ConsentType, label: "Analytics Cookies", description: "Help us improve the site" },
                  { key: "marketing" as ConsentType, label: "Marketing Cookies", description: "Used for advertising purposes" },
                ].map((cookie) => (
                  <div
                    key={cookie.key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: "1px solid #30363d",
                    }}
                  >
                    <div>
                      <div style={{ color: "#e6edf3", fontWeight: 600, fontSize: "14px" }}>
                        {cookie.label}
                      </div>
                      <div style={{ color: "#8b949e", fontSize: "12px" }}>{cookie.description}</div>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={consent.preferences[cookie.key]}
                        onChange={() => handleTogglePreference(cookie.key)}
                        disabled={cookie.key === "essential"}
                        style={{
                          width: "18px",
                          height: "18px",
                          cursor: cookie.key === "essential" ? "not-allowed" : "pointer",
                        }}
                      />
                      <span style={{ color: "#e6edf3", fontSize: "14px" }}>
                        {consent.preferences[cookie.key] ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                onClick={handleSavePreferences}
                style={{
                  backgroundColor: "#238636",
                  color: "#ffffff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                Save Preferences
              </button>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  backgroundColor: "transparent",
                  color: "#8b949e",
                  border: "1px solid #30363d",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
