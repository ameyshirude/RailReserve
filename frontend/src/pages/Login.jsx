import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { Link, useNavigate, useLocation } from "react-router-dom";
import apiClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

export default function Login() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const successMessage = location.state?.successMessage;
    if (successMessage) {
      toast.success(successMessage);
      // Clear navigation state so the toast doesn't re-fire on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await apiClient.post("/auth/login", form);
      setUser(data.user);
      const pendingRaw = sessionStorage.getItem("pendingBooking");
      if (pendingRaw) {
        sessionStorage.removeItem("pendingBooking");
        navigate("/", {
          state:   { pendingTrain: JSON.parse(pendingRaw) },
          replace: true,
        });
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card ticket-card">
        <div className="ticket-card__header">
          <h1 className="font-display">Passenger Login</h1>
          <p>Sign in to book and manage your seat reservations.</p>
        </div>
        <div className="ticket-perforation" />
        <div className="ticket-card__body">
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="username" className="form-label">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                className="form-control"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="form-control"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
            </div>
            <button type="submit" className="btn btn-amber w-100" disabled={submitting}>
              {submitting ? "Signing in..." : "Login"}
            </button>
          </form>
          <p className="auth-switch">
            No account?{" "}
            <Link to="/register" className="fw-semibold">
              Create one!
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
