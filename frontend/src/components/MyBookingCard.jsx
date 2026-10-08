import React, { useState } from "react";
import { downloadReceipt } from "../utils/downloadReceipt";
import { bookingStatus, bookedDate, distanceText, journeyDate, journeyProgress, journeyTime, money, paymentStatus } from "../utils/bookingPresentation";

function Detail({ label, children }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

export default function MyBookingCard({ booking, now }) {
  const [message, setMessage] = useState("");
  const status = bookingStatus(booking);
  const passengers = booking.passengers || [];
  const canDownload = ["PAID", "REFUNDED"].includes(booking.payment?.status);
  const refunded = booking.payment?.status === "REFUNDED";
  const coach = [booking.coach?.name, booking.coach?.type].filter(Boolean).join(" · ");
  const progress = journeyProgress(booking, now);

  const copyPnr = async () => {
    try {
      await navigator.clipboard.writeText(booking.pnr);
      setMessage("PNR copied.");
    } catch {
      setMessage("Could not copy PNR. Select the PNR above and copy it manually.");
    }
  };
  const handleDownload = () => {
    try {
      downloadReceipt(booking, booking.payment.amount);
      setMessage("Receipt download started.");
    } catch {
      setMessage("Could not download the receipt. Please try again.");
    }
  };

  return (
    <article className="my-booking" aria-labelledby={`booking-title-${booking.id}`}>
      <header className="my-booking__header">
        <div>
          <p className="my-booking__eyebrow">Train {booking.train?.number || "number unavailable"}</p>
          <h2 id={`booking-title-${booking.id}`}>{booking.train?.name || "Train details unavailable"}</h2>
        </div>
        <div className="my-booking__state">
          <span className={`my-booking__badge my-booking__badge--${status.tone}`}>{status.label}</span>
          {progress && <span>{progress}</span>}
        </div>
      </header>
      <div className="my-booking__body">
        <div className="my-booking__journey">
          <div>
            <span className="my-booking__label">Departure</span>
            <strong className="my-booking__time">{journeyTime(booking.startDateTime)}</strong>
            <span className="my-booking__station">{booking.boarding || "Boarding unavailable"}</span>
            <span>{journeyDate(booking.startDateTime || booking.travelDate)}</span>
          </div>
          <div className="my-booking__duration"><span>{booking.durationText || "Duration unavailable"}</span><span aria-hidden="true">→</span></div>
          <div>
            <span className="my-booking__label">Arrival</span>
            <strong className="my-booking__time">{journeyTime(booking.arrivalDateTime)}</strong>
            <span className="my-booking__station">{booking.destination || "Destination unavailable"}</span>
            <span>{journeyDate(booking.arrivalDateTime)}</span>
          </div>
        </div>
        <dl className="my-booking__summary">
          <Detail label="PNR"><span className="font-mono my-booking__pnr">{booking.pnr || "Not assigned"}</span></Detail>
          <Detail label="Coach">{coach || "Not available"}</Detail>
          <Detail label={status.tone === "cancelled" ? "Seats" : `Seats · ${passengers.length} passenger${passengers.length === 1 ? "" : "s"}`}>
            {status.tone === "cancelled" ? "Released" : passengers.map((passenger) => passenger.seatNumber).filter((seat) => seat !== null && seat !== undefined).join(", ") || "Not assigned"}
          </Detail>
          <Detail label={paymentStatus(booking)}>{money(booking.payment?.amount)}</Detail>
        </dl>
        {booking.status === "PENDING" && <p className="my-booking__notice">This booking is not confirmed yet. Refresh bookings to check its latest status.</p>}
        {status.tone === "cancelled" && <p className="my-booking__notice">{refunded ? "This booking was cancelled and its payment refunded." : "This booking is cancelled and cannot be used for travel."}</p>}

        <details className="my-booking__details">
          <summary>Ticket details<span className="visually-hidden"> for PNR {booking.pnr || booking.id}</span></summary>
          <div className="my-booking__detail-body">
            <h3>Passengers</h3>
            {passengers.length ? <ul className="my-booking__passengers">
              {passengers.map((passenger, index) => <li key={passenger.id || index}>
                <div><strong>{passenger.passengerName || "Name unavailable"}</strong><span>{passenger.passengerAge == null ? "Age unavailable" : `${passenger.passengerAge} years`}</span></div>
                <span>{status.tone === "cancelled" ? "Seat released" : `Seat ${passenger.seatNumber ?? "not assigned"}`}</span>
              </li>)}
            </ul> : <p>{status.tone === "cancelled" ? "Passenger and seat details are no longer available for this cancelled booking." : "Passenger details are not available."}</p>}
            <dl className="my-booking__metadata">
              <Detail label="Booking reference">#{booking.id}</Detail>
              <Detail label="Booked on (IST)">{bookedDate(booking.bookedAt)}</Detail>
              <Detail label="Distance">{distanceText(booking.distance)}</Detail>
              <Detail label="Payment reference"><span className="font-mono">{booking.stripeId || booking.payment?.stripePaymentId || "Not available"}</span></Detail>
            </dl>
          </div>
        </details>
        <footer className="my-booking__actions">
          {booking.pnr && <button type="button" className="btn btn-outline-secondary" onClick={copyPnr} aria-label={`Copy PNR ${booking.pnr}`}>Copy PNR</button>}
          {canDownload && <button type="button" className="btn btn-primary" onClick={handleDownload} aria-label={`Download ${refunded ? "refund " : ""}receipt for PNR ${booking.pnr || booking.id}`}>{refunded ? "Download refund receipt" : "Download receipt"}</button>}
        </footer>
        <p className="my-booking__feedback" role="status">{message}</p>
      </div>
    </article>
  );
}
