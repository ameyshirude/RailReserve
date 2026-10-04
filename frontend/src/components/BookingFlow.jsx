import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Elements } from "@stripe/react-stripe-js";
import { toast } from "react-toastify";
import apiClient from "../api/axiosClient";

import PaymentForm, { stripePromise, stripeAppearance } from "./PaymentForm";
import { downloadReceipt } from "../utils/downloadReceipt";
import { formatJourneyDate } from "../utils/bookingRoute";
import { readBookingDraft, saveBookingDraft, reservationSecondsLeft } from "../utils/bookingDraft";

// Routed booking flow. Seat holds and payment state survive a refresh in this tab.
export default function BookingFlow({ train, boarding, destination, travelDate, draftKey }) {
  const navigate = useNavigate();
  const [draft] = useState(() => readBookingDraft(draftKey));
  const headingRef = useRef(null);
  const [summaryOpen, setSummaryOpen] = useState(() => window.innerWidth >= 992);
  const [availabilityAttempt, setAvailabilityAttempt] = useState(0);
  const [availabilityError, setAvailabilityError] = useState("");
  const [flowError, setFlowError] = useState("");

  // coach selection state
  const [coaches,       setCoaches]       = useState([]);
  const [loadingCoaches, setLoadingCoaches] = useState(true);

  const [selectedCoach, setSelectedCoach] = useState(draft.selectedCoach || null);
  const [passengerCount, setPassengerCount] = useState(draft.passengerCount || 1);

  const [reserving,     setReserving]     = useState(false);

  // details state
  const [reservation,  setReservation]  = useState(draft.reservation || null);
  const [passengers,   setPassengers]   = useState(draft.passengers || []);
  const [secondsLeft,  setSecondsLeft]  = useState(() => reservationSecondsLeft(draft.reservation?.expiresAt));

  const [confirming,   setConfirming]   = useState(false);
  const timerRef = useRef(null);

  // payment state
  const [clientSecret, setClientSecret] = useState(draft.clientSecret || "");
  const [amount,       setAmount]       = useState(draft.amount || 0);

  // receipt state
  const [booking, setBooking] = useState(draft.booking || null);

  const [step, setStep] = useState(draft.step || 1);

  useEffect(() => {
    saveBookingDraft(draftKey, { step, selectedCoach, passengerCount, reservation, passengers, clientSecret, amount, booking });
  }, [draftKey, step, selectedCoach, passengerCount, reservation, passengers, clientSecret, amount, booking]);

  useEffect(() => { headingRef.current?.focus({ preventScroll: step === 1 }); }, [step]);

  // Load coaches
  useEffect(() => {
    let cancelled = false;
    setLoadingCoaches(true);
    setAvailabilityError("");
    apiClient
      .get(`/trains/${train.id}/coaches`, {
        params: { date: travelDate, boarding, destination },
      })
      .then(({ data }) => { if (!cancelled) setCoaches(data.coaches); })
      .catch(() => { if (!cancelled) setAvailabilityError("Couldn’t load coach availability. Please try again."); })
      .finally(() => { if (!cancelled) setLoadingCoaches(false); });
    return () => { cancelled = true; };
  }, [train.id, travelDate, boarding, destination, availabilityAttempt]);

  // 10-minute countdown
  useEffect(() => {
    if (step !== 2 || !reservation) return;
    const updateCountdown = () => setSecondsLeft(reservationSecondsLeft(reservation.expiresAt));
    updateCountdown();
    timerRef.current = setInterval(updateCountdown, 1000);
    document.addEventListener("visibilitychange", updateCountdown);
    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", updateCountdown);
    };
  }, [step, reservation]);

  const restartSelection = () => {
    setReservation(null);
    setSelectedCoach(null);
    setFlowError("");
    setStep(1);
    setAvailabilityAttempt((value) => value + 1);
    try { sessionStorage.removeItem(draftKey); } catch { /* Storage may be unavailable. */ }
  };

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleReserve = async () => {
    if (!selectedCoach || reserving) return;

    setReserving(true);
    setFlowError("");
    try {
      const { data } = await apiClient.post("/bookings/reserve", {
        coachId: selectedCoach.id,
        count:   passengerCount,
        travelDate,
      });
      setReservation(data);
      setSecondsLeft(reservationSecondsLeft(data.expiresAt));
      setPassengers((previous) => Array.from({ length: passengerCount }, (_, index) => previous[index] || { name: "", age: "" }));
      setStep(2);
    } catch (err) {
      setFlowError(err.response?.data?.message || "Failed to reserve seats. Please try again.");
      setSelectedCoach(null);
      setAvailabilityAttempt((value) => value + 1);
    } finally {
      setReserving(false);
    }
  };

  const updatePassenger = (i, field, val) =>
    setPassengers((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, [field]: val } : p))
    );

  const handleProceedToPayment = async () => {
    if (reservationSecondsLeft(reservation?.expiresAt) === 0) {
      setSecondsLeft(0);
      toast.error("Session expired. Please go back and select seats again.");
      return;
    }

    if (confirming) return;
    setConfirming(true);
    setFlowError("");
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
      if ([410, 502].includes(err.response?.status)) {
        setSecondsLeft(0);
        setReservation((current) => ({ ...current, expiresAt: new Date(0).toISOString() }));
      }
      setFlowError(err.response?.data?.message || "Failed to confirm booking. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  const handleDone = () => {
    clearInterval(timerRef.current);
    navigate("/dashboard");
  };

  const STEPS = ["Select Coach", "Passenger Details", "Payment", "Confirmed"];
  const routeFare = Number(selectedCoach?.routeFare ?? booking?.routeFare ?? train.routeFare ?? 0);
  const durationText = train.durationText || booking?.durationText || "";
  const formatJourneyDateTime = (iso) =>
    iso
      ? new Date(iso).toLocaleString("en-IN", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Not set";
  const bookingDistanceText = Number.isFinite(Number(booking?.distance))
    ? `${Number(booking.distance).toLocaleString("en-IN", { maximumFractionDigits: 1 })} km`
    : "Not set";
  const bookingStripeId = booking?.stripeId || booking?.payment?.stripePaymentId || "Not set";

  const summaryTotal = step >= 3 ? amount : routeFare * passengerCount;

  return (
    <div className="booking-layout">
      <aside className="booking-summary" aria-labelledby="journey-summary-title">
        <details className="booking-summary__details" open={summaryOpen} onToggle={(event) => setSummaryOpen(event.currentTarget.open)}>
          <summary>
            <span><span className="booking-eyebrow" id="journey-summary-title">Journey summary</span><strong>{boarding} → {destination}</strong><small>{formatJourneyDate(train.boardingDate)} · {selectedCoach ? selectedCoach.name : "Choose a coach"}</small></span>
            <span className="booking-summary__compact-fare">{selectedCoach ? `₹${summaryTotal.toLocaleString("en-IN")}` : "View details"}<small>Details ▾</small></span>
          </summary>
          <div className="booking-summary__content">
            <h2>{train.name}</h2>
            <p className="text-muted">Train #{train.number}</p>
            <div className="booking-summary__journey">
              <div><strong>{train.boardingHalt?.departureTime || "—"}</strong><span>{boarding}</span><small>{formatJourneyDate(train.boardingDate)}</small></div>
              <span className="text-muted">{durationText || "→"}</span>
              <div><strong>{train.destinationHalt?.arrivalTime || "—"}</strong><span>{destination}</span><small>{formatJourneyDate(train.destinationDate)}</small></div>
            </div>
            <dl className="booking-summary__fare">
              <div><dt>Class / coach</dt><dd>{selectedCoach ? `${selectedCoach.type} / ${selectedCoach.name}` : "Not selected"}</dd></div>
              <div><dt>Passengers</dt><dd>{passengerCount}</dd></div>
              {selectedCoach && <div><dt>Fare per passenger</dt><dd>₹{routeFare.toLocaleString("en-IN")}</dd></div>}
              <div className="booking-summary__total"><dt>{step === 4 ? "Total paid" : "Total fare"}</dt><dd>{selectedCoach ? `₹${summaryTotal.toLocaleString("en-IN")}` : "—"}</dd></div>
            </dl>
            <p className="booking-summary__note">{step === 4 ? "Your journey is confirmed. Your ticket is available in My bookings." : "Availability is checked when you reserve. Your seats are held for 10 minutes while you add passenger details."}</p>
          </div>
        </details>
      </aside>
      <section className="booking-panel" aria-labelledby="booking-step-title">
        <ol className="booking-steps" aria-label="Booking progress">
          {STEPS.map((label, i) => (
            <li key={label} className={step === i + 1 ? "is-current" : step > i + 1 ? "is-complete" : ""} aria-current={step === i + 1 ? "step" : undefined}>
              <span className="booking-steps__number" aria-hidden="true">{step > i + 1 ? "✓" : i + 1}</span><span>{label}</span>
            </li>
          ))}
        </ol>
        <div className="booking-panel__body">
          <h2 id="booking-step-title" ref={headingRef} tabIndex={-1}>{STEPS[step - 1]}</h2>
          {flowError && <p className="booking-error" role="alert">{flowError}</p>}
              {/* STEP 1: Coach selection */}
              {step === 1 && (
                <>
                  {loadingCoaches && (
                    <div className="text-center py-4">
                      <div
                        className="spinner-border"
                        style={{ color: "var(--action-primary)" }}
                        role="status"
                      />
                    </div>
                  )}


                  {availabilityError && <div className="booking-error" role="alert"><p>{availabilityError}</p><button className="btn btn-outline-secondary" onClick={() => setAvailabilityAttempt((value) => value + 1)}>Retry availability</button></div>}
                  {passengers.length > 0 && <p className="text-muted">Your passenger details are kept for this attempt. Select a coach to reserve seats again.</p>}
                  {!loadingCoaches && !availabilityError && coaches.length === 0 && (
                    <p className="text-muted text-center py-3">
                      No coaches available for this train.
                    </p>
                  )}

                  {!loadingCoaches && !availabilityError && coaches.length > 0 && (
                    <>
                      <p className="text-muted mb-3">Choose a coach to see your total fare and reserve seats.</p>
                      <div className="row g-2 mb-4">
                        {coaches.map((coach) => {
                          const isSelected = selectedCoach?.id === coach.id;
                          const isFull     = coach.availableSeats <= 0;
                          return (
                            <div className="col-6 col-md-4" key={coach.id}>
                              <button
                                type="button"
                                disabled={isFull}
                                aria-pressed={isSelected}
                                className="coach-option p-3 rounded text-center"
                                style={{
                                  border:     `2px solid ${isSelected ? "var(--action-primary)" : "#ddd"}`,
                                  background: isSelected
                                    ? "var(--action-soft)"
                                    : "var(--color-paper-dark)",
                                  cursor:  isFull ? "not-allowed" : "pointer",
                                  opacity: isFull ? 0.5 : 1,
                                }}
                                onClick={() => { setSelectedCoach(coach); setPassengerCount((count) => Math.max(1, Math.min(count, coach.availableSeats))); }}
                              >
                                <div
                                  className="font-mono fw-bold"
                                  style={{ fontSize: "1.2rem", color: "var(--color-ink)" }}
                                >
                                  {coach.name}
                                </div>
                                <div
                                  className="font-mono"
                                  style={{ fontSize: "0.75rem", color: "var(--color-ink-soft)" }}
                                >
                                  {coach.type}
                                </div>
                                <div
                                  style={{ fontSize: "0.78rem", color: "var(--color-success)", margin: "2px 0" }}
                                >
                                  {coach.availableSeats}/{coach.totalSeats} free
                                </div>
                                <div
                                  className="font-mono"
                                  style={{ fontSize: "0.78rem", color: "var(--color-ink-soft)" }}
                                >
                                  ₹{Number(coach.routeFare || 0).toLocaleString("en-IN")}/seat
                                </div>
                                {isFull && (
                                  <div style={{ fontSize: "0.72rem", color: "var(--color-danger)" }}>
                                    FULL
                                  </div>
                                )}
                              </button>
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
                              htmlFor="passenger-count"
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
                              id="passenger-count"
                              type="number"
                              step="1"
                              className="form-control"
                              value={passengerCount}
                              min={1}
                              max={selectedCoach.availableSeats}
                              onChange={(e) =>
                                setPassengerCount(
                                  Math.max(
                                    1,
                                    Math.min(selectedCoach.availableSeats, Math.floor(Number(e.target.value)))
                                  )
                                )
                              }
                            />
                            {routeFare > 0 && (
                              <div
                                className="mt-2 font-mono fw-semibold"
                                style={{ color: "var(--action-primary)" }}
                              >
                                Total:{" "}
                                ₹{(routeFare * passengerCount).toLocaleString("en-IN")}
                              </div>
                            )}
                          </div>
                        </>
                      )}



                      <button
                        className="btn btn-primary w-100"
                        disabled={!selectedCoach || reserving}
                        onClick={handleReserve}
                      >
                        {reserving
                          ? "Reserving…"
                          : selectedCoach
                          ? `Reserve ${passengerCount} Seat${passengerCount > 1 ? "s" : ""} in ${selectedCoach.name}`
                          : "Select a coach to continue"}
                      </button>
                    </>
                  )}
                </>
              )}

              {/* STEP 2: Passenger details*/}
              {step === 2 && (
                <>
                  {secondsLeft === 0 && <div className="booking-error" role="alert"><strong>Your seat reservation has expired.</strong><p>The seats have been released. Check availability to reserve again; your passenger details will be kept.</p><button type="button" className="btn btn-primary" onClick={restartSelection}>Check availability again</button></div>}
                  {/* session countdown timer */}
                  <div
                    className="d-flex align-items-center gap-3 mb-4 p-3 rounded"
                    style={{
                      background: secondsLeft <= 60
                        ? "rgba(217,83,79,0.08)"
                        : "var(--action-soft)",
                      border: `1px solid ${secondsLeft <= 60 ? "var(--color-danger)" : "var(--action-primary)"}`,
                    }}
                  >
                    <div
                      className="font-mono fw-bold"
                      style={{
                        fontSize: "1.6rem",
                        color: secondsLeft <= 60 ? "var(--color-danger)" : "var(--action-primary)",
                      }}
                    >
                      {fmt(secondsLeft)}
                    </div>
                    <div>
                      <div className="fw-semibold" style={{ color: "var(--color-ink)" }}>
                        {secondsLeft > 0 ? `Seats held in Coach ${selectedCoach?.name}` : "Seat hold ended"}
                      </div>
                      <div className="small text-muted">
                        Seats: {reservation.seatNumbers.join(", ")}
                        &nbsp;·&nbsp;Continue to payment before this hold expires.
                      </div>
                    </div>
                  </div>

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
                          <label htmlFor={`passenger-${i}-name`} className="form-label small mb-1">Full name</label>
                          <input
                            id={`passenger-${i}-name`}
                            type="text"
                            className="form-control"
                            value={p.name}
                            onChange={(e) => updatePassenger(i, "name", e.target.value)}
                            placeholder="Passenger name"
                            required
                          />
                        </div>
                        <div className="col-md-3">
                          <label htmlFor={`passenger-${i}-age`} className="form-label small mb-1">Age</label>
                          <input
                            id={`passenger-${i}-age`}
                            type="number"
                            className="form-control"
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

                  {routeFare > 0 && (
                    <div
                      className="d-flex justify-content-between align-items-center p-3 rounded mt-3"
                      style={{ background: "var(--action-soft)", border: "1px solid var(--action-primary)" }}
                    >
                      <span style={{ color: "var(--color-ink)" }}>
                        {passengers.length} seat{passengers.length > 1 ? "s" : ""} ×{" "}
                        ₹{routeFare.toLocaleString("en-IN")}
                      </span>
                      <span
                        className="font-mono fw-bold"
                        style={{ fontSize: "1.15rem", color: "var(--action-primary)" }}
                      >
                        ₹{(routeFare * passengers.length).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}



                  <div className="d-flex gap-2 mt-3">
                    <button
                      className="btn btn-primary flex-fill"
                      disabled={
                        confirming ||
                        secondsLeft === 0 ||
                        passengers.some((p) => !p.name.trim() || !Number.isInteger(Number(p.age)) || Number(p.age) < 1 || Number(p.age) > 120)
                      }
                      onClick={handleProceedToPayment}
                    >
                      {confirming
                        ? "Preparing…"
                        : secondsLeft === 0
                        ? "Reservation Expired"
                        : routeFare > 0
                        ? `Proceed to Payment - ₹${(routeFare * passengers.length).toLocaleString("en-IN")}`
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
                    style={{ background: "var(--action-soft)", border: "1px solid var(--action-primary)" }}
                  >
                    <span style={{ color: "var(--color-ink)", fontWeight: 600 }}>
                      Amount to pay
                    </span>
                    <span
                      className="font-mono fw-bold"
                      style={{ fontSize: "1.3rem", color: "var(--action-primary)" }}
                    >
                      ₹{amount.toLocaleString("en-IN")}
                    </span>
                  </div>

                  {!stripePromise && <p className="booking-error" role="alert">Payment is currently unavailable. Please contact support before starting another booking.</p>}
                  {stripePromise && <Elements
                    key={clientSecret}
                    stripe={stripePromise}
                    options={{ clientSecret, appearance: stripeAppearance }}
                  >
                    <PaymentForm
                      clientSecret={clientSecret}
                      amount={amount}
                      bookingId={booking.id}
                      onSuccess={() => setStep(4)}
                    />
                  </Elements>}
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
                      PNR {booking.pnr || "Not set"} · Booking #{String(booking.id).padStart(6, "0")}
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
                        <td className="fw-semibold text-muted">PNR</td>
                        <td className="font-mono">{booking.pnr || "Not set"}</td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-muted">Coach</td>
                        <td>{booking.coach.name} · {booking.coach.type}</td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-muted">Boarding</td>
                        <td>{booking.boarding}</td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-muted">Destination</td>
                        <td>{booking.destination}</td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-muted">Distance</td>
                        <td>{bookingDistanceText}</td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-muted">Start Date & Time</td>
                        <td>{formatJourneyDateTime(booking.startDateTime)}</td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-muted">Arrival Date & Time</td>
                        <td>{formatJourneyDateTime(booking.arrivalDateTime)}</td>
                      </tr>
                      {durationText && (
                        <tr>
                          <td className="fw-semibold text-muted">Duration</td>
                          <td>{durationText}</td>
                        </tr>
                      )}
                      {amount > 0 && (
                        <tr>
                          <td className="fw-semibold text-muted">Amount Paid</td>
                          <td className="font-mono" style={{ color: "var(--color-success)" }}>
                            ✓ ₹{amount.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td className="fw-semibold text-muted">Stripe ID</td>
                        <td className="font-mono" style={{ wordBreak: "break-all" }}>{bookingStripeId}</td>
                      </tr>
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
                      className="btn btn-primary flex-fill"
                      onClick={() => downloadReceipt(booking, amount)}
                    >
                      ⬇ Download Receipt
                    </button>    {/* Download button */}
                  </div>
                </>
              )}
        </div>
      </section>
    </div>
  );
}
