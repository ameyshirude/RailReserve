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

//distance slabs
const DISTANCE_SLABS = [
  { upTo: 50,   ratePerKm: 0.55 },
  { upTo: 200,  ratePerKm: 0.45 },
  { upTo: 500,  ratePerKm: 0.35 },
  { upTo: 1000, ratePerKm: 0.30 },
  { upTo: Infinity, ratePerKm: 0.25 },
];

// class multipliers
const COACH_FARE_MULTIPLIERS = {
  SL:   1,
  "3A": 2.8,
  "2A": 4.2,
  "1A": 6.5,
};

// fix reserve class fees
const RESERVATION_FEES = {
  SL:   20,
  "3A": 40,
  "2A": 50,
  "1A": 60,
};

// GST rate for ac calss— 5%
const GST_RATE = 0.05;
const GST_APPLICABLE_CLASSES = ["3A", "2A", "1A"];

const MINIMUM_FARES = {
  SL:   120,
  "3A": 430,
  "2A": 670,
  "1A": 1050,
};
const ALLOWED_COACH_NAMES = Object.keys(COACH_FARE_MULTIPLIERS);

function normalizeCoachType(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeStationName(value) {
  return String(value || "").trim().toLowerCase();
}

function isAllowedCoachType(value) {
  return ALLOWED_COACH_NAMES.includes(normalizeCoachType(value));
}

function fareForCoach(baseFare, coachName) {
  const normalizedCoachType = normalizeCoachType(coachName);
  const multiplier = COACH_FARE_MULTIPLIERS[normalizedCoachType] || 1;
  const minimumFare = MINIMUM_FARES[normalizedCoachType] || MINIMUM_FARES.SL;
  const reservationFee = RESERVATION_FEES[normalizedCoachType] || RESERVATION_FEES.SL;

  // Apply class multiplier to the basic fare
  let fare = Math.max((Number(baseFare) || 0) * multiplier, minimumFare);

  // Added fixed reservation fee
  fare += reservationFee;

  // Applying  5% GST for AC classes
  if (GST_APPLICABLE_CLASSES.includes(normalizedCoachType)) {
    fare *= (1 + GST_RATE);
  }

  // Round to nearest ₹5
  return Math.round(fare / 5) * 5;
}

function routeDistance(boardingHalt, destinationHalt) {
  const boardingDistance = Number(boardingHalt.distance) || 0;
  const destinationDistance = Number(destinationHalt.distance) || 0;
  return Math.max(0, destinationDistance - boardingDistance);
}

// rate decrease per km
function routeFare(boardingHalt, destinationHalt) {
  const distance = routeDistance(boardingHalt, destinationHalt);
  let fare = 0;
  let remaining = distance;

  let prevBoundary = 0;
  for (const slab of DISTANCE_SLABS) {
    if (remaining <= 0) break;
    const slabWidth = slab.upTo === Infinity ? remaining : slab.upTo - prevBoundary;
    const kmInSlab = Math.min(remaining, slabWidth);
    fare += kmInSlab * slab.ratePerKm;
    remaining -= kmInSlab;
    prevBoundary = slab.upTo;
  }

  return Math.round(fare * 100) / 100;
}

function findRouteHalts(halts, boarding, destination) {
  const boardingName = normalizeStationName(boarding);
  const destinationName = normalizeStationName(destination);
  const bHalt = halts.find((h) => normalizeStationName(h.stationName) === boardingName);
  const dHalt = halts.find((h) => normalizeStationName(h.stationName) === destinationName);
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
  DISTANCE_SLABS,
  COACH_FARE_MULTIPLIERS,
  RESERVATION_FEES,
  GST_RATE,
  GST_APPLICABLE_CLASSES,
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
  normalizeStationName,
  routeDistance,
  routeFare,
  findRouteHalts,
  journeyDetails,
};
