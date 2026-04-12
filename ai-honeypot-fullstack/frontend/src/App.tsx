import axios from "axios";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { API_BASE } from "./apiConfig";
import { AUTH_CHANGED_EVENT, clearAuthSession, getUserProfile, setAuthSession } from "./utils/auth";
import Home from "./Home";

const Login = lazy(() => import("./Login"));
const Signup = lazy(() => import("./Signup"));
const ContactDemo = lazy(() => import("./ContactDemo"));
const Platform = lazy(() => import("./Platform"));
const Integrations = lazy(() => import("./Integrations"));
const Deployment = lazy(() => import("./Deployment"));
const Pricing = lazy(() => import("./Pricing"));
const CaseStudy = lazy(() => import("./CaseStudy"));
const Screenshots = lazy(() => import("./Screenshots"));
// const Resources = lazy(() => import("./Resources")); // File not found - commented out
const PublicArchitecture = lazy(() => import("./PublicArchitecture"));
const UseCases = lazy(() => import("./UseCases"));
const PrivacyPolicy = lazy(() => import("./PrivacyPolicy"));
const TermsOfService = lazy(() => import("./TermsOfService"));
const SecurityDisclosure = lazy(() => import("./SecurityDisclosure"));
const AIAssistant = lazy(() => import("./AIAssistant"));
const MainLayout = lazy(() => import("./MainLayout"));
const ProtectedPageOutlet = lazy(() => import("./ProtectedPageOutlet"));
const NotFound = lazy(() => import("./NotFound"));
const CookieConsent = lazy(() => import("./components/CookieConsent"));

type RequireAuthProps = {
  children: ReactNode;
  authChecked: boolean;
  authenticated: boolean;
};

type AppShellProps = {
  authChecked: boolean;
  authenticated: boolean;
  isSsr?: boolean;
};

function RequireAuth({ children, authChecked, authenticated }: RequireAuthProps) {
  if (!authChecked) {
    return <RouteFallback />;
  }
  return authenticated ? children : <Navigate to="/auth/login" replace />;
}

function RouteFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#010409",
        color: "#8b949e",
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "14px",
      }}
    >
      Loading secure module...
    </div>
  );
}

function AppErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#010409",
        color: "#e6edf3",
        fontFamily: "Space Grotesk, sans-serif",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div>
        <div style={{ fontSize: "22px", fontWeight: 700, marginBottom: "10px" }}>Unexpected UI Error</div>
        <div style={{ color: "#8b949e", marginBottom: "16px" }}>
          Reload the page. If this keeps happening, check frontend logs.
        </div>
        <button
          onClick={() => {
            resetErrorBoundary();
            window.location.reload();
          }}
          style={{
            border: "1px solid #30363d",
            background: "#161b22",
            color: "#e6edf3",
            borderRadius: "8px",
            padding: "10px 16px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Reload
        </button>
      </div>
    </div>
  );
}

function RouteLifecycleEffects() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (location.hash) {
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.hash]);

  return null;
}

export function AppShell({ authChecked, authenticated, isSsr = false }: AppShellProps) {
  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback}>
      <Suspense fallback={<RouteFallback />}>
        <RouteLifecycleEffects />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/auth/login"
            element={!authChecked ? <RouteFallback /> : authenticated ? <Navigate to="/dashboard" replace /> : <Login />}
          />
          <Route
            path="/auth/signup"
            element={!authChecked ? <RouteFallback /> : authenticated ? <Navigate to="/dashboard" replace /> : <Signup />}
          />
          <Route
            path="/login"
            element={!authChecked ? <RouteFallback /> : <Navigate to={authenticated ? "/dashboard" : "/auth/login"} replace />}
          />
          <Route
            path="/signup"
            element={!authChecked ? <RouteFallback /> : <Navigate to={authenticated ? "/dashboard" : "/auth/signup"} replace />}
          />
          <Route path="/contact" element={<ContactDemo mode="contact" />} />
          <Route path="/demo" element={<ContactDemo mode="demo" />} />
          <Route path="/platform" element={<Platform />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/deployment" element={<Deployment />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/case-study" element={<CaseStudy />} />
          <Route path="/screenshots" element={<Screenshots />} />
          {/* <Route path="/resources" element={<Resources />} /> */} {/* File not found - commented out */}
          <Route path="/architecture" element={<PublicArchitecture />} />
          <Route path="/use-cases" element={<UseCases />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/security" element={<SecurityDisclosure />} />

          {/* Protected Routes inside MainLayout */}
          <Route
            element={
              <RequireAuth authChecked={authChecked} authenticated={authenticated}>
                <MainLayout />
              </RequireAuth>
            }
          >
            <Route path="/terminal" element={<ProtectedPageOutlet page="terminal" />} />
            <Route path="/dashboard" element={<ProtectedPageOutlet page="dashboard" />} />
            <Route path="/analytics" element={<ProtectedPageOutlet page="analytics" />} />
            <Route path="/telemetry" element={<ProtectedPageOutlet page="telemetry" />} />
            <Route path="/sites" element={<ProtectedPageOutlet page="sites" />} />
            <Route path="/forensics/detail" element={<ProtectedPageOutlet page="forensics" />} />
            <Route path="/intelligence" element={<ProtectedPageOutlet page="intelligence" />} />
            <Route path="/mapping" element={<ProtectedPageOutlet page="mapping" />} />
            <Route path="/profiling" element={<ProtectedPageOutlet page="profiling" />} />
            <Route path="/deception" element={<ProtectedPageOutlet page="deception" />} />
            <Route path="/graph" element={<ProtectedPageOutlet page="graph" />} />
            <Route path="/status" element={<ProtectedPageOutlet page="status" />} />
            <Route path="/simulator" element={<ProtectedPageOutlet page="simulator" />} />
            <Route path="/ai-companion" element={<ProtectedPageOutlet page="ai_companion" />} />
            <Route path="/audit" element={<ProtectedPageOutlet page="audit" />} />
            <Route path="/admin/leads" element={<ProtectedPageOutlet page="admin_leads" />} />
            <Route path="/lab/architecture" element={<ProtectedPageOutlet page="lab_architecture" />} />
            <Route path="/about" element={<ProtectedPageOutlet page="about" />} />
            <Route path="/url-scanner" element={<ProtectedPageOutlet page="url_scanner" />} />
          </Route>
          <Route path="*" element={<NotFound authenticated={authenticated} />} />
        </Routes>
      </Suspense>
      <Suspense fallback={null}>{isSsr ? null : <AIAssistant />}</Suspense>
      <Suspense fallback={null}>{isSsr ? null : <CookieConsent />}</Suspense>
    </ErrorBoundary>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    document.body.classList.add("app-mounted");
    return undefined;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    let active = true;
    const syncLocalAuth = () => {
      if (!active) {
        return;
      }
      setAuthenticated(Boolean(getUserProfile()));
    };
    const syncAuth = async () => {
      try {
        const response = await axios.get(`${API_BASE}/auth/me`, {
          withCredentials: true,
          headers: { "X-Skip-Auth-Redirect": "1" },
        });
        const nextProfile = {
          username: response.data?.username || "operator",
          role: response.data?.role || "analyst",
          email: response.data?.email || null,
        };
        if (!active) {
          return;
        }
        setAuthSession(nextProfile);
        setAuthenticated(true);
      } catch (error) {
        if (!active) {
          return;
        }
        // 401 is expected when user is not logged in - don't log it
        if (error.response?.status !== 401) {
          console.error("Auth sync error:", error);
        }
        clearAuthSession();
        setAuthenticated(false);
      } finally {
        if (active) {
          setAuthChecked(true);
        }
      }
    };

    window.addEventListener(AUTH_CHANGED_EVENT, syncLocalAuth);
    window.addEventListener("storage", syncLocalAuth);
    void syncAuth();

    return () => {
      active = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, syncLocalAuth);
      window.removeEventListener("storage", syncLocalAuth);
    };
  }, []);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppShell authChecked={authChecked} authenticated={authenticated} />
    </Router>
  );
}

export default App;
