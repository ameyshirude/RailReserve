import React, { useMemo, useState } from "react";
import PassengerDetailModal from "./PassengerDetailModal";

// payment status badge
function PaymentBadge({ payment }) {
  if (!payment) {
    return (
      <span
        className="badge"
        style={{ background: "#aaa", color: "#fff", fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}
      >
        No Payment
      </span>
    );
  }

  const cfg = {
    PAID:     { bg: "rgba(76,154,106,0.12)",   color: "#4c9a6a", icon: "✓",  label: "Paid" },
    PENDING:  { bg: "rgba(242,169,59,0.12)",    color: "#d88e1f", icon: "⏳", label: "Pending" },
    FAILED:   { bg: "rgba(217,83,79,0.12)",     color: "#d9534f", icon: "✗",  label: "Failed" },
    REFUNDED: { bg: "rgba(111,159,201,0.12)",   color: "#4a7fa8", icon: "↩",  label: "Refunded" },
  };
  const { bg, color, icon, label } = cfg[payment.status] ?? cfg.PENDING;

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
      <span
        style={{
          display:        "inline-flex",
          alignItems:     "center",
          gap:            "4px",
          padding:        "2px 10px",
          borderRadius:   "12px",
          background:     bg,
          color,
          fontSize:       "0.78rem",
          fontWeight:     700,
          fontFamily:     "var(--font-mono)",
          whiteSpace:     "nowrap",
        }}
      >
        {icon} {label}
      </span>
      {payment.amount > 0 && (
        <span
          className="font-mono"
          style={{ fontSize: "0.75rem", color: "var(--color-ink-soft)" }}
        >
          ₹{payment.amount.toLocaleString("en-IN")}
        </span>
      )}
    </div>
  );
}

export default function BookingsModal({ show, onClose, bookings, loading }) {
  // keeping a local copy of refund payment status
  const [localBookings, setLocalBookings] = useState(bookings);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [pnrSearch, setPnrSearch] = useState("");

  // for sync
  React.useEffect(() => {
    setLocalBookings(bookings);
  }, [bookings]);

  // Called by PassengerDetailModal after a successful refund
  const handleRefund = (bookingId, updatedPayment) => {
    setLocalBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, payment: updatedPayment } : b))
    );
    setSelectedBooking((prev) =>
      prev?.id === bookingId ? { ...prev, payment: updatedPayment } : prev
    );
  };

  const grouped = useMemo(() => {
    const map = {};
    const query = pnrSearch.trim().toUpperCase();
    localBookings
      .filter((b) => !query || String(b.pnr || "").toUpperCase().includes(query))
      .forEach((b) => {
      const dateKey = new Date(b.bookedAt).toLocaleDateString("en-CA");
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(b);
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [localBookings, pnrSearch]);

  if (!show) return null;

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const formatDateLabel = (dateKey) =>
    new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-IN", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

  return (
    <>
      <div
        className="modal-backdrop fade show"
        onClick={onClose}
        style={{ zIndex: 1050 }}
      />
      <div
        className="modal fade show d-block"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        style={{ zIndex: 1055 }}
      >
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div
            className="modal-content"
            style={{ background: "var(--color-paper)", color: "var(--color-ink)" }}
          >
            <div
              className="modal-header"
              style={{
                background:   "var(--color-navy-2)",
                color:        "var(--color-paper)",
                borderBottom: "2px solid var(--color-amber)",
              }}
            >
              <h5 className="modal-title font-display">All Bookings</h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                aria-label="Close"
              />
            </div>

            <div className="modal-body p-0">
              <div className="p-3 border-bottom" style={{ background: "var(--color-paper-dark)" }}>
                <label
                  className="form-label mb-1"
                  htmlFor="booking-pnr-search"
                  style={{
                    fontFamily:    "var(--font-mono)",
                    fontSize:      "0.75rem",
                    textTransform: "uppercase",
                    color:         "var(--color-ink-soft)",
                  }}
                >
                  Search by PNR
                </label>
                <input
                  id="booking-pnr-search"
                  type="search"
                  className="form-control"
                  value={pnrSearch}
                  onChange={(e) => setPnrSearch(e.target.value)}
                  placeholder="Enter PNR"
                />
              </div>
              {loading && (
                <div className="d-flex justify-content-center align-items-center py-5">
                  <div
                    className="spinner-border"
                    role="status"
                    style={{ color: "var(--color-amber)" }}
                  >
                    <span className="visually-hidden">Loading…</span>
                  </div>
                </div>
              )}

              {!loading && grouped.length === 0 && (
                <p className="text-center text-muted py-5 mb-0">
                  {pnrSearch.trim() ? "No bookings match that PNR." : "No bookings have been made yet."}
                </p>
              )}

              {!loading && grouped.length > 0 && (
                <div className="accordion accordion-flush" id="bookingsAccordion">
                  {grouped.map(([dateKey, dayBookings], idx) => (
                    <div className="accordion-item" key={dateKey}>
                      <h2 className="accordion-header">
                        <button
                          className={`accordion-button${idx !== 0 ? " collapsed" : ""}`}
                          type="button"
                          data-bs-toggle="collapse"
                          data-bs-target={`#collapse-${dateKey}`}
                          aria-expanded={idx === 0 ? "true" : "false"}
                          aria-controls={`collapse-${dateKey}`}
                        >
                          <span className="fw-semibold me-2">
                            {formatDateLabel(dateKey)}
                          </span>
                          <span className="badge bg-secondary">
                            {dayBookings.length}{" "}
                            {dayBookings.length === 1 ? "booking" : "bookings"}
                          </span>
                        </button>
                      </h2>

                      <div
                        id={`collapse-${dateKey}`}
                        className={`accordion-collapse collapse${idx === 0 ? " show" : ""}`}
                        data-bs-parent="#bookingsAccordion"
                      >
                        <div className="accordion-body p-0">
                          <ul className="list-group list-group-flush">
                            {dayBookings.map((booking) => (
                              <li
                                key={booking.id}
                                className="list-group-item list-group-item-action"
                                style={{
                                  cursor: "pointer",
                                  background: booking.status === "CANCELLED" ? "rgba(217,83,79,0.04)" : undefined,
                                }}
                                onClick={() => setSelectedBooking(booking)}
                                title="Click to view details"
                              >
                                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                  
                                  <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <span
                                      className="font-mono"
                                      style={{
                                        color:    "var(--color-ink-soft)",
                                        fontSize: "0.82rem",
                                        minWidth: "56px",
                                      }}
                                    >
                                      {formatTime(booking.bookedAt)}
                                    </span>
                                    <span className="font-mono fw-semibold" style={{ fontSize: "0.82rem" }}>
                                      {booking.pnr || "No PNR"}
                                    </span>
                                    <span className="fw-semibold">{booking.user?.username}</span>
                                    <span style={{ color: "var(--color-ink-soft)" }}>·</span>
                                    <span style={{ color: "var(--color-ink-soft)", fontSize: "0.88rem" }}>
                                      {booking.train?.name} ({booking.train?.number})
                                    </span>
                                    <span style={{ color: "var(--color-ink-soft)" }}>·</span>
                                    <span style={{ fontSize: "0.82rem", color: "var(--color-ink-soft)" }}>
                                      Coach {booking.coach?.name}
                                      {booking.coach?.type ? ` · ${booking.coach.type}` : ""}
                                    </span>
                                    <span style={{ color: "var(--color-ink-soft)" }}>·</span>
                                    <span style={{ fontSize: "0.82rem", color: "var(--color-ink-soft)" }}>
                                      {booking.boarding} → {booking.destination}
                                    </span>
                                  </div>

                                  {/* passenger count and payment badge */}
                                  <div className="d-flex align-items-center gap-2">
                                    <span
                                      className="badge"
                                      style={{
                                        background:  "var(--color-navy-3)",
                                        color:       "var(--color-paper)",
                                        fontFamily:  "var(--font-mono)",
                                        fontSize:    "0.72rem",
                                      }}
                                    >
                                      {booking.passengers?.length ?? 0} pax
                                    </span>
                                    {booking.status === "CANCELLED" && (
                                      <span
                                        style={{
                                          display:      "inline-flex",
                                          alignItems:   "center",
                                          padding:      "2px 10px",
                                          borderRadius: "12px",
                                          background:   "rgba(217,83,79,0.1)",
                                          color:        "#d9534f",
                                          fontSize:     "0.72rem",
                                          fontWeight:   700,
                                          fontFamily:   "var(--font-mono)",
                                          border:       "1px solid rgba(217,83,79,0.3)",
                                        }}
                                      >
                                        ✗ CANCELLED
                                      </span>
                                    )}
                                    <PaymentBadge payment={booking.payment} />
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <PassengerDetailModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onRefund={handleRefund}
      />
    </>
  );
}
