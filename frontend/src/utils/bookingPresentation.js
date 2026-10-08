const IST_OFFSET = 330 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

function timestamp(value) {
  if (!value) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

export function journeyTimestamp(value) {
  const result = timestamp(value);
  return result === null ? null : result - IST_OFFSET;
}

export function bookingCategory(booking, now = Date.now()) {
  if (booking.status === "CANCELLED" || booking.payment?.status === "REFUNDED") return "cancelled";
  if (booking.status === "PENDING") return "pending";
  if (booking.status !== "CONFIRMED") return "unknown";
  const arrival = journeyTimestamp(booking.arrivalDateTime);
  if (arrival !== null) return arrival <= now ? "past" : "upcoming";
  const date = journeyTimestamp(booking.travelDate?.slice(0, 10));
  return date === null ? "unknown" : date + DAY <= now ? "past" : "upcoming";
}

export function bookingStatus(booking) {
  if (booking.status === "CANCELLED" || booking.payment?.status === "REFUNDED") return { label: "Cancelled", tone: "cancelled" };
  if (booking.status === "CONFIRMED") return { label: "Confirmed", tone: "confirmed" };
  if (booking.status === "PENDING") return { label: "Pending confirmation", tone: "pending" };
  return { label: "Status unavailable", tone: "neutral" };
}

export function paymentStatus(booking) {
  return { PAID: "Paid", PENDING: "Payment pending", FAILED: "Payment failed", REFUNDED: "Refunded" }[booking.payment?.status] || "Payment details unavailable";
}

export function journeyProgress(booking, now = Date.now()) {
  const category = bookingCategory(booking, now);
  if (category === "past") return "Past journey";
  if (category !== "upcoming") return "";
  const start = journeyTimestamp(booking.startDateTime);
  return start !== null && start <= now ? "Journey in progress" : "Upcoming journey";
}

const dateOptions = { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" };
export function journeyDate(value) {
  const time = journeyTimestamp(value);
  return time === null ? "Date unavailable" : new Date(time).toLocaleDateString("en-IN", dateOptions);
}
export function journeyTime(value) {
  const time = journeyTimestamp(value);
  return time === null ? "Time unavailable" : new Date(time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Kolkata" });
}
export function bookedDate(value) {
  const time = timestamp(value);
  return time === null ? "Not available" : new Date(time).toLocaleString("en-IN", { ...dateOptions, hour: "2-digit", minute: "2-digit" });
}
export function money(value) {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "Not available";
  return Number(value).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}
export function distanceText(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))
    ? Number(value).toLocaleString("en-IN", { maximumFractionDigits: 1 }) + " km" : "Not available";
}

export function filterBookings(bookings, query, view, sort, now = Date.now()) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = bookings.filter((booking) => {
    if (view !== "all" && bookingCategory(booking, now) !== view) return false;
    const search = [booking.pnr, booking.train?.name, booking.train?.number, booking.boarding, booking.destination].join(" ").toLowerCase();
    return words.every((word) => search.includes(word));
  });
  const departure = (booking) => journeyTimestamp(booking.startDateTime) ?? journeyTimestamp(booking.travelDate);
  const compare = (left, right, descending = false) => {
    if (left === right) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return descending ? right - left : left - right;
  };
  const priority = { upcoming: 0, pending: 1, past: 2, cancelled: 3, unknown: 4 };
  return matches.sort((a, b) => {
    if (sort === "booked") return compare(timestamp(a.bookedAt), timestamp(b.bookedAt), true);
    if (sort === "journey") return compare(departure(a), departure(b), true);
    const category = bookingCategory(a, now);
    const groupOrder = priority[category] - priority[bookingCategory(b, now)];
    if (groupOrder) return groupOrder;
    return compare(departure(a), departure(b), category !== "upcoming") || compare(timestamp(a.bookedAt), timestamp(b.bookedAt), true);
  });
}
