import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { AUTH_CHANGED_EVENT, clearAuthSession, isAuthenticated } from "./utils/auth";
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
const PublicArchitecture = lazy(() => import("./PublicArchitecture"));
const UseCases = lazy(() => import("./UseCases"));
const PrivacyPolicy = lazy(() => import("./PrivacyPolicy"));
const TermsOfService = lazy(() => import("./TermsOfService"));
const SecurityDisclosure = lazy(() => import("./SecurityDisclosure"));
const AIAssistant = lazy(() => import("./AIAssistant"));
const MainLayout = lazy(() => import("./MainLayout"));
const ProtectedPageOutlet = lazy(() => import("./ProtectedPageOutlet"));
const NotFound = lazy(() => import("./NotFound"));

type RequireAuthProps = {
  children: ReactNode;
  authenticated: boolean;
};

type AppShellProps = {
  authenticated: boolean;
  isSsr?: boolean;
};

function RequireAuth({ children, authenticated }: RequireAuthProps) {
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

export function AppShell({ authenticated, isSsr = false }: AppShellProps) {
  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback}>
      <Suspense fallback={<RouteFallback />}>
        <RouteLifecycleEffects />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth/login" element={authenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/auth/signup" element={authenticated ? <Navigate to="/dashboard" replace /> : <Signup />} />
          <Route path="/login" element={<Navigate to={authenticated ? "/dashboard" : "/auth/login"} replace />} />
          <Route path="/signup" element={<Navigate to={authenticated ? "/dashboard" : "/auth/signup"} replace />} />
          <Route path="/contact" element={<ContactDemo mode="contact" />} />
          <Route path="/demo" element={<ContactDemo mode="demo" />} />
          <Route path="/platform" element={<Platform />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/deployment" element={<Deployment />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/case-study" element={<CaseStudy />} />
          <Route path="/screenshots" element={<Screenshots />} />
          <Route path="/architecture" element={<PublicArchitecture />} />
          <Route path="/use-cases" element={<UseCases />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/security" element={<SecurityDisclosure />} />

          {/* Protected Routes inside MainLayout */}
          <Route
            element={
              <RequireAuth authenticated={authenticated}>
                <MainLayout />
              </RequireAuth>
            }
          >
            <Route path="/terminal" element={<ProtectedPageOutlet page="terminal" />} />
            <Route path="/dashboard" element={<ProtectedPageOutlet page="dashboard" />} />
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
    </ErrorBoundary>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(false);

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
    const syncAuth = () => {
      const ok = isAuthenticated();
      if (!ok && localStorage.getItem("token")) {
        clearAuthSession();
      }
      setAuthenticated(ok);
    };
    syncAuth();
    const interval = setInterval(syncAuth, 15000);
    window.addEventListener(AUTH_CHANGED_EVENT, syncAuth);
    window.addEventListener("storage", syncAuth);
    return () => {
      clearInterval(interval);
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppShell authenticated={authenticated} />
    </Router>
  );
}

export default App;
