import React, { useState } from "react";
import apiClient from "../api/axiosClient";

function PaymentStatusBadge({ status }) {
  const cfg = {
    PAID:     { bg: "rgba(76,154,106,0.12)",  color: "#4c9a6a", icon: "✓",  label: "Paid" },
    PENDING:  { bg: "rgba(242,169,59,0.12)",   color: "#d88e1f", icon: "⏳", label: "Pending" },
    FAILED:   { bg: "rgba(217,83,79,0.12)",    color: "#d9534f", icon: "✗",  label: "Failed" },
    REFUNDED: { bg: "rgba(111,159,201,0.12)",  color: "#4a7fa8", icon: "↩",  label: "Refunded" },
  };
  const { bg, color, icon, label } = cfg[status] ?? cfg.PENDING;

  return (
    <span
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        gap:          "5px",
        padding:      "3px 12px",
        borderRadius: "12px",
        background:   bg,
        color,
        fontWeight:   700,
        fontFamily:   "var(--font-mono)",
        fontSize:     "0.82rem",
      }}
    >
      {icon} {label}
    </span>
  );
}

export default function PassengerDetailModal({ booking, onClose, onRefund }) {
  const [refunding,    setRefunding]    = useState(false);
  const [refundError,  setRefundError]  = useState("");
  const [refundSuccess, setRefundSuccess] = useState(false);

  if (!booking) return null;

  const formatDateTime = (iso) =>
    new Date(iso).toLocaleString("en-IN", {
      weekday: "short", year: "numeric", month: "short",
      day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const handleRefund = async () => {
    setRefundError("");
    setRefunding(true);
    try {
      const { data } = await apiClient.post("/bookings/refund", { bookingId: booking.id });
      setRefundSuccess(true);
      if (onRefund) onRefund(booking.id, data.payment);
    } catch (err) {
      setRefundError(err.response?.data?.message || "Refund failed. Please try again.");
    } finally {
      setRefunding(false);
    }
  };

  const summaryRows = [
    { field: "Username",    value: booking.user?.username },
    { field: "Email",       value: booking.user?.email },
    { field: "Phone",       value: booking.user?.phone },
    { field: "Train",       value: `${booking.train?.name} (${booking.train?.number})` },
    {
      field: "Coach",
      value: [booking.coach?.name, booking.coach?.type].filter(Boolean).join(" · "),
    },
    { field: "Boarding",    value: booking.boarding ?? "—" },
    { field: "Destination", value: booking.destination ?? "—" },
    { field: "Status",      value: booking.status ?? "CONFIRMED" },
    { field: "Booked On",   value: formatDateTime(booking.bookedAt) },
  ];

  const thStyle = {
    fontFamily:    "var(--font-mono)",
    fontSize:      "0.78rem",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background:    "var(--color-paper-dark)",
    color:         "var(--color-ink)",
  };

  return (
    <>
      {/* Layer-2 backdrop */}
      <div
        className="modal-backdrop fade show"
        onClick={onClose}
        style={{ zIndex: 1060 }}
      />

      {/* Layer-2 modal */}
      <div
        className="modal fade show d-block"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        style={{ zIndex: 1065 }}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div
            className="modal-content ticket-card"
            style={{ background: "var(--color-paper)", color: "var(--color-ink)" }}
          >
            {/* Header */}
            <div
              className="modal-header ticket-card__header"
              style={{ borderBottom: "none" }}
            >
              <h5 className="modal-title font-display mb-0">Booking Details</h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                aria-label="Close"
              />
            </div>

            <div className="ticket-perforation" />

            <div className="modal-body ticket-card__body p-0">
              {/* ── Booking summary ──────────────────────────── */}
              <table className="table table-bordered mb-0" style={{ fontSize: "0.88rem" }}>
                <tbody>
                  {summaryRows.map(({ field, value }) => (
                    <tr key={field}>
                      <td style={{ ...thStyle, width: "34%" }}>{field}</td>
                      <td
                        style={{
                          color:      field === "Status"
                                        ? (value === "CANCELLED" ? "#d9534f" : "#4c9a6a")
                                        : "var(--color-ink)",
                          fontWeight: field === "Status" ? 700 : "normal",
                          wordBreak:  "break-all",
                        }}
                      >
                        {field === "Status"
                          ? (value === "CANCELLED" ? "✗ Cancelled" : "✓ Confirmed")
                          : (value ?? "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ── Payment section ──────────────────────────── */}
              <div className="p-3" style={{ borderTop: "1px solid #ddd" }}>
                <h6 className="font-display mb-3" style={{ fontSize: "0.9rem" }}>
                  Payment
                </h6>

                {!booking.payment ? (
                  <p className="text-muted small mb-0">No payment record found.</p>
                ) : (
                  <>
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                      <div>
                        <div style={{ fontSize: "0.78rem", color: "var(--color-ink-soft)", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
                          Amount
                        </div>
                        <div
                          className="font-mono fw-bold"
                          style={{ fontSize: "1.2rem", color: "var(--color-ink)" }}
                        >
                          {booking.payment.amount > 0
                            ? `₹${booking.payment.amount.toLocaleString("en-IN")}`
                            : "Free"}
                        </div>
                      </div>
                      <PaymentStatusBadge status={booking.payment.status} />
                    </div>

                    {booking.payment.stripePaymentId && (
                      <div
                        className="font-mono mb-2"
                        style={{ fontSize: "0.72rem", color: "var(--color-ink-soft)" }}
                      >
                        Stripe ID:{" "}
                        {booking.payment.stripePaymentId.slice(0, 26)}…
                      </div>
                    )}

                    {/* Refund controls */}
                    {booking.status != "CANCELLED" && booking.payment.status === "PAID" && !refundSuccess && (
                      <>
                        {refundError && (
                          <div className="alert alert-danger py-2 px-3 small mb-2">
                            {refundError}
                          </div>
                        )}
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={handleRefund}
                          disabled={refunding}
                        >
                          {refunding ? "Processing Refund…" : "↩ Process Refund"}
                        </button>
                      </>
                    )}

                    {(booking.payment.status === "REFUNDED" || refundSuccess) && (
                      <div
                        className="d-inline-flex align-items-center gap-1 px-3 py-1 rounded"
                        style={{ background: "rgba(111,159,201,0.12)", color: "#4a7fa8", fontSize: "0.82rem", fontWeight: 600 }}
                      >
                        ↩ Refund processed
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ── Passengers ───────────────────────────────── */}
              {booking.status !== "CANCELLED" && booking.passengers && booking.passengers.length > 0 && (
                <div className="p-3" style={{ borderTop: "1px solid #ddd" }}>
                  <h6 className="font-display mb-2" style={{ fontSize: "0.9rem" }}>
                    Passengers
                  </h6>
                  <table
                    className="table table-striped table-sm mb-0"
                    style={{ fontSize: "0.88rem" }}
                  >
                    <thead>
                      <tr>
                        <th style={thStyle}>#</th>
                        <th style={thStyle}>Name</th>
                        <th style={thStyle}>Age</th>
                        <th style={thStyle}>Seat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {booking.passengers.map((p, i) => (
                        <tr key={p.id}>
                          <td className="font-mono">{i + 1}</td>
                          <td>{p.passengerName}</td>
                          <td>{p.passengerAge}</td>
                          <td className="font-mono fw-semibold">{p.seatNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {booking.status === "CANCELLED" && booking.cancelledSeats && (
                <div className="p-3" style={{ borderTop: "1px solid #ddd" }}>
                  <h6 className="font-display mb-2" style={{ fontSize: "0.9rem", color: "#d9534f" }}>
                    Attempted Seats (Released)
                  </h6>
                  <p className="text-muted small mb-1">
                    These seats were reserved but the session expired before payment was completed.
                  </p>
                  <div className="font-mono fw-semibold" style={{ color: "var(--color-ink)" }}>
                    {JSON.parse(booking.cancelledSeats).join(", ")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
