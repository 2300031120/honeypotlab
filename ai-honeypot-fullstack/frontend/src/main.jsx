import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import App from "./App.jsx";
import "./public-remake.css";

function toErrorMessage(value) {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return value.message || String(value);
  }
  if (typeof value === "object" && "message" in value && typeof value.message === "string") {
    return value.message;
  }
  return String(value);
}

function isHydrationMismatchError(value) {
  const message = toErrorMessage(value);
  if (!message) {
    return false;
  }
  return (
    message.includes("Minified React error #418") ||
    message.includes("Minified React error #423") ||
    message.toLowerCase().includes("hydration failed")
  );
}

async function clearStaleRuntimeCaches() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return;
  }

  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((registration) => registration.unregister()));
    } catch {
      // Ignore service worker failures.
    }
  }

  if ("caches" in window) {
    try {
      const names = await caches.keys();
      await Promise.allSettled(names.map((name) => caches.delete(name)));
    } catch {
      // Ignore cache API failures.
    }
  }
}

function installHydrationRecoveryGuard() {
  if (typeof window === "undefined") {
    return;
  }

  const recoveryKey = "__frontend_hydration_recovered_v1__";

  const recoverOnce = async () => {
    let recoveredAlready = false;
    try {
      recoveredAlready = window.sessionStorage?.getItem(recoveryKey) === "1";
    } catch {
      recoveredAlready = false;
    }

    if (recoveredAlready) {
      return;
    }

    try {
      window.sessionStorage?.setItem(recoveryKey, "1");
    } catch {
      // Ignore storage failures.
    }

    await clearStaleRuntimeCaches();
    const next = new URL(window.location.href);
    next.searchParams.set("reload", Date.now().toString(36));
    window.location.replace(next.toString());
  };

  window.addEventListener("error", (event) => {
    if (isHydrationMismatchError(event?.error || event?.message)) {
      void recoverOnce();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (isHydrationMismatchError(event?.reason)) {
      void recoverOnce();
    }
  });
}

function bootstrapAuthTransport() {
  void import("./bootstrapAuth")
    .then(({ initAuthTransport }) => {
      initAuthTransport();
    })
    .catch(() => {
      // Keep public routes booting even if transport bootstrap fails.
    });
}

if (typeof window !== "undefined") {
  installHydrationRecoveryGuard();

  let hasStoredToken = false;
  try {
    hasStoredToken = Boolean(localStorage.getItem("token"));
  } catch {
    hasStoredToken = false;
  }

  if (hasStoredToken) {
    bootstrapAuthTransport();
  } else if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(bootstrapAuthTransport, { timeout: 2500 });
  } else {
    window.setTimeout(bootstrapAuthTransport, 1200);
  }
}

function AppCrashFallback({ error }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#010409",
        color: "#e6edf3",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Space Grotesk, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "720px",
          width: "100%",
          border: "1px solid #30363d",
          borderRadius: "12px",
          background: "rgba(13,17,23,0.95)",
          padding: "20px",
        }}
      >
        <h1 style={{ fontSize: "20px", marginBottom: "10px" }}>Frontend runtime error</h1>
        <p style={{ color: "#8b949e", marginBottom: "12px" }}>
          The app failed to render. Reload once, and if it repeats share this message.
        </p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontSize: "12px",
            lineHeight: 1.5,
            color: "#f85149",
            margin: 0,
          }}
        >
          {error?.message || "Unknown error"}
        </pre>
      </div>
    </div>
  );
}

const app = (
  <ErrorBoundary FallbackComponent={AppCrashFallback}>
    <App />
  </ErrorBoundary>
);

const rootEl = document.getElementById("root");
if (rootEl) {
  const hasServerMarkup = rootEl.hasChildNodes() && String(rootEl.innerHTML || "").trim().length > 0;
  if (hasServerMarkup) {
    try {
      hydrateRoot(rootEl, app);
    } catch {
      rootEl.textContent = "";
      createRoot(rootEl).render(app);
    }
  } else {
    createRoot(rootEl).render(app);
  }
}
