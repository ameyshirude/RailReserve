import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wrap a protected page with <ProtectedRoute role="USER"> or role="ADMIN".
 * - While the session check is in flight, shows a small loading state.
 * - If not logged in, redirects to the matching login page.
 * - If logged in as the wrong role, redirects to home.
 */
export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
        <div className="spinner-border text-amber" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={role === "ADMIN" ? "/admin-login" : "/login"} replace />;
  }

  if (user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
}
