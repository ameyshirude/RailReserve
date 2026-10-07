import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAnimating, setIsAnimating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navRef = useRef(null);
  const toggleRef = useRef(null);
  const logoutPending = useRef(false);
  const isAdmin = user?.role === "ADMIN";
  const inAdministration = location.pathname === "/admin-dashboard" || location.pathname.startsWith("/admin/");

  useEffect(() => { setMenuOpen(false); }, [location.key, user]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOutside = (event) => {
      if (!navRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    const closeOnResize = () => {
      if (window.innerWidth >= 992) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnResize);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setSigningOut(true);
    try {
      await logout();
      setMenuOpen(false);
      navigate("/", { replace: true });
    } catch {
      toast.error("Could not sign out. Please try again.");
    } finally {
      logoutPending.current = false;
      setSigningOut(false);
    }
  };

  return (
    <nav className="rr-navbar" aria-label="Main navigation" ref={navRef}>
      <div className="rr-train-track" aria-hidden="true">
        <div className={`rr-train ${isAnimating ? "is-running" : ""}`} onAnimationEnd={() => setIsAnimating(false)}>
          🚅🚃🚃🚃🚃🚃🚃🚃🚃🚃🚃🚃🚃
        </div>
      </div>
      <Link to="/" className="rr-brand" onMouseEnter={() => setIsAnimating(true)} onClick={() => { setIsAnimating(true); setMenuOpen(false); }}>
        <span className="rr-brand__mark" aria-hidden="true">🚆</span>
        <span className="font-display">RailReserve</span>
      </Link>

      <button ref={toggleRef} className="rr-hamburger" type="button" aria-controls="rr-navigation-links" aria-expanded={menuOpen} aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen((open) => !open)}>
        <span className="rr-hamburger__bar" />
        <span className="rr-hamburger__bar" />
        <span className="rr-hamburger__bar" />
      </button>

      <div id="rr-navigation-links" className={`rr-navigation ${menuOpen ? "is-open" : ""}`}>
        <ul className="rr-navigation__pages">
          <li><NavLink to="/" end className="rr-nav-link" onClick={() => setMenuOpen(false)}>Search trains</NavLink></li>
          {!loading && user?.role === "USER" && <li><NavLink to="/dashboard" className="rr-nav-link" onClick={() => setMenuOpen(false)}>My bookings</NavLink></li>}
          {!loading && isAdmin && <li><Link to="/admin-dashboard" className={`rr-nav-link ${inAdministration ? "active" : ""}`} aria-current={inAdministration ? "true" : undefined} onClick={() => setMenuOpen(false)}>Administration</Link></li>}
        </ul>
        <div className="rr-navigation__account">
          {loading ? <span className="rr-account-loading" role="status">Checking session…</span> : user ? <>
            <div className="rr-account" title={user.username}>
              <span className="rr-account__avatar" aria-hidden="true">{user.username?.slice(0, 1).toUpperCase() || "U"}</span>
              <span className="rr-account__details"><span className="rr-account__name">{user.username || "Account"}</span><span className="rr-account__role">{isAdmin ? "Administrator" : "Passenger"}</span></span>
            </div>
            <button type="button" className="rr-sign-out" onClick={handleLogout} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button>
          </> : <>
            <NavLink to="/admin-login" className="rr-nav-link rr-nav-link--secondary" onClick={() => setMenuOpen(false)}>Admin login</NavLink>
            <NavLink to="/login" className="rr-nav-link" onClick={() => setMenuOpen(false)}>Sign in</NavLink>
            <NavLink to="/register" className="rr-nav-link rr-nav-link--register" onClick={() => setMenuOpen(false)}>Create account</NavLink>
          </>}
        </div>
      </div>
    </nav>
  );
}
