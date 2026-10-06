export const SORT_OPTIONS = [
  { value: "departure", label: "Departure: earliest first" },
  { value: "duration", label: "Duration: shortest first" },
  { value: "price", label: "Price: lowest first" },
];
export const normalizeSort = (value) => SORT_OPTIONS.some((option) => option.value === value) ? value : "departure";

export function localDate(offset = 0, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function validateSearch(form, stations, today = localDate()) {
  const errors = {};
  const canonicalStation = (value) => stations.find((station) => station.toLowerCase() === value.trim().toLowerCase());
  const boarding = canonicalStation(form.boarding);
  const destination = canonicalStation(form.destination);
  if (!form.boarding.trim()) errors.boarding = "Enter a boarding station.";
  else if (!boarding) errors.boarding = "Choose a valid boarding station from the suggestions.";
  if (!form.destination.trim()) errors.destination = "Enter a destination station.";
  else if (!destination) errors.destination = "Choose a valid destination station from the suggestions.";
  else if (boarding === destination) errors.destination = "Choose a destination different from your boarding station.";
  const date = new Date(`${form.travelDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.travelDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== form.travelDate) {
    errors.travelDate = "Choose a valid journey date.";
  } else if (form.travelDate < today) errors.travelDate = "Choose today or a future journey date.";
  return { errors, search: { boarding, destination, travelDate: form.travelDate } };
}

export function searchParams({ boarding, destination, travelDate }, sort = "departure") {
  return new URLSearchParams({ boarding, destination, date: travelDate, sort: normalizeSort(sort) });
}
const validNumber = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
export function minimumTrainFare(train) {
  const fares = (train.coaches || []).map((coach) => coach.routeFare).filter(validNumber).map(Number);
  return fares.length ? Math.min(...fares) : validNumber(train.routeFare) ? Number(train.routeFare) : null;
}
function departureValue(train) {
  const time = train.boardingHalt?.departureTime;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "")) return Infinity;
  const dateTime = Date.parse(`${train.boardingDate}T${time}:00Z`);
  return Number.isFinite(dateTime) ? dateTime : Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
}
export function sortTrains(trains, sort) {
  const value = (train) => sort === "price" ? minimumTrainFare(train) ?? Infinity
    : sort === "duration" ? validNumber(train.durationMinutes) ? Number(train.durationMinutes) : Infinity
    : departureValue(train);
  return [...trains].sort((a, b) => {
    const left = value(a), right = value(b);
    return left === right ? 0 : left < right ? -1 : 1;
  });
}
