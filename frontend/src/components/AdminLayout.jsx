import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import "./AdminLayout.css";

export default function AdminLayout() {
  return (
    <div className="rr-admin-layout">
      <div className="rr-admin-bar">
        <div className="container rr-admin-bar__inner">
          <span className="rr-admin-bar__label">Administration</span>
          <nav aria-label="Administration">
            <NavLink to="/admin-dashboard" end>Overview</NavLink>
            <NavLink to="/admin/trains">Manage trains</NavLink>
          </nav>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
