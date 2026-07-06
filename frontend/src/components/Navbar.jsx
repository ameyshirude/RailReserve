import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <nav className="rr-navbar navbar navbar-dark px-3 px-md-5 py-2">
      <Link to="/" className="rr-brand">
        <span className="rr-brand__mark" aria-hidden="true">
          🚆
        </span>
        <span className="font-display">RailReserve</span>
      </Link>

      <div className="dropdown">
        <button
          className="rr-hamburger"
          type="button"
          id="navMenuToggle"
          data-bs-toggle="dropdown"
          aria-expanded="false"
          aria-label="Open menu"
        >
          <span className="rr-hamburger__bar" />
          <span className="rr-hamburger__bar" />
          <span className="rr-hamburger__bar" />
        </button>

        <ul className="dropdown-menu dropdown-menu-end rr-dropdown" aria-labelledby="navMenuToggle">
          {!user && (
            <>
              <li>
                <Link className="dropdown-item" to="/login">
                  Login
                </Link>
              </li>
              <li>
                <Link className="dropdown-item" to="/register">
                  Register
                </Link>
              </li>
              <li>
                <hr className="dropdown-divider" />
              </li>
              <li>
                <Link className="dropdown-item" to="/admin-login">
                  Admin Login
                </Link>
              </li>
            </>
          )}

          {user && user.role === "USER" && (
            <>
              <li>
                <Link className="dropdown-item" to="/dashboard">
                  Dashboard
                </Link>
              </li>
              <li>
                <button className="dropdown-item" onClick={handleLogout}>
                  Logout
                </button>
              </li>
            </>
          )}

          {user && user.role === "ADMIN" && (
            <>
              <li>
                <Link className="dropdown-item" to="/admin-dashboard">
                  Admin Dashboard
                </Link>
              </li>
              <li>
                <button className="dropdown-item" onClick={handleLogout}>
                  Logout
                </button>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
}
