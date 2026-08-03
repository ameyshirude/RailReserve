const test = require("node:test");
const assert = require("node:assert/strict");
const {
  fareForCoach,
  dateForHalt,
  findRouteHalts,
  journeyDetails,
  routeDistance,
  serviceDateForBoarding,
  toDateInputValue,
} = require("./journey");

const origin = { distance: 0 };
const middle = { distance: 100 };
const destination = { distance: 500 };

test("travelled distance is the difference between cumulative halt distances", () => {
  assert.equal(routeDistance(middle, destination), 400);
});

test("route lookup ignores station casing and surrounding spaces", () => {
  const halts = [
    { stationName: "Mumbai Central", order: 1 },
    { stationName: "Vadodara", order: 2 },
    { stationName: "New Delhi", order: 3 },
  ];

  const route = findRouteHalts(halts, " mumbai central ", "NEW DELHI ");

  assert.equal(route.boardingHalt.stationName, "Mumbai Central");
  assert.equal(route.destinationHalt.stationName, "New Delhi");
});

test("fare uses the per-kilometre rate and coach multiplier", () => {
  const details = journeyDetails(origin, { distance: 2000 });

  assert.equal(details.distance, 2000);
  assert.equal(details.baseRouteFare, 1100);
  assert.equal(fareForCoach(details.baseRouteFare, "SL"), 1100);
  assert.equal(fareForCoach(details.baseRouteFare, "3A"), 1980);
  assert.equal(fareForCoach(details.baseRouteFare, "2A"), 2420);
  assert.equal(fareForCoach(details.baseRouteFare, "1A"), 3520);
});

test("each coach class has its required minimum fare", () => {
  const baseFare = journeyDetails(origin, { distance: 10 }).baseRouteFare;

  assert.equal(fareForCoach(baseFare, "SL"), 120);
  assert.equal(fareForCoach(baseFare, "3A"), 430);
  assert.equal(fareForCoach(baseFare, "2A"), 670);
  assert.equal(fareForCoach(baseFare, "1A"), 1050);
});

test("search date is the date the train is available at the boarding halt", () => {
  const boardingDate = new Date("2026-07-16T00:00:00.000Z");
  const boardingHalt = { departureDay: 2, departureTime: "06:00" };
  const serviceDate = serviceDateForBoarding(boardingDate, boardingHalt);

  assert.equal(toDateInputValue(serviceDate), "2026-07-15");
  assert.equal(
    toDateInputValue(dateForHalt(serviceDate, boardingHalt, "departureDay", "arrivalDay")),
    "2026-07-16"
  );
});

test("destination date can be the day after the searched boarding date", () => {
  const serviceDate = new Date("2026-07-15T00:00:00.000Z");
  const destinationHalt = { arrivalDay: 3, arrivalTime: "03:00" };

  assert.equal(
    toDateInputValue(dateForHalt(serviceDate, destinationHalt, "arrivalDay", "departureDay")),
    "2026-07-17"
  );
});
