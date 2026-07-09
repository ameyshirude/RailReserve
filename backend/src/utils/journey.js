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

function haltDay(halt, primaryDayField, fallbackDayField) {
  return Math.max(1, Number(halt[primaryDayField] || halt[fallbackDayField]) || 1);
}

function serviceDateForBoarding(boardingDate, boardingHalt) {
  const day = haltDay(boardingHalt, "departureDay", "arrivalDay");
  return addUtcDays(boardingDate, -(day - 1));
}

function dateForHalt(serviceDate, halt, primaryDayField, fallbackDayField) {
  const day = haltDay(halt, primaryDayField, fallbackDayField);
  return addUtcDays(serviceDate, day - 1);
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
  "3A": 1.8,
  "2A": 2.2,
  "1A": 3.2,
};

const BASE_RATE_PER_KM = 0.55;
const MINIMUM_FARES = {
  SL: 120,
  "3A": 430,
  "2A": 670,
  "1A": 1050,
};
const ALLOWED_COACH_NAMES = Object.keys(COACH_FARE_MULTIPLIERS);

function normalizeCoachType(value) {
  return String(value || "").trim().toUpperCase();
}

function isAllowedCoachType(value) {
  return ALLOWED_COACH_NAMES.includes(normalizeCoachType(value));
}

function fareForCoach(baseFare, coachName) {
  const normalizedCoachType = normalizeCoachType(coachName);
  const multiplier = COACH_FARE_MULTIPLIERS[normalizedCoachType] || 1;
  const minimumFare = MINIMUM_FARES[normalizedCoachType] || MINIMUM_FARES.SL;
  const calculatedFare = (Number(baseFare) || 0) * multiplier;
  return Math.round(Math.max(calculatedFare, minimumFare) * 100) / 100;
}

function routeDistance(boardingHalt, destinationHalt) {
  const boardingDistance = Number(boardingHalt.distance) || 0;
  const destinationDistance = Number(destinationHalt.distance) || 0;
  return Math.max(0, destinationDistance - boardingDistance);
}

function routeFare(boardingHalt, destinationHalt) {
  return routeDistance(boardingHalt, destinationHalt) * BASE_RATE_PER_KM;
}

function findRouteHalts(halts, boarding, destination) {
  const bHalt = halts.find((h) => h.stationName.toLowerCase() === boarding.toLowerCase());
  const dHalt = halts.find((h) => h.stationName.toLowerCase() === destination.toLowerCase());
  if (!bHalt || !dHalt || dHalt.order <= bHalt.order) return null;
  return { boardingHalt: bHalt, destinationHalt: dHalt };
}

function journeyDetails(boardingHalt, destinationHalt, coachName = "SL") {
  const durationMinutes = routeDurationMinutes(boardingHalt, destinationHalt);
  const distance = routeDistance(boardingHalt, destinationHalt);
  const baseRouteFare = routeFare(boardingHalt, destinationHalt);
  return {
    distance,
    baseRouteFare,
    routeFare: fareForCoach(baseRouteFare, coachName),
    durationMinutes,
    durationText: formatDuration(durationMinutes),
  };
}

module.exports = {
  ALLOWED_COACH_NAMES,
  BASE_RATE_PER_KM,
  COACH_FARE_MULTIPLIERS,
  MINIMUM_FARES,
  parseRunningDays,
  parseTravelDate,
  toDateInputValue,
  addUtcDays,
  boardingMinute,
  destinationMinute,
  serviceDateForBoarding,
  dateForHalt,
  routeDurationMinutes,
  formatDuration,
  fareForCoach,
  isAllowedCoachType,
  normalizeCoachType,
  routeDistance,
  routeFare,
  findRouteHalts,
  journeyDetails,
};
