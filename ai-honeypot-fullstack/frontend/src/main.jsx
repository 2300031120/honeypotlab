import React from "react";
import ReactDOM from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import App from "./App.jsx";
import { initAuthTransport } from "./bootstrapAuth";
import "./styles.css";
import "./premiumTheme.css";
import "./homeRefresh.css";
import "./startupRefresh.css";

initAuthTransport();

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

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary FallbackComponent={AppCrashFallback}>
    <App />
  </ErrorBoundary>
);
