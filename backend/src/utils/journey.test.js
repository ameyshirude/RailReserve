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

test("base fare uses telescopic distance slabs (per-km rate decreases with distance)", () => {
  // 50 km entirely in the first slab @ 0.55
  assert.equal(journeyDetails(origin, { distance: 50 }).baseRouteFare, 27.5);
  // 200 km = 50×0.55 + 150×0.45
  assert.equal(journeyDetails(origin, { distance: 200 }).baseRouteFare, 95);
  // 2000 km = 27.5 + 67.5 + 105 + 150 + 250
  assert.equal(journeyDetails(origin, { distance: 2000 }).baseRouteFare, 600);

  const shortPerKm = journeyDetails(origin, { distance: 50 }).baseRouteFare / 50;
  const longPerKm  = journeyDetails(origin, { distance: 2000 }).baseRouteFare / 2000;
  assert.ok(longPerKm < shortPerKm, "long journeys should be cheaper per km");
});

test("final fare applies class multiplier, reservation fee, AC GST and rounds to nearest ₹5", () => {
  const details = journeyDetails(origin, { distance: 2000 });

  assert.equal(details.distance, 2000);
  // SL: 600 + 20 reservation, no GST
  assert.equal(fareForCoach(details.baseRouteFare, "SL"), 620);
  // 3A: (600×2.8 + 40) × 1.05 = 1806 → 1805
  assert.equal(fareForCoach(details.baseRouteFare, "3A"), 1805);
  // 2A: (600×4.2 + 50) × 1.05 = 2698.5 → 2700
  assert.equal(fareForCoach(details.baseRouteFare, "2A"), 2700);
  // 1A: (600×6.5 + 60) × 1.05 = 4158 → 4160
  assert.equal(fareForCoach(details.baseRouteFare, "1A"), 4160);
  // journeyDetails defaults to SL
  assert.equal(details.routeFare, 620);
});

test("each coach class has its required minimum fare before fees and GST", () => {
  const baseFare = journeyDetails(origin, { distance: 10 }).baseRouteFare;

  // SL: 120 + 20
  assert.equal(fareForCoach(baseFare, "SL"), 140);
  // 3A: (430 + 40) × 1.05 = 493.5 → 495
  assert.equal(fareForCoach(baseFare, "3A"), 495);
  // 2A: (670 + 50) × 1.05 = 756 → 755
  assert.equal(fareForCoach(baseFare, "2A"), 755);
  // 1A: (1050 + 60) × 1.05 = 1165.5 → 1165
  assert.equal(fareForCoach(baseFare, "1A"), 1165);
});

test("all final fares are multiples of ₹5", () => {
  for (const km of [1, 37, 199, 451, 999, 1234, 3000]) {
    const base = journeyDetails(origin, { distance: km }).baseRouteFare;
    for (const cls of ["SL", "3A", "2A", "1A"]) {
      assert.equal(fareForCoach(base, cls) % 5, 0, `${cls} @ ${km} km`);
    }
  }
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
