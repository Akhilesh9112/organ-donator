import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import PortalDashboard from "./pages/PortalDashboard";
import ResetPasswordPage from "./pages/ResetPasswordPage";
class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert" style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>We couldn’t load this page</h1>
        <p>Your records are saved. Reload to try again.</p>
        <button onClick={() => window.location.reload()}>Reload page</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Navigation() {
  const { user, loading, currentPage, sessionError } = useAuth();
  if (
    new URLSearchParams(window.location.search).get("page") === "reset-password"
  )
    return <ResetPasswordPage />;
  if (loading)
    return (
      <div className="os-boot" role="status">
        Opening your care workspace…
      </div>
    );
  if (user) return <PortalDashboard />;
  return (
    <>
      {sessionError && (
        <div role="alert" className="session-banner">
          {sessionError}
        </div>
      )}
      {currentPage === "home" ? (
        <HomePage />
      ) : currentPage === "register" ? (
        <RegisterPage />
      ) : (
        <LoginPage />
      )}
    </>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Navigation />
      </AuthProvider>
    </ErrorBoundary>
  );
}
