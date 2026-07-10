import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import { downloadReceipt } from "../components/BookingFlowModal";

function formatBookingDate(iso) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatTravelDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  });
}

function formatDateTime(iso) {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDistance(distance) {
  const value = Number(distance);
  if (!Number.isFinite(value)) return "Not set";
  return `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })} km`;
}

function TicketDetail({ label, children, mono = false }) {
  return (
    <div className="col-6 col-md-3">
      <div
        style={{
          fontSize:      "0.72rem",
          textTransform: "uppercase",
          fontFamily:    "var(--font-mono)",
          color:         "var(--color-ink-soft)",
          marginBottom:  "3px",
        }}
      >
        {label}
      </div>
      <div
        className={mono ? "font-mono fw-semibold" : undefined}
        style={{
          fontSize:  "0.88rem",
          fontWeight: mono ? undefined : 600,
          wordBreak: "break-word",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function BookingCard({ booking }) {
  const seatDisplay = booking.passengers
    .map((p) => `CNF/${p.seatNumber}`)
    .join(", ");

  return (
    <div
      className="ticket-card mb-3"
      style={{ background: "var(--color-paper)", color: "var(--color-ink)" }}
    >
      <div
        className="ticket-card__header d-flex justify-content-between align-items-start"
        style={{ padding: "0.9rem 1.25rem" }}
      >
        <div>
          <span className="font-display" style={{ fontSize: "1.2rem", fontFamily:"ui-sans-serif"}}>
            {booking.train.name}
          </span>
          <span
            className="font-mono ms-2"
            style={{ fontSize: "0.8rem", borderRadius: "2px", background: "black", color: "var(--color-paper)" }}
          >
            #{booking.train.number}
          </span>
        </div>
        <span
          className="badge"
          style={{
            background:  "rgb(16, 228, 41)",
            color:       "#000a04",
            fontFamily:  "var(--font-mono)",
            fontSize:    "0.72rem",
            fontWeight:  700,
            padding:     "4px 10px",
            borderRadius: "12px",
            border:      "1px solid rgb(5, 5, 5)",
          }}
        >
          ✓ Confirmed
        </span>
      </div>

      <div className="ticket-perforation" />

      <div className="ticket-card__body" style={{ padding: "0.9rem 1.25rem" }}>
        {/* Route */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <span className="fw-semibold">{booking.boarding}</span>
          <span style={{ color: "var(--color-steel)", fontSize: "1.1rem" }}>→</span>
          <span className="fw-semibold">{booking.destination}</span>
        </div>

        <div className="row g-3">
          <TicketDetail label="PNR" mono>{booking.pnr || "Not set"}</TicketDetail>
          <TicketDetail label="Distance">{formatDistance(booking.distance)}</TicketDetail>
          <TicketDetail label="Start">{formatDateTime(booking.startDateTime)}</TicketDetail>
          <TicketDetail label="Arrival">{formatDateTime(booking.arrivalDateTime)}</TicketDetail>
          <div className="col-6 col-md-3">
            <div
              style={{
                fontSize:      "0.72rem",
                textTransform: "uppercase",
                fontFamily:    "var(--font-mono)",
                color:         "var(--color-ink-soft)",
                marginBottom:  "3px",
              }}
            >
              Travel Date
            </div>
            <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>
              {formatTravelDate(booking.travelDate)}
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div
              style={{
                fontSize:      "0.72rem",
                textTransform: "uppercase",
                fontFamily:    "var(--font-mono)",
                color:         "var(--color-ink-soft)",
                marginBottom:  "3px",
              }}
            >
              Coach
            </div>
            <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>
              {booking.coach.name} · {booking.coach.type}
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div
              style={{
                fontSize:      "0.72rem",
                textTransform: "uppercase",
                fontFamily:    "var(--font-mono)",
                color:         "var(--color-ink-soft)",
                marginBottom:  "3px",
              }}
            >
              Seats
            </div>
            <div
              className="font-mono fw-semibold"
              style={{ fontSize: "0.88rem", color: "#098e17" }}
            >
              {seatDisplay || "—"}
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div
              style={{
                fontSize:      "0.72rem",
                textTransform: "uppercase",
                fontFamily:    "var(--font-mono)",
                color:         "var(--color-ink-soft)",
                marginBottom:  "3px",
              }}
            >
              Booked On
            </div>
            <div style={{ fontSize: "0.88rem", fontWeight: 600  }}>
              {formatBookingDate(booking.bookedAt)}
            </div>
          </div>
        </div>

        {booking.durationText && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px dashed #ccc" }}>
            <span
              className="font-mono"
              style={{ fontSize: "0.78rem", color: "var(--color-ink-soft)", textTransform: "uppercase" }}
            >
              Duration
            </span>
            <span className="ms-2 fw-semibold">{booking.durationText}</span>
          </div>
        )}

        {/* for the list of passengers */}
        {booking.passengers.length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px dashed #ccc" }}>
            <div
              style={{
                fontSize:      "0.80rem",
                textTransform: "uppercase",
                fontFamily:    "var(--font-mono)",
                color:         "var(--color-ink-soft)",
                marginBottom:  "6px",
              }}
            >
              Passengers
            </div>
            <div className="d-flex flex-wrap gap-2">
              {booking.passengers.map((p) => (
                <span
                  key={p.id}
                  style={{
                    display:      "inline-flex",
                    alignItems:   "center",
                    gap:          "6px",
                    padding:      "3px 12px",
                    borderRadius: "20px",
                    background:   "var(--color-white)",
                    border:       "1px solid #140202",
                    fontSize:     "0.82rem",
                    color:        "var(--color-ink)",
                  }}
                >
                  <span>{p.passengerName}</span>
                  <span style={{ color: "var(--color-ink)" }}>·</span>
                  <span style={{ color: "var(--color-ink)" }}>{p.passengerAge}y</span>
                  <span style={{ color: "var(--color-ink)" }}>·</span>
                  <span
                    className="font-mono fw-semibold"
                    style={{ color: "var(--color-success)" }}
                  >
                    CNF/{p.seatNumber}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Amount */}
        {booking.payment && booking.payment.amount > 0 && (
          <div
            className="mt-3 d-flex justify-content-between flex-wrap gap-2"
            style={{ fontSize: "0.82rem", color: "var(--color-ink-soft)" }}
          >
            <span>
              Payment ID:{" "}
              <span className="font-mono fw-semibold" style={{ color: "var(--color-ink)" }}>
                {booking.stripeId || booking.payment.stripePaymentId || "Not set"}
              </span>
            </span>
            <span>
              Amount paid:{" "}
            <span
              className="font-mono fw-semibold ms-1"
              style={{ color: "var(--color-ink)" }}
            >
              ₹{booking.payment.amount.toLocaleString("en-IN")}
            </span>
            </span>
          </div>
        )}

        <div className="mt-3 d-flex justify-content-end">
          <button
            type="button"
            className="btn btn-sm btn-amber"
            onClick={() => downloadReceipt(booking, booking.payment?.amount || 0)}
          >
            Download Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user }     = useAuth();
  const [bookings,   setBookings]  = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [error,      setError]     = useState("");

  useEffect(() => {
    apiClient
      .get("/bookings/my")
      .then(({ data }) => setBookings(data.bookings))
      .catch((err) =>
        setError(err.response?.data?.message || "Could not load bookings.")
      )
      .finally(() => setLoading(false));
  }, []);

  // Split into upcoming and completed based on travel date vs today.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const upcoming = bookings.filter(
    (b) => !b.travelDate || new Date(b.travelDate) >= todayStart
  );
  const completed = bookings.filter(
    (b) => b.travelDate && new Date(b.travelDate) < todayStart
  );

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-display mb-1">My Dashboard</h1>
          <p className="text-amber mb-0 font-mono">Welcome, {user?.username}</p>
        </div>
        <Link to="/" className="btn btn-amber">
          + Search Trains
        </Link>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="text-center py-5">
          <div
            className="spinner-border"
            role="status"
            style={{ color: "var(--color-amber)" }}
          />
        </div>
      ) : bookings.length === 0 ? (
        <div className="ticket-card">
          <div className="ticket-card__body text-center py-5">
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎫</div>
            <p className="text-muted mb-3">You have no confirmed bookings yet.</p>
            <Link to="/" className="btn btn-amber">
              Book your first journey
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* For Upcoming */}
          {upcoming.length > 0 && (
            <section className="mb-5">
              <h2
                className="font-display mb-3"
                style={{ fontSize: "1.15rem", color: "var(--color-paper)" }}
              >
                Upcoming
                <span
                  className="badge ms-2"
                  style={{
                    background:  "rgba(242,169,59,0.15)",
                    color:       "var(--color-amber)",
                    fontFamily:  "var(--font-mono)",
                    fontSize:    "0.75rem",
                    fontWeight:  700,
                    verticalAlign: "middle",
                  }}
                >
                  {upcoming.length}
                </span>
              </h2>
              {upcoming.map((b) => (
                <BookingCard key={b.id} booking={b} />
              ))}
            </section>
          )}

          {/* for completed transactions*/}
          {completed.length > 0 && (
            <section>
              <h2
                className="font-display mb-3"
                style={{ fontSize: "1.15rem", color: "var(--color-steel)" }}
              >
                Completed
                <span
                  className="badge ms-2"
                  style={{
                    background:  "rgba(111,159,201,0.15)",
                    color:       "var(--color-steel)",
                    fontFamily:  "var(--font-mono)",
                    fontSize:    "0.75rem",
                    fontWeight:  700,
                    verticalAlign: "middle",
                  }}
                >
                  {completed.length}
                </span>
              </h2>
              {completed.map((b) => (
                <BookingCard key={b.id} booking={b} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
