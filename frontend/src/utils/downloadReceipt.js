import { bookingStatus, bookedDate, distanceText, journeyDate, journeyTime, money, paymentStatus } from "./bookingPresentation";

const escapeHtml = (value) => String(value ?? "Not available").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

export function buildReceiptHtml(booking, amount = booking.payment?.amount) {
  const status = bookingStatus(booking);
  const cancelled = status.tone === "cancelled";
  const refunded = booking.payment?.status === "REFUNDED";
  const row = (label, value) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
  const schedule = (value) => value ? `${journeyDate(value)} · ${journeyTime(value)} IST` : "Not available";
  const passengers = booking.passengers || [];
  const passengerRows = passengers.length ? passengers.map((passenger, index) => `<tr>
    <td>${index + 1}</td><td>${escapeHtml(passenger.passengerName)}</td>
    <td>${escapeHtml(passenger.passengerAge)}</td><td>${cancelled ? "Released" : escapeHtml(passenger.seatNumber)}</td>
  </tr>`).join("") : '<tr><td colspan="4">Passenger details are not available.</td></tr>';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RailReserve — Booking #${escapeHtml(booking.id)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; max-width: 720px; margin: 32px auto; padding: 0 16px; color: #1d2b36; overflow-wrap: anywhere; }
    .header { background: #11212f; color: #fff; padding: 24px; border-radius: 12px 12px 0 0; }
    .header h1 { font-size: 1.4rem; margin: 0 0 8px; }
    .header p { margin: 0; color: #c7d2fe; }
    .body { padding: 24px; border: 1px solid #d7dfe8; border-radius: 0 0 12px 12px; }
    .pnr { font-family: monospace; font-size: 1.2rem; font-weight: 700; }
    h2 { font-size: 1rem; margin: 24px 0 8px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { padding: 9px 12px; border: 1px solid #d7dfe8; font-size: 0.88rem; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    tbody th { width: 38%; }
    .notice { background: #f1f5f9; padding: 12px; }
    .footer { margin-top: 24px; border-top: 1px solid #d7dfe8; padding-top: 16px; color: #4a5a68; font-size: 0.8rem; }
    @media (max-width: 480px) { .body { padding: 12px; } th, td { padding: 8px; } }
    @media print { body { margin: 0; max-width: none; } }
  </style>
</head>
<body>
  <header class="header"><h1>RailReserve</h1><p>${refunded ? "Refund receipt" : "Booking receipt"}</p></header>
  <main class="body">
    <p class="pnr">PNR ${escapeHtml(booking.pnr || "Not assigned")}</p>
    <p>Booking status: <strong>${escapeHtml(status.label)}</strong></p>
    ${cancelled ? '<p class="notice">This booking is cancelled and cannot be used for travel.</p>' : booking.status !== "CONFIRMED" ? '<p class="notice">This booking is not confirmed for travel.</p>' : ""}
    <h2>Journey details</h2>
    <table><tbody>
      ${row("Train", [booking.train?.name, booking.train?.number].filter(Boolean).join(" · ") || "Not available")}
      ${row("Booking reference", booking.id)}
      ${row("Coach", [booking.coach?.name, booking.coach?.type].filter(Boolean).join(" · ") || "Not available")}
      ${row("Boarding", booking.boarding)}
      ${row("Destination", booking.destination)}
      ${row("Travel date", journeyDate(booking.travelDate))}
      ${row("Departure", schedule(booking.startDateTime))}
      ${row("Arrival", schedule(booking.arrivalDateTime))}
      ${row("Duration", booking.durationText || "Not available")}
      ${row("Distance", distanceText(booking.distance))}
      ${row("Booked on (IST)", bookedDate(booking.bookedAt))}
    </tbody></table>
    <h2>Passengers</h2>
    <table><thead><tr><th>#</th><th>Name</th><th>Age</th><th>Seat</th></tr></thead><tbody>${passengerRows}</tbody></table>
    <h2>Payment</h2>
    <table><tbody>
      ${row("Status", paymentStatus(booking))}
      ${row(refunded ? "Amount refunded" : booking.payment?.status === "PAID" ? "Amount paid" : "Amount", money(amount))}
      ${row("Payment reference", booking.stripeId || booking.payment?.stripePaymentId || "Not available")}
      ${row("Currency", "INR")}
    </tbody></table>
    <footer class="footer">This is a computer-generated receipt. All journey times are in IST.</footer>
  </main>
</body>
</html>`;
}

export function downloadReceipt(booking, amount) {
  const blob = new Blob([buildReceiptHtml(booking, amount)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const reference = String(booking.pnr || booking.id).replace(/[^a-zA-Z0-9_-]/g, "_");
  anchor.download = `RailReserve-${booking.payment?.status === "REFUNDED" ? "Refund-" : ""}Receipt-${reference}.html`;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
