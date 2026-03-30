// @ts-nocheck
const GOOGLE_GSI_SCRIPT = "https://accounts.google.com/gsi/client";
let gsiLoadPromise = null;
const preferFedCm = String(import.meta.env.VITE_GOOGLE_USE_FEDCM || "").trim().toLowerCase() === "true";

function ensureWindow() {
  if (typeof window === "undefined") {
    throw new Error("Google authentication is only available in browser runtime.");
  }
}

export function loadGoogleIdentityScript() {
  ensureWindow();
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google);
  }
  if (gsiLoadPromise) {
    return gsiLoadPromise;
  }

  gsiLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_GSI_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google authentication script.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_GSI_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Failed to load Google authentication script."));
    document.head.appendChild(script);
  });

  return gsiLoadPromise;
}

function requestGoogleCredentialWithRenderedButton(clientId) {
  return new Promise((resolve, reject) => {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(1, 4, 9, 0.74)";
    overlay.style.backdropFilter = "blur(4px)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "16px";
    overlay.style.zIndex = "2147483647";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Google sign in");

    const card = document.createElement("div");
    card.style.maxWidth = "360px";
    card.style.width = "100%";
    card.style.background = "#0d1117";
    card.style.border = "1px solid #30363d";
    card.style.borderRadius = "12px";
    card.style.padding = "20px";
    card.style.boxSizing = "border-box";
    card.style.color = "#e6edf3";
    card.style.fontFamily = "'Segoe UI', Arial, sans-serif";

    const heading = document.createElement("div");
    heading.textContent = "Continue with Google";
    heading.style.fontSize = "16px";
    heading.style.fontWeight = "700";
    heading.style.marginBottom = "8px";

    const text = document.createElement("div");
    text.textContent = "Complete sign-in in the popup below. If blocked, sign in to Google in this browser first.";
    text.style.fontSize = "13px";
    text.style.color = "#8b949e";
    text.style.marginBottom = "14px";

    const buttonHost = document.createElement("div");
    buttonHost.style.display = "flex";
    buttonHost.style.justifyContent = "center";
    buttonHost.style.marginBottom = "14px";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    cancelButton.style.width = "100%";
    cancelButton.style.background = "transparent";
    cancelButton.style.border = "1px solid #30363d";
    cancelButton.style.borderRadius = "8px";
    cancelButton.style.color = "#8b949e";
    cancelButton.style.padding = "9px 12px";
    cancelButton.style.cursor = "pointer";

    card.appendChild(heading);
    card.appendChild(text);
    card.appendChild(buttonHost);
    card.appendChild(cancelButton);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    cancelButton.focus();

    let settled = false;
    const timeoutId = window.setTimeout(() => {
      finish(new Error("Google sign-in timed out. Please try again."));
    }, 90000);

    const finish = (error, credential) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      if (error) {
        reject(error);
      } else {
        resolve(credential);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        finish(new Error("Google sign-in was cancelled."));
      }
    };
    window.addEventListener("keydown", onKeyDown);

    cancelButton.addEventListener("click", () => {
      finish(new Error("Google sign-in was cancelled."));
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        finish(new Error("Google sign-in was cancelled."));
      }
    });

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (!response?.credential) {
          finish(new Error("Google sign-in did not return a credential."));
          return;
        }
        finish(null, response.credential);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      context: "signin",
      // FedCM can fail in some local/dev browser setups; keep it opt-in via env.
      use_fedcm_for_prompt: preferFedCm,
      use_fedcm_for_button: preferFedCm,
      itp_support: true,
    });

    // Prompt moment diagnostics helps detect OAuth origin issues early in dev/local setups.
    if (window.google?.accounts?.id?.prompt) {
      window.google.accounts.id.prompt((notification) => {
        if (settled) return;
        const notDisplayedReason = String(notification?.getNotDisplayedReason?.() || "").toLowerCase();
        const skippedReason = String(notification?.getSkippedReason?.() || "").toLowerCase();
        if (notDisplayedReason === "unregistered_origin") {
          finish(
            new Error(
              `Google OAuth origin_mismatch for ${window.location.origin}. Add this origin in Google Cloud Console -> OAuth Client -> Authorized JavaScript origins.`
            )
          );
          return;
        }
        if (notDisplayedReason === "invalid_client") {
          finish(new Error("Google OAuth client ID is invalid or misconfigured."));
          return;
        }
        if (skippedReason === "auto_cancel" || skippedReason === "user_cancel") {
          finish(new Error("Google sign-in was cancelled."));
        }
      });
    }

    window.google.accounts.id.renderButton(buttonHost, {
      type: "standard",
      shape: "rectangular",
      size: "large",
      text: "continue_with",
      theme: "outline",
      width: 260,
    });
  });
}

export async function requestGoogleCredential(clientId) {
  if (!clientId) {
    throw new Error("Google client ID is not configured.");
  }
  await loadGoogleIdentityScript();
  ensureWindow();
  return requestGoogleCredentialWithRenderedButton(clientId);
}
