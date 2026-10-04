import React, { useState } from "react";
import { toast } from "react-toastify";
import { useNavigate, Link } from "react-router-dom";
import apiClient from "../api/axiosClient";
import "./Auth.css";

const initialForm = {
  username: "",
  password: "",
  confirmPassword: "",
  phone: "",
  email: "",
};

export default function Register() {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Quick client-side check before hitting the API (server re-validates everything too).
    if (form.password !== form.confirmPassword) {
      toast.error("Password and confirm password do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post("/auth/register", form);
      navigate("/login", {
        state: { successMessage: "Account created successfully. Please log in." },
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card ticket-card">
        <div className="ticket-card__header">
          <h1 className="font-display">Create Account</h1>
          <p>Register to start booking your train seats.</p>
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
                minLength={4}
                maxLength={20}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-control"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="phone" className="form-label">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                className="form-control"
                value={form.phone}
                onChange={handleChange}
                autoComplete="tel"
                pattern="[0-9]{10}"
                title="10 digit phone number"
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
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="confirmPassword" className="form-label">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                className="form-control"
                value={form.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
              {submitting ? "Creating account..." : "Create Account"}
            </button>
          </form>
          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
