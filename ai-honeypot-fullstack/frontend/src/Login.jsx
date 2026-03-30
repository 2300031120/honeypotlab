import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API_BASE, WS_BASE } from "./apiConfig";
import axios from "axios";
import "./styles.css";
import { motion, AnimatePresence, useAnimation } from "./utils/motionLite.jsx";
import { setAuthSession } from "./utils/auth";
import { loadAuthProviders } from "./utils/authProviders";
import { requestGoogleCredential } from "./utils/googleAuth";
import { PUBLIC_SITE } from "./siteConfig";
import {
  Shield, Lock, User, Eye, EyeOff, Fingerprint, Smartphone, AlertTriangle,
  Wifi, Activity, Cpu, Globe, Zap, CheckCircle, XCircle, Clock,
  ShieldCheck, Terminal, AlertCircle, Chrome
} from "lucide-react";

function normalizeGoogleAuthError(err) {
  const detail = String(err?.response?.data?.detail || err?.message || "").trim();
  const normalized = detail.toLowerCase();
  const origin = typeof window !== "undefined" ? window.location.origin : "current origin";
  if (!detail) {
    return "Google authentication failed.";
  }
  if (normalized.includes("origin_mismatch") || normalized.includes("unregistered_origin")) {
    return "Google sign-in is blocked for this URL. Use localhost:5173 or allow this origin in Google Cloud Console.";
  }
  if (normalized.includes("opt_out_or_no_session")) {
    return "Google session is unavailable in this browser. Sign in to Google first, then retry.";
  }
  if (normalized.includes("fedcm")) {
    return "Browser blocked federated sign-in. Allow Google sign-in in browser privacy settings or retry with localhost.";
  }
  if (normalized.includes("audience mismatch")) {
    return "Google OAuth client mismatch detected. Verify GOOGLE_OAUTH_CLIENT_ID and VITE_GOOGLE_CLIENT_ID.";
  }
  if (normalized.includes("invalid google credential")) {
    return "Google credential validation failed. Retry sign-in from the Google popup.";
  }
  if (normalized.includes("email is not verified")) {
    return "Google account email is not verified.";
  }
  if (normalized.includes("network error") || normalized.includes("failed to load google authentication script")) {
    return "Unable to reach Google sign-in service. Retry once, or use localhost:5173.";
  }
  if (normalized.includes("not configured on server")) {
    return "Google login is disabled on backend. Set GOOGLE_OAUTH_CLIENT_ID and redeploy backend.";
  }
  if (normalized.includes("cancelled") || normalized.includes("dismissed") || normalized.includes("popup_closed_by_user")) {
    return "Google sign-in was cancelled.";
  }
  return detail;
}

const PRODUCT_NAME = PUBLIC_SITE.shortName || PUBLIC_SITE.siteName;

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState("");
  const [authStep, setAuthStep] = useState('login'); // login, mfa, biometric
  const [mfaCode, setMfaCode] = useState('');
  const [pendingLogin, setPendingLogin] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleAuthStatus, setGoogleAuthStatus] = useState({
    checked: false,
    googleEnabled: null,
    serverGoogleClientId: "",
    signupEnabled: true,
    warning: "",
  });
  const [securityMetrics, setShieldMetrics] = useState({
    loginAttempts: 0,
    failedAttempts: 0,
    lastFailedAttempt: null,
    suspiciousActivity: false,
    threatLevel: 'low'
  });
  const [biometricAvailable, setFingerprintAvailable] = useState(false);
  const [biometricSupported, setFingerprintSupported] = useState(false);
  const [systemHealth, setSystemHealth] = useState({
    cpu: 0,
    memory: 0,
    activeConnections: 0,
    threatLevel: 'normal'
  });
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);

  const navigate = useNavigate();
  const controls = useAnimation();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const effectiveGoogleClientId = googleClientId || googleAuthStatus.serverGoogleClientId;
  const googleButtonEnabled =
    Boolean(effectiveGoogleClientId) &&
    (googleAuthStatus.checked ? googleAuthStatus.googleEnabled !== false : true);
  const signupEnabled = googleAuthStatus.signupEnabled !== false;
  const showDetailedGoogleDiagnostics =
    import.meta.env.VITE_SHOW_AUTH_DEBUG === "true" && Boolean(googleAuthStatus.warning);
  const biometricLoginEnabled = import.meta.env.VITE_ENABLE_BIOMETRIC_LOGIN === 'true';

  // Advanced security monitoring
  useEffect(() => {
    const checkFingerprintSupport = async () => {
      try {
        if (window.PublicKeyCredential) {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setFingerprintSupported(true);
          setFingerprintAvailable(available);
        }
      } catch (e) {
        console.log('Fingerprint not supported');
      }
    };
    checkFingerprintSupport();
  }, []);

  // Auth provider preflight diagnostics
  useEffect(() => {
    let cancelled = false;

    const fetchAuthProviders = async () => {
      try {
        const authProviders = await loadAuthProviders();
        const serverGoogleClientId = authProviders.serverGoogleClientId;
        const googleEnabled = authProviders.googleEnabled;

        let warning = "";
        if (googleClientId && serverGoogleClientId && googleClientId !== serverGoogleClientId) {
          warning = "Google OAuth client mismatch detected. Using server-configured client ID.";
        } else if (!googleClientId && serverGoogleClientId) {
          warning = "VITE_GOOGLE_CLIENT_ID is missing. Using server Google client ID.";
        } else if (googleClientId && !serverGoogleClientId) {
          warning = "Backend GOOGLE_OAUTH_CLIENT_ID is missing. Google login may fail.";
        } else if (!googleClientId && !serverGoogleClientId) {
          warning = "Google login is not configured on frontend or backend.";
        }

        if (!cancelled) {
          setGoogleAuthStatus({
            checked: true,
            googleEnabled,
            serverGoogleClientId,
            signupEnabled: authProviders.signupEnabled,
            warning,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setGoogleAuthStatus((prev) => ({
            ...prev,
            checked: true,
            warning: googleClientId
              ? "Unable to verify Google config from backend. Continuing with frontend client ID."
              : "Unable to load Google auth provider status from backend.",
          }));
        }
      }
    };

    fetchAuthProviders();
    return () => {
      cancelled = true;
    };
  }, [googleClientId]);

  // Real-time system health monitoring
  useEffect(() => {
    const fetchSystemHealth = async () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      try {
        const healthRes = await axios.get(`${API_BASE}/intelligence/health`);

        setSystemHealth({
          cpu: healthRes.data.resources?.cpu || 0,
          memory: healthRes.data.resources?.memory || 0,
          activeConnections: Number(healthRes.data.metrics?.active_sessions || 0),
          threatLevel:
            (healthRes.data.integrity?.trust_index ?? 100) <= 60
              ? 'high'
              : (healthRes.data.integrity?.trust_index ?? 100) <= 80
                ? 'medium'
                : 'normal'
        });
      } catch (e) {
        console.error('System health fetch failed:', e);
      }
    };

    fetchSystemHealth();
    const interval = setInterval(fetchSystemHealth, 15000); // Update every 15 seconds
    return () => clearInterval(interval);
  }, []);

  // Lockout mechanism
  useEffect(() => {
    if (isLocked && lockoutTime > 0) {
      const timer = setTimeout(() => {
        setLockoutTime(prev => {
          if (prev <= 1) {
            setIsLocked(false);
            setLoginAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isLocked, lockoutTime]);

  // Advanced login with security monitoring
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isLocked) {
      setError(`Account locked for ${lockoutTime} seconds due to security policy.`);
      return;
    }

    setLoading(true);
    setError("");
    setMsg("");
    const currentAttempts = loginAttempts + 1;
    setLoginAttempts(currentAttempts);

    try {
      // Risk assessment
      const riskScore = calculateRiskScore(username, currentAttempts);
      if (riskScore > 85 && currentAttempts >= 3) {
        setError("High security risk detected. Access blocked until administrator review.");
        setLoading(false);
        return;
      }

      const res = await axios.post(`${API_BASE}/auth/login`, {
        username,
        password
      }, {
        headers: {
          'X-Risk-Score': riskScore,
          'X-Login-Attempt': currentAttempts,
          'X-Client-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      });
      // Successful login
      setAuthSession(res.data.token, {
        username: res.data.username || username,
        role: res.data.role || "analyst"
      });
      setMsg(`ACCESS GRANTED - WELCOME TO ${PRODUCT_NAME.toUpperCase()}`);
      controls.start({ scale: 1.05, transition: { duration: 0.3 } });
      setPendingLogin(null);
      setAuthStep('login');
      setLoginAttempts(0);
      navigate("/dashboard");

    } catch (err) {
      const attempts = currentAttempts;

      // Progressive security measures
      if (attempts >= 5) {
        setIsLocked(true);
        setLockoutTime(300); // 5 minutes
        setError("Account locked for 5 minutes due to multiple failed attempts.");
      } else if (attempts >= 3) {
        setError(`Login failed. ${5 - attempts} attempts remaining before lockout.`);
      } else {
        setError(err.response?.data?.detail || "Authentication failed. Check credentials.");
      }

      // Update security metrics
      setShieldMetrics(prev => ({
        ...prev,
        failedAttempts: prev.failedAttempts + 1,
        lastFailedAttempt: new Date().toISOString(),
        suspiciousActivity: attempts >= 3,
        threatLevel: attempts >= 3 ? 'high' : 'medium'
      }));

    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    if (!pendingLogin?.username || !pendingLogin?.password) {
      setError("Start MFA flow from login step with username/email and password.");
      setAuthStep('login');
      return;
    }

    setLoading(true);
    setError("");
    setMsg("");
    try {
      const riskScore = calculateRiskScore(pendingLogin.username, loginAttempts);
      const res = await axios.post(`${API_BASE}/auth/login`, {
        username: pendingLogin.username,
        password: pendingLogin.password
      }, {
        headers: {
          'X-Risk-Score': riskScore,
          'X-MFA-Code': mfaCode,
          'X-MFA-Mode': 'otp'
        }
      });
      setAuthSession(res.data.token, {
        username: res.data.username || pendingLogin.username,
        role: res.data.role || "analyst"
      });
      setMsg("MFA VERIFIED - ACCESS GRANTED");
      setPendingLogin(null);
      setMfaCode('');
      setAuthStep('login');
      setLoginAttempts(0);
      setTimeout(() => navigate("/dashboard"), 500);
    } catch (err) {
      setError(err.response?.data?.detail || "MFA verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setMsg("");
    if (googleAuthStatus.checked && googleAuthStatus.googleEnabled === false) {
      setError("Google login is disabled on backend. Configure GOOGLE_OAUTH_CLIENT_ID and redeploy.");
      return;
    }
    if (!effectiveGoogleClientId) {
      setError("Google login is not configured. Set GOOGLE_OAUTH_CLIENT_ID or VITE_GOOGLE_CLIENT_ID.");
      return;
    }

    setGoogleLoading(true);
    try {
      const credential = await requestGoogleCredential(effectiveGoogleClientId);
      const res = await axios.post(`${API_BASE}/auth/google`, {
        credential,
        plan: "free"
      });
      setAuthSession(res.data.token, {
        username: res.data.username || res.data.email || "google_user",
        role: res.data.role || "admin",
        provider: "google",
      });
      setMsg(res.data.new_user ? "Google signup successful. Redirecting..." : "Google login successful. Redirecting...");
      setTimeout(() => navigate("/dashboard"), 500);
    } catch (err) {
      setError(normalizeGoogleAuthError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  // Fingerprint authentication
  const handleFingerprintAuth = async () => {
    if (!biometricLoginEnabled) {
      setError("Biometric login is disabled in this deployment.");
      return;
    }
    try {
      setLoading(true);
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          allowCredentials: [],
          userVerification: 'required',
          timeout: 60000
        }
      });

      if (credential) {
        const res = await axios.post(`${API_BASE}/auth/biometric-login`, {
          credential: btoa(JSON.stringify(credential))
        });

        setAuthSession(res.data.token, {
          username: username || "biometric_user",
          role: res.data.role || "analyst"
        });
        setMsg("BIOMETRIC AUTHENTICATION SUCCESSFUL");
        setTimeout(() => navigate("/dashboard"), 1000);
      }
    } catch (err) {
      setError("Fingerprint authentication failed. Please use password login.");
    } finally {
      setLoading(false);
    }
  };

  // Risk assessment algorithm
  const calculateRiskScore = (username, attempts) => {
    let score = 0;

    // Attempt-based risk
    score += attempts * 15;

    // Username patterns
    if (username.length < 4) score += 25;
    if (/^(root|test|guest|user)$/i.test(username.trim())) score += 20;

    // Time-based risk
    const hour = new Date().getHours();
    if (hour >= 22 || hour <= 6) score += 15;

    // System health risk
    if (systemHealth.threatLevel === 'high') score += 20;
    if (systemHealth.threatLevel === 'medium') score += 10;

    return Math.min(100, score);
  };

  // Advanced animations
  const shakeAnimation = {
    x: [0, -10, 10, -10, 10, 0],
    transition: { duration: 0.5 }
  };

  const successAnimation = {
    scale: [1, 1.1, 1],
    transition: { duration: 0.3 }
  };

  const resetLocalLockout = () => {
    setIsLocked(false);
    setLockoutTime(0);
    setLoginAttempts(0);
    setError("");
    setShieldMetrics((prev) => ({
      ...prev,
      suspiciousActivity: false,
      threatLevel: "low",
    }));
  };

  const fillDemoCredentials = () => {
    setUsername("admin");
    setPassword("Admin@123");
    setError("");
    setMsg("Demo credentials loaded. Submit secure access to continue.");
  };

  return (
    <div className="login-page">
      {/* Simplified background for cleaner UX */}

      <div className="login-shell">
      <div className="login-wrapper">
        <div className="login-quick-nav">
          <Link to="/" className="login-quick-link">Home</Link>
          {signupEnabled ? (
            <Link to="/auth/signup" className="login-quick-link login-quick-link-primary">Sign Up</Link>
          ) : (
            <Link to="/demo" className="login-quick-link login-quick-link-primary">Request Demo</Link>
          )}
        </div>

        {/* Main Login Card */}
        <AnimatePresence mode="wait">
          {authStep === 'login' && (
            <motion.div
              key="login"
              className="login-card fade-in"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
            >
              {/* Shield Shield Icon */}
              <motion.div
                style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}
                animate={msg.includes('GRANTED') ? successAnimation : {}}
              >
                <div style={{
                  width: '80px', height: '80px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(63,185,80,0.2))',
                  border: '2px solid rgba(59,130,246,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 40px rgba(59,130,246,0.2)',
                  position: 'relative'
                }}>
                  <motion.div
                    animate={loading ? { rotate: 360 } : {}}
                    transition={{ duration: 2, repeat: loading ? Infinity : 0, ease: "linear" }}
                  >
                    <Shield size={36} color="#3b82f6" />
                  </motion.div>

                  {/* Shield Rings */}
                  <motion.div
                    style={{
                      position: 'absolute',
                      width: '120px',
                      height: '120px',
                      border: '1px solid rgba(59,130,246,0.2)',
                      borderRadius: '50%',
                      top: '-20px',
                      left: '-20px'
                    }}
                    animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />

                  <motion.div
                    style={{
                      position: 'absolute',
                      width: '140px',
                      height: '140px',
                      border: '1px solid rgba(63,185,80,0.1)',
                      borderRadius: '50%',
                      top: '-30px',
                      left: '-30px'
                    }}
                    animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  />
                </div>
              </motion.div>

              <motion.h2
                style={{
                  textAlign: 'center',
                  fontSize: '1.8rem',
                  fontWeight: '900',
                  marginBottom: '8px',
                  color: '#1f2a3d',
                  background: 'linear-gradient(135deg, #fff 0%, #c65d1a 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
                animate={msg.includes('GRANTED') ? successAnimation : {}}
              >
                SENTINEL ACCESS CONTROL
              </motion.h2>

              <p style={{
                textAlign: 'center',
                color: '#5f6b7f',
                fontSize: '14px',
                marginBottom: '30px',
                fontWeight: '500'
              }}>
                Advanced Multi-Factor Authentication - SOC Division
              </p>

              <div
                style={{
                  background: 'rgba(88,166,255,0.08)',
                  border: '1px solid rgba(88,166,255,0.25)',
                  color: '#dbeafe',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  marginBottom: '20px',
                  fontSize: '12px',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: '4px', color: '#93c5fd' }}>Demo credentials</div>
                <div><strong>Username:</strong> `admin`</div>
                <div><strong>Password:</strong> `Admin@123`</div>
                <button
                  type="button"
                  onClick={fillDemoCredentials}
                  style={{
                    marginTop: '10px',
                    border: '1px solid rgba(88,166,255,0.35)',
                    borderRadius: '8px',
                    background: 'rgba(15,23,42,0.35)',
                    color: '#bfdbfe',
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '8px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Use Demo Access
                </button>
              </div>

              {/* Shield Alerts */}
              {securityMetrics.suspiciousActivity && (
                <motion.div
                  style={{
                    background: 'rgba(248,81,73,0.1)',
                    border: '1px solid rgba(248,81,73,0.3)',
                    color: '#f85149',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    fontSize: '13px',
                    textAlign: 'center'
                  }}
                  animate={shakeAnimation}
                >
                  <AlertTriangle size={16} style={{ marginRight: '8px' }} />
                  Suspicious activity detected. Enhanced security measures active.
                </motion.div>
              )}

              {isLocked && (
                <motion.button
                  type="button"
                  onClick={resetLocalLockout}
                  style={{
                    width: '100%',
                    marginBottom: '18px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(248,81,73,0.35)',
                    background: 'rgba(248,81,73,0.08)',
                    color: '#f87171',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 800,
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  Reset Local Lockout
                </motion.button>
              )}

              {/* Google Auth Diagnostics */}
              <AnimatePresence>
                {showDetailedGoogleDiagnostics && (
                  <motion.div
                    style={{
                      background: 'rgba(198,93,26,0.1)',
                      border: '1px solid rgba(198,93,26,0.35)',
                      color: '#b45309',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      marginBottom: '20px',
                      fontSize: '13px',
                      textAlign: 'left'
                    }}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", fontWeight: 700 }}>
                      <AlertCircle size={16} />
                      Dev OAuth Notice
                    </div>
                    <div>{googleAuthStatus.warning}</div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Messages */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    style={{
                      background: 'rgba(248,81,73,0.1)',
                      border: '1px solid rgba(248,81,73,0.3)',
                      color: '#f85149',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      marginBottom: '20px',
                      fontSize: '13px',
                      textAlign: 'center'
                    }}
                    initial={{ opacity: 0, y: -10 }}
                    animate={error.includes('locked') ? shakeAnimation : { opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <XCircle size={16} style={{ marginRight: '8px' }} />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Success Messages */}
              <AnimatePresence>
                {msg && (
                  <motion.div
                    style={{
                      background: 'rgba(63,185,80,0.1)',
                      border: '1px solid rgba(63,185,80,0.3)',
                      color: '#3fb950',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      marginBottom: '20px',
                      fontSize: '13px',
                      textAlign: 'center'
                    }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <CheckCircle size={16} style={{ marginRight: '8px' }} />
                    {msg}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Login Form */}
              <motion.form
                onSubmit={handleSubmit}
                animate={controls}
              >
                {/* Username Field */}
                <motion.div
                  style={{ marginBottom: '20px' }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <label style={{
                    display: 'block',
                    color: '#5f6b7f',
                    marginBottom: '8px',
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontWeight: '700'
                  }}>
                    <User size={14} style={{ marginRight: '8px' }} />
                    Username or Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#484f58'
                    }} />
                    <motion.input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username or email"
                      required
                      disabled={isLocked}
                      style={{
                        width: '100%',
                        padding: '14px 14px 14px 42px',
                        background: '#010409',
                        border: '1px solid #e5ddd1',
                        color: '#1f2a3d',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: '0.3s',
                        boxSizing: 'border-box'
                      }}
                      whileFocus={{ scale: 1.02 }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#e5ddd1'}
                    />
                  </div>
                </motion.div>

                {/* Password Field */}
                <motion.div
                  style={{ marginBottom: '28px' }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <label style={{
                    display: 'block',
                    color: '#5f6b7f',
                    marginBottom: '8px',
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontWeight: '700'
                  }}>
                    <Lock size={14} style={{ marginRight: '8px' }} />
                    Access Key
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#484f58'
                    }} />
                    <motion.input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter secure password"
                      required
                      disabled={isLocked}
                      style={{
                        width: '100%',
                        padding: '14px 42px 14px 42px',
                        background: '#010409',
                        border: '1px solid #e5ddd1',
                        color: '#1f2a3d',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: '0.3s',
                        boxSizing: 'border-box'
                      }}
                      whileFocus={{ scale: 1.02 }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#e5ddd1'}
                    />
                    <motion.button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      {showPassword ?
                        <EyeOff size={16} color="#484f58" /> :
                        <Eye size={16} color="#484f58" />
                      }
                    </motion.button>
                  </div>
                </motion.div>

                {/* Authentication Options */}
                <motion.div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    marginBottom: '28px',
                    justifyContent: 'center',
                    flexWrap: 'wrap'
                  }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <motion.button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading || googleLoading || isLocked || !googleButtonEnabled}
                    style={{
                      padding: '12px',
                      background: 'rgba(88,166,255,0.08)',
                      border: '1px solid rgba(88,166,255,0.3)',
                      borderRadius: '8px',
                      color: '#c65d1a',
                      cursor: loading || googleLoading || isLocked || !googleButtonEnabled ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Chrome size={16} />
                    {googleLoading ? 'Google...' : googleButtonEnabled ? 'Google' : 'Google Off'}
                  </motion.button>

                  {biometricSupported && biometricLoginEnabled && (
                    <motion.button
                      type="button"
                      onClick={handleFingerprintAuth}
                      disabled={loading || googleLoading || isLocked}
                      style={{
                        padding: '12px',
                        background: biometricAvailable ? 'rgba(63,185,80,0.1)' : 'rgba(48,54,61,0.5)',
                        border: `1px solid ${biometricAvailable ? '#3fb950' : '#e5ddd1'}`,
                        borderRadius: '8px',
                        color: biometricAvailable ? '#3fb950' : '#5f6b7f',
                        cursor: biometricAvailable ? 'pointer' : 'not-allowed',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      whileHover={biometricAvailable ? { scale: 1.05 } : {}}
                      whileTap={biometricAvailable ? { scale: 0.95 } : {}}
                    >
                      <Fingerprint size={16} />
                      Fingerprint
                    </motion.button>
                  )}

                  <motion.button
                    type="button"
                    onClick={() => {
                      if (!username.trim() || !password) {
                        setError("Enter username/email and password first to start MFA challenge.");
                        return;
                      }
                      setPendingLogin({ username: username.trim(), password });
                      setMfaCode('');
                      setError('');
                      setMsg('MFA challenge initialized. Enter your verification code.');
                      setAuthStep('mfa');
                    }}
                    disabled={loading || googleLoading || isLocked}
                    style={{
                      padding: '12px',
                      background: 'rgba(88,166,255,0.08)',
                      border: '1px solid rgba(88,166,255,0.3)',
                      borderRadius: '8px',
                      color: '#c65d1a',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Smartphone size={16} />
                    MFA Challenge
                  </motion.button>
                </motion.div>

                {/* Login Button */}
                <motion.button
                  type="submit"
                  disabled={loading || googleLoading || isLocked}
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: 'none',
                    borderRadius: '10px',
                    background: isLocked ? '#e5ddd1' :
                              loading ? '#21262d' :
                              'linear-gradient(135deg, #238636, #2ea043)',
                    color: 'white',
                    fontWeight: '800',
                    fontSize: '15px',
                    cursor: isLocked ? 'not-allowed' : loading ? 'not-allowed' : 'pointer',
                    transition: '0.3s',
                    letterSpacing: '1px',
                    boxShadow: isLocked ? 'none' :
                             loading ? 'none' :
                             '0 6px 20px rgba(35,134,54,0.4)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  whileHover={!isLocked && !loading ? { scale: 1.02 } : {}}
                  whileTap={!isLocked && !loading ? { scale: 0.98 } : {}}
                >
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                    animation: loading ? 'none' : 'shine 3s infinite'
                  }} />

                  {isLocked ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Lock size={18} /> LOCKED ({lockoutTime}s)
                    </span>
                  ) : loading ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      AUTHENTICATING...
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <ShieldCheck size={18} />
                      INITIATE SECURE ACCESS
                    </span>
                  )}
                </motion.button>
              </motion.form>

              <motion.div
                style={{
                  marginTop: '24px',
                  textAlign: 'center',
                  fontSize: '13px'
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {signupEnabled ? (
                  <Link to="/auth/signup" style={{
                    color: '#c65d1a',
                    textDecoration: 'none',
                    fontWeight: '600'
                  }}>
                    Request Access Credentials
                  </Link>
                ) : (
                  <Link to="/demo" style={{
                    color: '#c65d1a',
                    textDecoration: 'none',
                    fontWeight: '600'
                  }}>
                    Request Guided Access
                  </Link>
                )}
              </motion.div>

              {/* Scanline effect */}
              <div className="scanline"></div>
            </motion.div>
          )}

          {/* MFA Step */}
          {authStep === 'mfa' && (
            <motion.div
              key="mfa"
              className="login-card fade-in"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
            >
              <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <Smartphone size={48} color="#c65d1a" />
                <h2 style={{ color: '#1f2a3d', marginTop: '16px' }}>Multi-Factor Authentication</h2>
                <p style={{ color: '#5f6b7f' }}>Enter your 6-digit verification code</p>
              </div>

              <form onSubmit={handleMfaSubmit}>
                <div style={{ marginBottom: '28px' }}>
                  <input
                    type="text"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength="6"
                    style={{
                      width: '100%',
                      padding: '16px',
                      background: '#010409',
                      border: '1px solid #e5ddd1',
                      color: '#1f2a3d',
                      borderRadius: '8px',
                      fontSize: '24px',
                      textAlign: 'center',
                      letterSpacing: '8px',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || mfaCode.length !== 6}
                  style={{
                    width: '100%',
                    padding: '14px',
                    border: 'none',
                    borderRadius: '8px',
                    background: loading ? '#21262d' : 'linear-gradient(135deg, #238636, #2ea043)',
                    color: 'white',
                    fontWeight: '700',
                    fontSize: '14px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'VERIFYING...' : 'VERIFY CODE'}
                </button>
              </form>

              <button
                onClick={() => {
                  setAuthStep('login');
                  setMfaCode('');
                  setPendingLogin(null);
                }}
                style={{
                  width: '100%',
                  marginTop: '16px',
                  padding: '12px',
                  border: '1px solid #e5ddd1',
                  borderRadius: '8px',
                  background: 'transparent',
                  color: '#5f6b7f',
                  cursor: 'pointer'
                }}
              >
                Back to Login
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Advanced Footer with Shield Metrics */}
        <motion.div
          className="footer"
          style={{
            textAlign: 'center',
            marginTop: '30px',
            color: '#484f58',
            fontSize: '11px'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span>Platform Version 2.4.1 | (c) 2026 SOC Deception Systems</span>
            <span style={{ color: '#3fb950' }}>
              <ShieldCheck size={12} style={{ marginRight: '4px' }} />
              Shield Level: {securityMetrics.threatLevel.toUpperCase()}
            </span>
            <span style={{ color: '#c65d1a' }}>
              <Activity size={12} style={{ marginRight: '4px' }} />
              Failed Attempts: {securityMetrics.failedAttempts}
            </span>
          </div>

          {securityMetrics.lastFailedAttempt && (
            <div style={{ fontSize: '10px', color: '#f85149', marginTop: '8px' }}>
              Last security event: {new Date(securityMetrics.lastFailedAttempt).toLocaleString()}
            </div>
          )}
        </motion.div>
      </div>
      <aside className="login-side-panel">
        <h3>Platform Highlights</h3>
        <ul>
          <li>Adaptive decoy environments</li>
          <li>AI-assisted attacker summaries</li>
          <li>Live session and threat analytics</li>
          <li>Startup-ready lead workflow</li>
        </ul>
        <div className="login-side-metrics">
          <div>
            <span>Active sessions</span>
            <strong>{systemHealth.activeConnections}</strong>
          </div>
          <div>
            <span>Threat level</span>
            <strong>{securityMetrics.threatLevel.toUpperCase()}</strong>
          </div>
        </div>
        <Link to="/" className="login-side-link">
          Back to Website
        </Link>
      </aside>
      </div>

      <style>
        {`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes shine {
          0% { left: -100%; }
          100% { left: 100%; }
        }

        .login-page {
          min-height: 100vh;
          background: linear-gradient(145deg, #faf7f2 0%, #f4efe7 52%, #f8f4ed 100%);
          position: relative;
          overflow-x: hidden;
          overflow-y: auto;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 12px 14px 24px;
        }

        .cyber-grid {
          display: none;
        }

        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }

        .login-shell {
          width: min(960px, 100%);
          display: grid;
          grid-template-columns: minmax(340px, 520px) minmax(250px, 340px);
          gap: 18px;
          align-items: start;
          margin: 0 auto;
        }

        .login-wrapper {
          width: 100%;
          margin: 0;
          padding: 6px 2px;
          position: relative;
          z-index: 1;
        }

        .login-quick-nav {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-bottom: 10px;
        }

        .login-quick-link {
          text-decoration: none;
          border: 1px solid #e5ddd1;
          border-radius: 10px;
          background: #ffffff;
          color: #4b5563;
          padding: 7px 12px;
          font-size: 12px;
          font-weight: 700;
        }

        .login-quick-link:hover {
          border-color: rgba(198,93,26,0.45);
          color: #b45309;
        }

        .login-quick-link-primary {
          background: linear-gradient(135deg, #c65d1a, #df7a3b);
          color: #fff !important;
          border-color: transparent;
        }

        .top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid #e5ddd1;
          border-radius: 12px;
          padding: 12px 16px;
          margin-bottom: 16px;
          backdrop-filter: blur(10px);
          color: #5f6b7f;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background: #c65d1a;
          border-radius: 50%;
          display: inline-block;
          margin-right: 8px;
          animation: pulse 2s infinite;
        }

        .login-card {
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid #e5ddd1;
          border-radius: 20px;
          padding: 30px;
          backdrop-filter: blur(20px);
          box-shadow: 0 20px 36px rgba(47, 34, 21, 0.12);
        }

        .scanline {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #c65d1a, transparent);
          animation: scan 3s linear infinite;
        }

        .login-side-panel {
          border: 1px solid #e5ddd1;
          background: rgba(255, 255, 255, 0.95);
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 16px 30px rgba(47, 34, 21, 0.1);
          color: #2f3b4f;
          display: grid;
          gap: 12px;
        }

        .login-side-panel h3 {
          margin: 0;
          font-size: 20px;
          color: #1f2a3d;
        }

        .login-side-panel ul {
          margin: 0;
          padding-left: 18px;
          display: grid;
          gap: 8px;
          color: #5f6b7f;
          font-size: 14px;
        }

        .login-side-metrics {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .login-side-metrics > div {
          border: 1px solid #e9e3db;
          border-radius: 12px;
          padding: 10px;
          background: #fffaf5;
          display: grid;
          gap: 4px;
        }

        .login-side-metrics span {
          color: #6b7280;
          font-size: 12px;
          font-weight: 700;
        }

        .login-side-metrics strong {
          color: #c65d1a;
          font-size: 14px;
        }

        .login-side-link {
          text-decoration: none;
          border: 1px solid #e5ddd1;
          border-radius: 10px;
          color: #39475b;
          background: #ffffff;
          font-size: 13px;
          font-weight: 700;
          padding: 10px 12px;
          text-align: center;
        }

        .login-side-link:hover {
          border-color: rgba(198,93,26,0.4);
          color: #b45309;
        }

        @keyframes scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .fade-in {
          animation: fadeIn 0.8s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1020px) {
          .login-shell {
            grid-template-columns: 1fr;
            width: min(620px, 100%);
          }

          .login-side-panel {
            display: none;
          }

          .top-bar {
            display: none;
          }

          .login-card {
            padding: 22px;
          }
        }

        @media (max-height: 860px) {
          .login-side-panel {
            display: none;
          }

          .login-shell {
            width: min(620px, 100%);
            grid-template-columns: 1fr;
          }
        }
        `}
      </style>
    </div>
  );
}




