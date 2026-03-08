import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import { AUTH_CHANGED_EVENT, clearAuthSession, isAuthenticated } from "./utils/auth";
import "./styles.css";

const Terminal = lazy(() => import("./Terminal.jsx"));
const Dashboard = lazy(() => import("./Dashboard.jsx"));
const Login = lazy(() => import("./Login.jsx"));
const Signup = lazy(() => import("./Signup.jsx"));
const ContactDemo = lazy(() => import("./ContactDemo.jsx"));
const Platform = lazy(() => import("./Platform.jsx"));
const PublicArchitecture = lazy(() => import("./PublicArchitecture.jsx"));
const UseCases = lazy(() => import("./UseCases.jsx"));
const PrivacyPolicy = lazy(() => import("./PrivacyPolicy.jsx"));
const TermsOfService = lazy(() => import("./TermsOfService.jsx"));
const SecurityDisclosure = lazy(() => import("./SecurityDisclosure.jsx"));
const Sites = lazy(() => import("./Sites.jsx"));
const Home = lazy(() => import("./Home.jsx"));
const ForensicsPage = lazy(() => import("./ForensicsPage.jsx"));
const ThreatIntel = lazy(() => import("./ThreatIntel.jsx"));
const MitreMapping = lazy(() => import("./MitreMapping.jsx"));
const AttackerProfile = lazy(() => import("./AttackerProfile.jsx"));
const DeceptionConfig = lazy(() => import("./DeceptionConfig.jsx"));
const AttackGraph = lazy(() => import("./AttackGraph.jsx"));
const SystemStatus = lazy(() => import("./SystemStatus.jsx"));
const Simulator = lazy(() => import("./Simulator.jsx"));
const LabArchitecture = lazy(() => import("./Architecture.jsx"));
const About = lazy(() => import("./About.jsx"));
const AuditLog = lazy(() => import("./AuditLog.jsx"));
const AIAssistant = lazy(() => import("./AIAssistant.jsx"));
const WorkingAIChatBot = lazy(() => import("./components/WorkingAIChatBot.jsx"));
const UrlScanner = lazy(() => import("./UrlScanner.jsx"));
const TelemetryCenter = lazy(() => import("./TelemetryCenter.jsx"));
const MainLayout = lazy(() => import("./MainLayout.jsx"));
const AdminLeads = lazy(() => import("./AdminLeads.jsx"));

function RequireAuth({ children }) {
  return isAuthenticated() ? children : <Navigate to="/auth/login" replace />;
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

function AppErrorFallback() {
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
          onClick={() => window.location.reload()}
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

function App() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated());

  useEffect(() => {
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
      <ErrorBoundary FallbackComponent={AppErrorFallback}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth/login" element={authenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
            <Route path="/auth/signup" element={authenticated ? <Navigate to="/dashboard" replace /> : <Signup />} />
            <Route path="/login" element={<Navigate to={authenticated ? "/dashboard" : "/"} replace />} />
            <Route path="/signup" element={<Navigate to={authenticated ? "/dashboard" : "/"} replace />} />
            <Route path="/contact" element={<ContactDemo mode="contact" />} />
            <Route path="/demo" element={<ContactDemo mode="demo" />} />
            <Route path="/platform" element={<Platform />} />
            <Route path="/architecture" element={<PublicArchitecture />} />
            <Route path="/use-cases" element={<UseCases />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/security" element={<SecurityDisclosure />} />

            {/* Protected Routes inside MainLayout */}
            <Route
              element={
                <RequireAuth>
                  <MainLayout />
                </RequireAuth>
              }
            >
              <Route path="/terminal" element={<Terminal />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/telemetry" element={<TelemetryCenter />} />
              <Route path="/sites" element={<Sites />} />
              <Route path="/forensics/detail" element={<ForensicsPage />} />
              <Route path="/intelligence" element={<ThreatIntel />} />
              <Route path="/mapping" element={<MitreMapping />} />
              <Route path="/profiling" element={<AttackerProfile />} />
              <Route path="/deception" element={<DeceptionConfig />} />
              <Route path="/graph" element={<AttackGraph />} />
              <Route path="/status" element={<SystemStatus />} />
              <Route path="/simulator" element={<Simulator />} />
              <Route path="/ai-companion" element={<WorkingAIChatBot />} />
              <Route path="/audit" element={<AuditLog />} />
              <Route path="/admin/leads" element={<AdminLeads />} />
              <Route path="/lab/architecture" element={<LabArchitecture />} />
              <Route path="/about" element={<About />} />
              <Route path="/url-scanner" element={<UrlScanner />} />
            </Route>
            <Route path="*" element={<Navigate to={authenticated ? "/dashboard" : "/"} replace />} />
          </Routes>
          <AIAssistant />
        </Suspense>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
