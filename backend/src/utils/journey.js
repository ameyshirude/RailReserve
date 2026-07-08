const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function parseRunningDays(value) {
  try {
    const days = JSON.parse(value);
    if (Array.isArray(days)) return days.map(Number);
  } catch (_) {}
  return ALL_DAYS;
}

function parseTravelDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function minutesFromTime(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function haltMinute(halt, timeField, dayField) {
  const minutes = minutesFromTime(halt[timeField]);
  if (minutes === null) return null;
  const day = Math.max(1, Number(halt[dayField]) || 1);
  return (day - 1) * 24 * 60 + minutes;
}

function boardingMinute(halt) {
  return haltMinute(halt, "departureTime", "departureDay")
    ?? haltMinute(halt, "arrivalTime", "arrivalDay");
}

function destinationMinute(halt) {
  return haltMinute(halt, "arrivalTime", "arrivalDay")
    ?? haltMinute(halt, "departureTime", "departureDay");
}

function serviceDateForDestination(arrivalDate, destinationHalt) {
  const arrivalDay = Math.max(1, Number(destinationHalt.arrivalDay || destinationHalt.departureDay) || 1);
  return addUtcDays(arrivalDate, -(arrivalDay - 1));
}

function routeDurationMinutes(boardingHalt, destinationHalt) {
  const start = boardingMinute(boardingHalt);
  const end = destinationMinute(destinationHalt);
  if (start === null || end === null || end < start) return null;
  return end - start;
}

function formatDuration(totalMinutes) {
  if (totalMinutes === null || totalMinutes === undefined) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

const COACH_FARE_MULTIPLIERS = {
  SL: 1,
  "3A": 2,
  "2A": 2.8,
  "1A": 4.5,
};

const ALLOWED_COACH_NAMES = Object.keys(COACH_FARE_MULTIPLIERS);

function normalizeCoachName(value) {
  return String(value || "").trim().toUpperCase();
}

function isAllowedCoachName(value) {
  return ALLOWED_COACH_NAMES.includes(normalizeCoachName(value));
}

function fareForCoach(baseFare, coachName) {
  const multiplier = COACH_FARE_MULTIPLIERS[normalizeCoachName(coachName)] || 1;
  return Math.round((Number(baseFare) || 0) * multiplier * 100) / 100;
}

function routeFare(boardingHalt, destinationHalt) {
  const boardingFare = Number(boardingHalt.price) || 0;
  const destinationFare = Number(destinationHalt.price) || 0;
  return Math.max(0, destinationFare - boardingFare);
}

function findRouteHalts(halts, boarding, destination) {
  const bHalt = halts.find((h) => h.stationName.toLowerCase() === boarding.toLowerCase());
  const dHalt = halts.find((h) => h.stationName.toLowerCase() === destination.toLowerCase());
  if (!bHalt || !dHalt || dHalt.order <= bHalt.order) return null;
  return { boardingHalt: bHalt, destinationHalt: dHalt };
}

function journeyDetails(boardingHalt, destinationHalt, coachName = "SL") {
  const durationMinutes = routeDurationMinutes(boardingHalt, destinationHalt);
  const baseRouteFare = routeFare(boardingHalt, destinationHalt);
  return {
    baseRouteFare,
    routeFare: fareForCoach(baseRouteFare, coachName),
    durationMinutes,
    durationText: formatDuration(durationMinutes),
  };
}

module.exports = {
  ALLOWED_COACH_NAMES,
  parseRunningDays,
  parseTravelDate,
  toDateInputValue,
  addUtcDays,
  boardingMinute,
  destinationMinute,
  serviceDateForDestination,
  routeDurationMinutes,
  formatDuration,
  fareForCoach,
  isAllowedCoachName,
  normalizeCoachName,
  routeFare,
  findRouteHalts,
  journeyDetails,
};
