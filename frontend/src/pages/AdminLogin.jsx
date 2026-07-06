import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

export default function AdminLogin() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await apiClient.post("/auth/admin-login", form);
      setUser(data.user);
      navigate("/admin-dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Admin login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card ticket-card">
        <div className="ticket-card__header bg-navy-2">
          <h1 className="font-display text-amber">Admin Login</h1>
          <p>Restricted access for railway administrators only.</p>
        </div>
        <div className="ticket-perforation" />
        <div className="ticket-card__body">
          {error && (
            <div className="alert alert-danger auth-error" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="username" className="form-label">
                Admin Username
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
              {submitting ? "Verifying..." : "Login as Admin"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
