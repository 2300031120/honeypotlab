import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from 'react-error-boundary';

// Components
import Terminal from './components/Terminal';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Signup from './components/Signup';
import Home from './components/Home';
import ForensicsPage from './components/ForensicsPage';
import ThreatIntel from './components/ThreatIntel';
import MitreMapping from './components/MitreMapping';
import AttackerProfile from './components/AttackerProfile';
import DeceptionConfig from './components/DeceptionConfig';
import AttackGraph from './components/AttackGraph';
import SystemStatus from './components/SystemStatus';
import Simulator from './components/Simulator';
import Architecture from './components/Architecture';
import About from './components/About';
import AuditLog from './components/AuditLog';
import AIAssistant from './components/AIAssistant';
import AIChatBot from './components/AIChatBot';
import UrlScanner from './components/UrlScanner';
import MainLayout from './components/MainLayout';

// UI Components
import { Button } from './components/ui';

// Utils
import './styles.css';

// Query Client Configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});

// Error Boundary Component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
    <div className="text-center max-w-md">
      <div className="text-red-500 text-6xl mb-4">⚠️</div>
      <h2 className="text-white text-xl font-bold mb-4">System Error</h2>
      <p className="text-gray-400 mb-6">
        Something went wrong with the CyberSentinel platform.
      </p>
      <details className="text-left bg-gray-800 p-4 rounded-lg mb-4 text-sm">
        <summary className="cursor-pointer text-gray-300">Error Details</summary>
        <pre className="text-red-400 mt-2 whitespace-pre-wrap">
          {error.message}
        </pre>
      </details>
      <Button onClick={resetErrorBoundary} variant="primary">
        Reload System
      </Button>
    </div>
  </div>
);

// Auth Context
const useAuth = () => {
  const isAuthenticated = !!localStorage.getItem("token");
  return { isAuthenticated };
};

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Protected Routes */}
              <Route
                path="/*"
                element={
                  isAuthenticated ? (
                    <MainLayout />
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              >
                <Route path="terminal" element={<Terminal />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="forensics/detail" element={<ForensicsPage />} />
                <Route path="intelligence" element={<ThreatIntel />} />
                <Route path="mapping" element={<MitreMapping />} />
                <Route path="profiling" element={<AttackerProfile />} />
                <Route path="deception" element={<DeceptionConfig />} />
                <Route path="graph" element={<AttackGraph />} />
                <Route path="status" element={<SystemStatus />} />
                <Route path="simulator" element={<Simulator />} />
                <Route path="ai-companion" element={<AIChatBot />} />
                <Route path="audit" element={<AuditLog />} />
                <Route path="architecture" element={<Architecture />} />
                <Route path="about" element={<About />} />
                <Route path="url-scanner" element={<UrlScanner />} />
              </Route>
            </Routes>

            {/* Floating AI Assistant */}
            <AIAssistant />
          </div>
        </Router>

        {/* Development Tools */}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
