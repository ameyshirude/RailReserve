import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import apiClient from "../api/axiosClient";

// Initializing Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const stripeAppearance = {
  theme: "flat",
  variables: {
    colorPrimary:    "#f2a93b",
    colorBackground: "#f6f0e2",
    colorText:       "#1d2b36",
    colorDanger:     "#d9534f",
    fontFamily:      "Inter, system-ui, sans-serif",
    borderRadius:    "6px",
  },
  rules: {
    ".Input": {
      border:    "1px solid #dee2e6",
      boxShadow: "none",
    },
    ".Input:focus": {
      border:    "1px solid #f2a93b",
      boxShadow: "0 0 0 0.2rem rgba(242,169,59,0.25)",
    },
    ".Label": {
      fontFamily:    "var(--font-mono)",
      fontWeight:    "600",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      fontSize:      "0.75rem",
      color:         "#4a5a68",
    },
  },
};

// Stripe payment form
function PaymentForm({ amount, bookingId, onSuccess }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [paying,              setPaying]              = useState(false);
  const [payError,            setPayError]            = useState("");
  const [paymentElementReady, setPaymentElementReady] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements || !paymentElementReady) return;
    setPayError("");
    setPaying(true);

    let result;
    try {
      result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // for redirect based payment methods
          return_url: `${window.location.origin}/dashboard`,
        },
        redirect: "if_required", // for standard card payments
      });
    } catch (err) {
      setPayError(err.message || "Payment form is still loading. Please try again.");
      setPaying(false);
      return;
    }

    const { error, paymentIntent } = result;

    if (error) {
      setPayError(error.message);
      setPaying(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      try {
        await apiClient.post("/bookings/verify-payment", {
          bookingId,
          paymentIntentId: paymentIntent.id,
        });
        onSuccess();
      } catch (err) {
        setPayError(
          err.response?.data?.message || "Payment verified but server update failed."
        );
        setPaying(false);
      }
    } else {
      setPayError("Payment was not completed. Please try again.");
      setPaying(false);
    }
  };

  return (
    <>
      <PaymentElement
        onReady={() => setPaymentElementReady(true)}
        onLoadError={(event) => {
          setPayError(event.error?.message || "Payment form failed to load. Try refreshing the page."); 
        }}
      />
      {payError && (
        <div className="alert alert-danger mt-3 mb-0" style={{ fontSize: "0.88rem" }}>
          {payError}
        </div>
      )}
      <button
        type="button"
        className="btn btn-amber w-100 mt-3"
        onClick={handlePay}
        disabled={!stripe || !elements || !paymentElementReady || paying}
      >
        {paying
          ? "Processing…"
          : paymentElementReady
          ? `Pay ₹${amount.toLocaleString("en-IN")}`
          : "Loading payment form…"}
      </button>
    </>
  );
}

// Receipt downloader
export function downloadReceipt(booking, amount) {
  const fmt = (iso) =>
    new Date(iso).toLocaleString("en-IN", {
      weekday: "short", year: "numeric", month: "short",
      day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const passengerRows = booking.passengers
    .map(
      (p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${p.passengerName}</td>
        <td>${p.passengerAge}</td>
        <td><strong>${p.seatNumber}</strong></td>
      </tr>`
    )
    .join("");

    // html and css for the receipt
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RailReserve — Booking #${booking.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; max-width: 680px; margin: 40px auto; padding: 0 20px; color: #1d2b36; }
    .header { background: #11212f; color: #f2a93b; padding: 28px 32px; border-radius: 12px 12px 0 0; }
    .header h1 { font-size: 1.4rem; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 4px; }
    .header p  { color: #6f9fc9; font-size: 0.9rem; }
    .perf { border-top: 2.5px dashed #ccc; margin: 0; }
    .body { background: #f6f0e2; padding: 28px 32px; border-radius: 0 0 12px 12px; }
    .booking-id { font-family: 'Courier New', monospace; font-size: 1.3rem; font-weight: 700; letter-spacing: 0.06em; margin-bottom: 22px; color: #11212f; }
    h3 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: #4a5a68; margin: 20px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    th, td { padding: 9px 12px; border: 1px solid #ddd; font-size: 0.88rem; text-align: left; }
    th { background: #ebe0c8; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: #4a5a68; }
    .paid { color: #4c9a6a; font-weight: 700; }
    .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 0.78rem; color: #4a5a68; text-align: center; line-height: 1.6; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚆 RailReserve</h1>
    <p>Booking Confirmation Receipt</p>
  </div>
  <div class="perf"></div>
  <div class="body">
    <div class="booking-id">BOOKING #${String(booking.id).padStart(6, "0")}</div>

    <h3>Journey Details</h3>
    <table>
      <tbody>
        <tr><th style="width:38%">Train</th><td>${booking.train.name} (${booking.train.number})</td></tr>
        <tr><th>Coach</th><td>${booking.coach.name}</td></tr>
        <tr><th>Boarding</th><td>${booking.boarding}</td></tr>
        <tr><th>Destination</th><td>${booking.destination}</td></tr>
        <tr><th>Travel Date</th><td>${booking.travelDate ? fmt(booking.travelDate) : "Not set"}</td></tr>
        <tr><th>Booking Date</th><td>${fmt(booking.bookedAt)}</td></tr>
      </tbody>
    </table>

    <h3>Passengers</h3>
    <table>
      <thead>
        <tr><th>#</th><th>Name</th><th>Age</th><th>Seat</th></tr>
      </thead>
      <tbody>${passengerRows}</tbody>
    </table>

    <h3>Payment</h3>
    <table>
      <tbody>
        <tr><th style="width:38%">Amount Paid</th><td>₹${amount.toLocaleString("en-IN")}</td></tr>
        <tr><th>Currency</th><td>INR</td></tr>
        <tr><th>Status</th><td class="paid">✓ PAID</td></tr>
      </tbody>
    </table>

    <div class="footer">
      <p>Thank you for choosing RailReserve. Have a safe journey!</p>
      <p>This is a computer-generated receipt and does not require a signature.</p>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `RailReserve-Receipt-${booking.id}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

//modal for coach selection, then passenger details, then stripe payment and receipt download
export default function BookingFlowModal({ train, boarding, destination, travelDate, onClose }) {
  const navigate = useNavigate();

  // coach selection state
  const [coaches,       setCoaches]       = useState([]);
  const [loadingCoaches, setLoadingCoaches] = useState(true);
  const [coachError,    setCoachError]    = useState("");
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [passengerCount, setPassengerCount] = useState(1);
  const [reserveError,  setReserveError]  = useState("");
  const [reserving,     setReserving]     = useState(false);

  // details state
  const [reservation,  setReservation]  = useState(null);
  const [passengers,   setPassengers]   = useState([]);
  const [secondsLeft,  setSecondsLeft]  = useState(600);
  const [confirmError, setConfirmError] = useState("");
  const [confirming,   setConfirming]   = useState(false);
  const timerRef = useRef(null);

  // payment state
  const [clientSecret, setClientSecret] = useState("");
  const [amount,       setAmount]       = useState(0);

  // receipt state
  const [booking, setBooking] = useState(null);

  const [step, setStep] = useState(1);

  // Load coaches
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get(`/trains/${train.id}/coaches`, { params: { date: travelDate } })
      .then(({ data }) => { if (!cancelled) setCoaches(data.coaches); })
      .catch(() => { if (!cancelled) setCoachError("Failed to load coach availability."); })
      .finally(() => { if (!cancelled) setLoadingCoaches(false); });
    return () => { cancelled = true; };
  }, [train.id, travelDate]);

  // 10-minute countdown
  useEffect(() => {
    if (step !== 2 || !reservation) return;
    const remaining = Math.max(
      0,
      Math.floor((new Date(reservation.expiresAt) - Date.now()) / 1000)
    );
    setSecondsLeft(remaining);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(timerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step, reservation]);

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleReserve = async () => {
    if (!selectedCoach) return;
    setReserveError("");
    setReserving(true);
    try {
      const { data } = await apiClient.post("/bookings/reserve", {
        coachId: selectedCoach.id,
        count:   passengerCount,
        travelDate,
      });
      setReservation(data);
      setPassengers(Array.from({ length: passengerCount }, () => ({ name: "", age: "" })));
      setStep(2);
    } catch (err) {
      setReserveError(
        err.response?.data?.message || "Could not reserve seats. Please try again."
      );
    } finally {
      setReserving(false);
    }
  };

  const updatePassenger = (i, field, val) =>
    setPassengers((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, [field]: val } : p))
    );

  const handleProceedToPayment = async () => {
    if (secondsLeft === 0) {
      setConfirmError("Session expired. Please go back and select seats again.");
      return;
    }
    setConfirmError("");
    setConfirming(true);
    try {
      const { data } = await apiClient.post("/bookings/confirm", {
        reservationId: reservation.reservationId,
        boarding,
        destination,
        travelDate: travelDate || null,
        passengers: passengers.map((p) => ({
          name: p.name.trim(),
          age:  Number(p.age),
        })),
      });

      clearInterval(timerRef.current);
      setBooking(data.booking);
      setAmount(data.amount);

      if (data.requiresPayment) {
        setClientSecret(data.clientSecret);
        setStep(3);
      } else {
        setStep(4);
      }
    } catch (err) {
      setConfirmError(
        err.response?.data?.message || "Booking failed. Please try again."
      );
    } finally {
      setConfirming(false);
    }
  };

  const handleClose = () => {
    clearInterval(timerRef.current);
    onClose();
  };

  const handleDone = () => {
    handleClose();
    navigate("/dashboard");
  };

  const STEPS = ["Select Coach", "Passenger Details", "Payment", "Confirmed"];

  return (
    <>
      <div
        className="modal-backdrop fade show"
        onClick={step === 4 ? handleDone : undefined}
        style={{ zIndex: 1050 }}
      />
      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div
            className="modal-content"
            style={{ background: "var(--color-paper)", color: "var(--color-ink)" }}
          >
            {/* header of the MODAL*/}
            <div
              className="modal-header"
              style={{
                background:   "var(--color-navy-2)",
                color:        "var(--color-paper)",
                borderBottom: "2px solid var(--color-amber)",
              }}
            >
              <div>
                <h5 className="modal-title font-display mb-0">{train.name}</h5>
                <small style={{ color: "var(--color-steel)", fontFamily: "var(--font-mono)" }}>
                  {boarding} → {destination}&nbsp;·&nbsp;#{train.number}
                </small>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={handleClose}
                aria-label="Close"
              />
            </div>

            {/* Step indicator */}
            <div
              style={{
                background: "var(--color-navy-3)",
                padding:    "0.5rem 1.5rem",
                display:    "flex",
                gap:        "1.25rem",
              }}
            >
              {STEPS.map((label, i) => (
                <span
                  key={label}
                  className="font-mono"
                  style={{
                    fontSize:      "0.72rem",
                    textTransform: "uppercase",
                    color:         step === i + 1 ? "var(--color-amber)" : "var(--color-steel)",
                    fontWeight:    step === i + 1 ? 700 : 400,
                  }}
                >
                  {i + 1}. {label}
                </span>
              ))}
            </div>

            <div className="modal-body">
              {/* STEP 1: Coach selection */}
              {step === 1 && (
                <>
                  {loadingCoaches && (
                    <div className="text-center py-4">
                      <div
                        className="spinner-border"
                        style={{ color: "var(--color-amber)" }}
                        role="status"
                      />
                    </div>
                  )}
                  {coachError && <div className="alert alert-danger">{coachError}</div>}

                  {!loadingCoaches && coaches.length === 0 && (
                    <p className="text-muted text-center py-3">
                      No coaches available for this train.
                    </p>
                  )}

                  {!loadingCoaches && coaches.length > 0 && (
                    <>
                      <h6 className="font-display mb-3">Choose a Coach</h6>
                      <div className="row g-2 mb-4">
                        {coaches.map((coach) => {
                          const isSelected = selectedCoach?.id === coach.id;
                          const isFull     = coach.availableSeats === 0;
                          return (
                            <div className="col-6 col-md-4 col-lg-3" key={coach.id}>
                              <div
                                className="p-3 rounded text-center"
                                style={{
                                  border:     `2px solid ${isSelected ? "var(--color-amber)" : "#ddd"}`,
                                  background: isSelected
                                    ? "rgba(242,169,59,0.1)"
                                    : "var(--color-paper-dark)",
                                  cursor:  isFull ? "not-allowed" : "pointer",
                                  opacity: isFull ? 0.5 : 1,
                                }}
                                onClick={() => { if (!isFull) setSelectedCoach(coach); }}
                              >
                                <div
                                  className="font-mono fw-bold"
                                  style={{ fontSize: "1.2rem", color: "var(--color-ink)" }}
                                >
                                  {coach.name}
                                </div>
                                <div
                                  style={{ fontSize: "0.78rem", color: "var(--color-success)", margin: "2px 0" }}
                                >
                                  {coach.availableSeats}/{coach.totalSeats} free
                                </div>
                                {coach.price > 0 ? (
                                  <div
                                    className="font-mono"
                                    style={{ fontSize: "0.8rem", color: "var(--color-amber)", fontWeight: 600 }}
                                  >
                                    ₹{coach.price.toLocaleString("en-IN")}/seat
                                  </div>
                                ) : (
                                  <div style={{ fontSize: "0.78rem", color: "var(--color-success)" }}>
                                    Free
                                  </div>
                                )}
                                {isFull && (
                                  <div style={{ fontSize: "0.72rem", color: "var(--color-danger)" }}>
                                    FULL
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {selectedCoach && (
                        <>
                          <div
                            className="p-3 rounded mb-3"
                            style={{ background: "var(--color-paper-dark)", border: "1px solid #ddd" }}
                          >
                            <label
                              className="form-label"
                              style={{
                                fontFamily:    "var(--font-mono)",
                                fontSize:      "0.78rem",
                                textTransform: "uppercase",
                              }}
                            >
                              Number of Passengers (max {selectedCoach.availableSeats})
                            </label>
                            <input
                              type="number"
                              className="form-control"
                              value={passengerCount}
                              min={1}
                              max={selectedCoach.availableSeats}
                              onChange={(e) =>
                                setPassengerCount(
                                  Math.max(
                                    1,
                                    Math.min(selectedCoach.availableSeats, Number(e.target.value))
                                  )
                                )
                              }
                            />
                            {selectedCoach.price > 0 && (
                              <div
                                className="mt-2 font-mono fw-semibold"
                                style={{ color: "var(--color-amber)" }}
                              >
                                Total:{" "}
                                ₹{(selectedCoach.price * passengerCount).toLocaleString("en-IN")}
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {reserveError && (
                        <div className="alert alert-danger">{reserveError}</div>
                      )}

                      <button
                        className="btn btn-amber w-100"
                        disabled={!selectedCoach || reserving}
                        onClick={handleReserve}
                      >
                        {reserving
                          ? "Reserving…"
                          : `Reserve ${passengerCount} Seat${passengerCount > 1 ? "s" : ""} in ${selectedCoach?.name ?? ""}`}
                      </button>
                    </>
                  )}
                </>
              )}

              {/* STEP 2: Passenger details*/}
              {step === 2 && (
                <>
                  {/* session countdown timer */}
                  <div
                    className="d-flex align-items-center gap-3 mb-4 p-3 rounded"
                    style={{
                      background: secondsLeft <= 60
                        ? "rgba(217,83,79,0.08)"
                        : "rgba(242,169,59,0.08)",
                      border: `1px solid ${secondsLeft <= 60 ? "var(--color-danger)" : "var(--color-amber)"}`,
                    }}
                  >
                    <div
                      className="font-mono fw-bold"
                      style={{
                        fontSize: "1.6rem",
                        color: secondsLeft <= 60 ? "var(--color-danger)" : "var(--color-amber)",
                      }}
                    >
                      {fmt(secondsLeft)}
                    </div>
                    <div>
                      <div className="fw-semibold" style={{ color: "var(--color-ink)" }}>
                        Seats reserved in Coach {selectedCoach?.name}
                      </div>
                      <div className="small text-muted">
                        Seats: {reservation.seatNumbers.join(", ")}
                        &nbsp;·&nbsp;Complete booking before time runs out.
                      </div>
                    </div>
                  </div>

                  <h6 className="font-display mb-3">Passenger Details</h6>
                  {passengers.map((p, i) => (
                    <div
                      key={i}
                      className="p-3 rounded mb-2"
                      style={{ background: "var(--color-paper-dark)", border: "1px solid #ddd" }}
                    >
                      <div className="row g-2 align-items-end">
                        <div className="col-1 text-center">
                          <span
                            className="font-mono fw-bold"
                            style={{ color: "var(--color-ink-soft)" }}
                          >
                            {i + 1}
                          </span>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small mb-1">Full Name</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={p.name}
                            onChange={(e) => updatePassenger(i, "name", e.target.value)}
                            placeholder="Passenger name"
                            required
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small mb-1">Age</label>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            value={p.age}
                            onChange={(e) => updatePassenger(i, "age", e.target.value)}
                            placeholder="Age"
                            min="1"
                            max="120"
                            required
                          />
                        </div>
                        <div className="col-md-2">
                          <div className="text-muted small">
                            Seat {reservation.seatNumbers[i]}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {selectedCoach?.price > 0 && (
                    <div
                      className="d-flex justify-content-between align-items-center p-3 rounded mt-3"
                      style={{ background: "rgba(242,169,59,0.08)", border: "1px solid var(--color-amber)" }}
                    >
                      <span style={{ color: "var(--color-ink)" }}>
                        {passengers.length} seat{passengers.length > 1 ? "s" : ""} ×{" "}
                        ₹{selectedCoach.price.toLocaleString("en-IN")}
                      </span>
                      <span
                        className="font-mono fw-bold"
                        style={{ fontSize: "1.15rem", color: "var(--color-amber)" }}
                      >
                        ₹{(selectedCoach.price * passengers.length).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  {confirmError && (
                    <div className="alert alert-danger mt-3">{confirmError}</div>
                  )}

                  <div className="d-flex gap-2 mt-3">
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() => {
                        clearInterval(timerRef.current);
                        setStep(1);
                        setReservation(null);
                        setReserveError("");
                      }}
                    >
                      ← Back
                    </button>
                    <button
                      className="btn btn-amber flex-fill"
                      disabled={
                        confirming ||
                        secondsLeft === 0 ||
                        passengers.some((p) => !p.name.trim() || !p.age)
                      }
                      onClick={handleProceedToPayment}
                    >
                      {confirming
                        ? "Preparing…"
                        : secondsLeft === 0
                        ? "Reservation Expired"
                        : selectedCoach?.price > 0
                        ? `Proceed to Payment — ₹${(selectedCoach.price * passengers.length).toLocaleString("en-IN")}`
                        : "Confirm Free Booking"}
                    </button>
                  </div>
                </>
              )}

              {/* 3. Payment*/}
              {step === 3 && clientSecret && (
                <>
                  <div
                    className="d-flex justify-content-between align-items-center mb-4 p-3 rounded"
                    style={{ background: "rgba(242,169,59,0.08)", border: "1px solid var(--color-amber)" }}
                  >
                    <span style={{ color: "var(--color-ink)", fontWeight: 600 }}>
                      Amount to pay
                    </span>
                    <span
                      className="font-mono fw-bold"
                      style={{ fontSize: "1.3rem", color: "var(--color-amber)" }}
                    >
                      ₹{amount.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <Elements
                    key={clientSecret}
                    stripe={stripePromise}
                    options={{ clientSecret, appearance: stripeAppearance }}
                  >
                    <PaymentForm
                      amount={amount}
                      bookingId={booking.id}
                      onSuccess={() => setStep(4)}
                    />
                  </Elements>
                </>
              )}

              {/* 4. Confrimation receipt */}
              {step === 4 && booking && (
                <>
                  <div className="text-center py-3 mb-4">
                    <div style={{ fontSize: "3.5rem" }}>🎫</div>
                    <h4
                      className="font-display mt-2"
                      style={{ color: "var(--color-success)" }}
                    >
                      Booking Confirmed!
                    </h4>
                    <p className="text-muted small mb-0">
                      Booking #{String(booking.id).padStart(6, "0")}
                    </p>
                  </div>

                  <table
                    className="table table-bordered table-sm mb-3"
                    style={{ fontSize: "0.88rem" }}
                  >
                    <tbody>
                      <tr>
                        <td className="fw-semibold text-muted" style={{ width: "38%" }}>Train</td>
                        <td>{booking.train.name} (#{booking.train.number})</td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-muted">Coach</td>
                        <td>{booking.coach.name}</td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-muted">Boarding</td>
                        <td>{booking.boarding}</td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-muted">Destination</td>
                        <td>{booking.destination}</td>
                      </tr>
                      {amount > 0 && (
                        <tr>
                          <td className="fw-semibold text-muted">Amount Paid</td>
                          <td className="font-mono" style={{ color: "var(--color-success)" }}>
                            ✓ ₹{amount.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <h6 className="font-display mb-2">Passengers</h6>
                  <table
                    className="table table-striped table-sm mb-4"
                    style={{ fontSize: "0.88rem" }}
                  >
                    <thead>
                      <tr>
                        <th style={{ fontFamily: "var(--font-mono)", fontSize: "0.73rem", textTransform: "uppercase" }}>Name</th>
                        <th style={{ fontFamily: "var(--font-mono)", fontSize: "0.73rem", textTransform: "uppercase" }}>Age</th>
                        <th style={{ fontFamily: "var(--font-mono)", fontSize: "0.73rem", textTransform: "uppercase" }}>Seat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {booking.passengers.map((p) => (
                        <tr key={p.id}>
                          <td>{p.passengerName}</td>
                          <td>{p.passengerAge}</td>
                          <td className="font-mono fw-semibold">{p.seatNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* download receipt button*/}
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-outline-secondary flex-fill"
                      onClick={handleDone}
                    >
                      Done
                    </button>    {/* Done button */}
                    <button
                      className="btn btn-amber flex-fill"
                      onClick={() => downloadReceipt(booking, amount)}
                    >
                      ⬇ Download Receipt
                    </button>    {/* Download button */}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
