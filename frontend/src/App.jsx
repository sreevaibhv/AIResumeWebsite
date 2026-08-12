import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import ReportPage from "./features/analysis/ReportPage";
import SignIn from "./screens/SignIn";
import Dashboard from "./screens/Dashboard";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import AnalyzePage from "./features/analysis/AnalyzePage";
import DesignSystemPreview from "./pages/DesignSystemPreview";
import { AppShell } from "./layouts/AppShell";
import { PublicShell } from "./layouts/PublicShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import "./screens/Dashboard.css";

/**
 * Signed-out visitors are sent to /login carrying where they were
 * headed, so signing in returns them there instead of dumping them on
 * the dashboard.
 */
function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

/** Authenticated pages: sidebar + top bar, or bottom nav on a phone. */
function AppRoute({ children, ...shellProps }) {
  return (
    <RequireAuth>
      <AppShell {...shellProps}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </AppShell>
    </RequireAuth>
  );
}

/**
 * The report is link-shareable — a WhatsApp deep link must open it for
 * someone who has never signed in. Signed-in viewers get the full shell
 * (sidebar forced to a rail); everyone else gets public chrome.
 */
function ReportRoute() {
  const { isAuthenticated } = useAuth();
  const Shell = isAuthenticated ? AppShell : PublicShell;
  const props = isAuthenticated ? { crumb: "Dashboard", crumbTo: "/app" } : {};
  return (
    <Shell {...props}>
      <ErrorBoundary><ReportPage /></ErrorBoundary>
    </Shell>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={<PublicShell><ErrorBoundary><Landing /></ErrorBoundary></PublicShell>}
      />
      <Route
        path="/login"
        element={<PublicShell nav={false}><ErrorBoundary><SignIn /></ErrorBoundary></PublicShell>}
      />

      <Route path="/app" element={<AppRoute><Dashboard /></AppRoute>} />
      <Route
        path="/app/onboarding"
        element={<AppRoute heading="Set up"><Onboarding /></AppRoute>}
      />
      <Route
        path="/app/analyze"
        element={<AppRoute crumb="Dashboard" crumbTo="/app"><AnalyzePage /></AppRoute>}
      />

      <Route path="/report/:scanId" element={<ReportRoute />} />

      {/* Design-system reference. Not linked from the app. */}
      <Route path="/design-system" element={<DesignSystemPreview />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
