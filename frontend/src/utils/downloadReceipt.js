// Receipt downloader
export function downloadReceipt(booking, amount) {
  const fmt = (iso) =>
    new Date(iso).toLocaleString("en-IN", {
      weekday: "short", year: "numeric", month: "short",
      day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  const fmtMaybe = (iso) => (iso ? fmt(iso) : "Not set");
  const distanceText = Number.isFinite(Number(booking.distance))
    ? `${Number(booking.distance).toLocaleString("en-IN", { maximumFractionDigits: 1 })} km`
    : "Not set";
  const stripeId = booking.stripeId || booking.payment?.stripePaymentId || "Not set";

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
    .header { background: #11212f; color: #c7d2fe; padding: 28px 32px; border-radius: 12px 12px 0 0; }
    .header h1 { font-size: 1.4rem; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 4px; }
    .header p  { color: #6f9fc9; font-size: 0.9rem; }
    .perf { border-top: 2.5px dashed #ccc; margin: 0; }
    .body { background: #ffffff; padding: 28px 32px; border-radius: 0 0 12px 12px; }
    .booking-id { font-family: 'Courier New', monospace; font-size: 1.3rem; font-weight: 700; letter-spacing: 0.06em; margin-bottom: 22px; color: #11212f; }
    h3 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: #4a5a68; margin: 20px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    th, td { padding: 9px 12px; border: 1px solid #ddd; font-size: 0.88rem; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: #4a5a68; }
    .paid { color: #166534; font-weight: 700; }
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
    <div class="booking-id">PNR ${booking.pnr || "Not set"}</div>

    <h3>Journey Details</h3>
    <table>
      <tbody>
        <tr><th style="width:38%">Train</th><td>${booking.train.name} (${booking.train.number})</td></tr>
        <tr><th>Booking ID</th><td>#${String(booking.id).padStart(6, "0")}</td></tr>
        <tr><th>PNR</th><td>${booking.pnr || "Not set"}</td></tr>
        <tr><th>Coach</th><td>${booking.coach.name} · ${booking.coach.type}</td></tr>
        <tr><th>Boarding</th><td>${booking.boarding}</td></tr>
        <tr><th>Destination</th><td>${booking.destination}</td></tr>
        <tr><th>Distance</th><td>${distanceText}</td></tr>
        <tr><th>Start Date & Time</th><td>${fmtMaybe(booking.startDateTime)}</td></tr>
        <tr><th>Arrival Date & Time</th><td>${fmtMaybe(booking.arrivalDateTime)}</td></tr>
        ${booking.durationText ? `<tr><th>Duration</th><td>${booking.durationText}</td></tr>` : ""}
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
        <tr><th>Stripe ID</th><td>${stripeId}</td></tr>
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
  a.download = `RailReserve-Receipt-${booking.pnr || booking.id}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

