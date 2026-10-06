import { localDate, minimumTrainFare, sortTrains, validateSearch } from "./trainSearch";

test("calendar shortcuts use local dates and roll over month and year boundaries", () => {
  expect(localDate(0, new Date(2026, 0, 2, 0, 15))).toBe("2026-01-02");
  expect(localDate(1, new Date(2026, 11, 31, 23, 45))).toBe("2027-01-01");
  expect(localDate(1, new Date(2028, 1, 28, 23))).toBe("2028-02-29");
});

test("fares include free seats, ignore missing values and sort unknown prices last", () => {
  const free = { id: 1, coaches: [{ routeFare: null }, { routeFare: 0 }] };
  const paid = { id: 2, coaches: [{ routeFare: "900" }, { routeFare: 120 }] };
  const unknown = { id: 3, coaches: [{ routeFare: null }, {}] };
  expect(minimumTrainFare(free)).toBe(0);
  expect(minimumTrainFare(paid)).toBe(120);
  const input = [unknown, paid, free];
  expect(sortTrains(input, "price").map((train) => train.id)).toEqual([1, 2, 3]);
  expect(input.map((train) => train.id)).toEqual([3, 2, 1]);
});

test("duration ordering supports journeys over 24 hours and leaves missing values last", () => {
  const trains = [{ id: 1, durationMinutes: null }, { id: 2, durationMinutes: 1560 }, { id: 3, durationMinutes: 480 }, { id: 4, durationMinutes: 480 }];
  expect(sortTrains(trains, "duration").map((train) => train.id)).toEqual([3, 4, 2, 1]);
});

test("station names are normalized and impossible dates are rejected", () => {
  const form = { boarding: " jalgaon ", destination: "MUMBAI", travelDate: "2028-02-29" };
  expect(validateSearch(form, ["Jalgaon", "Mumbai"], "2028-02-01")).toEqual({ errors: {}, search: { boarding: "Jalgaon", destination: "Mumbai", travelDate: "2028-02-29" } });
  expect(validateSearch({ ...form, travelDate: "2027-02-29" }, ["Jalgaon", "Mumbai"], "2027-02-01").errors.travelDate).toBeTruthy();
});
