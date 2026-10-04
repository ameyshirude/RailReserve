// The URL carries the boarding date; seat inventory uses the train's service date.
export function bookingUrl(train, boarding, destination, travelDate) {
  const params = new URLSearchParams({
    boarding: train.boardingHalt?.stationName || boarding,
    destination: train.destinationHalt?.stationName || destination,
    date: train.boardingDate || travelDate,
  });
  return `/booking/${train.id}?${params}`;
}

export function formatJourneyDate(date) {
  if (!date) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
