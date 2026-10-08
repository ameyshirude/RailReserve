import { bookingCategory, bookedDate, journeyDate, journeyTime, journeyTimestamp } from "./bookingPresentation";
import { buildReceiptHtml } from "./downloadReceipt";

test("timetable values preserve IST wall times while booking timestamps are true instants", () => {
  expect(journeyTime("2026-10-07T23:40:00Z")).toBe("23:40");
  expect(journeyDate("2026-10-07T23:40:00Z")).toBe("07 Oct 2026");
  expect(journeyTimestamp("2026-10-07T23:40:00Z")).toBe(Date.parse("2026-10-07T18:10:00Z"));
  expect(bookedDate("2026-10-07T23:40:00Z")).toContain("08 Oct 2026");
});

test("date-only journeys stay current through the end of their travel date in India", () => {
  const booking = { status: "CONFIRMED", travelDate: "2026-10-07T00:00:00Z" };
  expect(bookingCategory(booking, Date.parse("2026-10-07T18:29:59Z"))).toBe("upcoming");
  expect(bookingCategory(booking, Date.parse("2026-10-07T18:30:00Z"))).toBe("past");
  expect(bookingCategory({ status: "CONFIRMED", travelDate: null })).toBe("unknown");
  expect(bookingCategory({ status: "PENDING", travelDate: "2020-01-01" })).toBe("pending");
  expect(bookingCategory({ ...booking, payment: { status: "REFUNDED" } })).toBe("cancelled");
});

test("refund receipts identify the cancellation and do not claim the booking is paid or valid", () => {
  const html = buildReceiptHtml({ id: 3, pnr: "RRREFUND", status: "CANCELLED", payment: { status: "REFUNDED", amount: 500 }, passengers: [] });
  const document = new DOMParser().parseFromString(html, "text/html");
  expect(document.body.textContent).toContain("Refund receipt");
  expect(document.body.textContent).toContain("Amount refunded");
  expect(document.body.textContent).toContain("cannot be used for travel");
  expect(document.body.textContent).not.toContain("Amount paid");
  expect(document.body.textContent).not.toContain("0 km");
});

test("receipt text escapes train, route, reference and passenger content as plain text", () => {
  const malicious = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  const html = buildReceiptHtml({ id: 1, pnr: malicious, status: "CONFIRMED", train: { name: malicious, number: "123" }, boarding: malicious, passengers: [{ passengerName: malicious, passengerAge: 25, seatNumber: 1 }], payment: { status: "PAID", amount: 0, stripePaymentId: malicious } });
  const document = new DOMParser().parseFromString(html, "text/html");
  expect(document.querySelector("script, img")).toBeNull();
  expect(document.body.textContent).toContain(malicious);
  expect(document.body.textContent).toContain("₹0.00");
  expect(document.body.textContent).toContain("Paid");
});

test("pending receipts never imply a confirmed ticket or successful payment", () => {
  const html = buildReceiptHtml({ id: 1, status: "PENDING", payment: { status: "PENDING", amount: 500 } });
  expect(html).toContain("not confirmed for travel");
  expect(html).toContain("Payment pending");
  expect(html).not.toContain("Amount paid");
});
