import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import apiClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import BookingsModal from "../components/BookingsModal";
import { StatCardSkeleton } from "../components/SkeletonLoaders";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [bookingsOpen, setBookingsOpen] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  useEffect(() => {
    apiClient
      .get("/admin/dashboard")
      .then((res) => setData(res.data))
      .catch((err) =>
        toast.error(err.response?.data?.message || "Could not load admin dashboard.")
      );
  }, []);

  const handleOpenBookings = async () => {
    setBookingsOpen(true);
    setLoadingBookings(true);
    try {
      const { data: result } = await apiClient.get("/admin/bookings");
      setBookings(result.bookings);
    } catch {
      setBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };

  const statCards = [
    { label: "Total Users", value: data?.stats?.totalUsers ?? "-", clickable: false },
    {
      label: "Total Bookings",
      value: data?.stats?.totalBookings ?? "-",
      clickable: true,
      onClick: handleOpenBookings,
    },
    { label: "Total Trains", value: data?.stats?.totalTrains ?? "-", clickable: false },
  ];

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-display mb-1">Admin Dashboard</h1>
          <p className="text-amber mb-0 font-mono">
            Logged in as {user?.username} &middot; role: {user?.role}
          </p>
        </div>
        <Link to="/admin/trains" className="btn btn-amber">
          Manage Trains
        </Link>
      </div>


      <div className="row g-3 mb-4">
        {!data ? (
          <>
            {[1, 2, 3].map((i) => (
              <div className="col-12 col-md-4" key={i}>
                <StatCardSkeleton />
              </div>
            ))}
          </>
        ) : (
          statCards.map(({ label, value, clickable, onClick }) => (
            <div className="col-12 col-md-4" key={label}>
              <div
                className="ticket-card p-3 text-center"
                onClick={clickable ? onClick : undefined}
                style={clickable ? { cursor: "pointer" } : undefined}
                title={clickable ? `Click to view ${label}` : undefined}
              >
                <div className="font-mono fs-3">{value}</div>
                <div className="text-muted small text-uppercase">{label}</div>
                {clickable && (
                  <div style={{ fontSize: "0.80rem", color: "var(--color-navy-blue)", marginTop: "0.3rem" }}>
                    Click to view ›
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="ticket-card">
        <div className="ticket-card__header">
          <h2 className="font-display mb-0" style={{ fontSize: "1.1rem" }}>
            {data ? data.message : "Loading..."}
          </h2>
        </div>
        <div className="ticket-perforation" />
        <div className="ticket-card__body">
          <p className="mb-0 text-muted">
            The <strong>Manage Trains</strong> button above can be used to add, edit, or remove trains with their halts and coaches.
          </p>
        </div>
      </div>

      <BookingsModal
        show={bookingsOpen}
        onClose={() => setBookingsOpen(false)}
        bookings={bookings}
        loading={loadingBookings}
      />
    </div>
  );
}