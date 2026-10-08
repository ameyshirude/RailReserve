import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";
import apiClient from "../api/axiosClient";
import { downloadReceipt } from "../utils/downloadReceipt";

jest.mock("../api/axiosClient", () => ({ get: jest.fn() }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { username: "Asha", role: "USER" } }) }));
jest.mock("../utils/downloadReceipt", () => ({ downloadReceipt: jest.fn() }));

const makeBooking = (id, overrides = {}) => ({
  id, pnr: "RRTEST" + id, status: "CONFIRMED",
  train: { name: "Coastal Express " + id, number: String(12000 + id) },
  coach: { name: "S1", type: "SL" }, boarding: "Jalgaon", destination: "Mumbai",
  travelDate: "2026-10-08T00:00:00.000Z", startDateTime: "2026-10-08T09:00:00.000Z", arrivalDateTime: "2026-10-08T18:00:00.000Z",
  durationText: "9h", distance: 400, bookedAt: "2026-10-01T12:00:00Z",
  passengers: [{ id, passengerName: "Asha", passengerAge: 30, seatNumber: 12 }],
  payment: { amount: 500, status: "PAID", stripePaymentId: "pi_test" },
  ...overrides,
});
let root, container, bookings;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.resetAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-07T04:30:00Z"));
  Element.prototype.scrollIntoView = jest.fn();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: jest.fn().mockResolvedValue() } });
  bookings = [
    makeBooking(1),
    makeBooking(2, { travelDate: "2026-10-05", startDateTime: "2026-10-05T09:00:00Z", arrivalDateTime: "2026-10-05T18:00:00Z" }),
    makeBooking(3, { status: "CANCELLED", payment: { status: "REFUNDED", amount: 500 }, passengers: [] }),
    makeBooking(4, { status: "PENDING", payment: { status: "PENDING", amount: 500 } }),
    makeBooking(5, { boarding: "Pune", travelDate: "2026-10-06", startDateTime: "2026-10-06T23:00:00Z", arrivalDateTime: "2026-10-07T11:00:00Z", durationText: "12h" }),
    makeBooking(6, { train: null, coach: null, travelDate: null, startDateTime: null, arrivalDateTime: null, payment: null, passengers: [], distance: null }),
  ];
  apiClient.get.mockImplementation(() => Promise.resolve({ data: { bookings } }));
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.useRealTimers(); });
async function mount() { await act(async () => root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Dashboard /></MemoryRouter>)); }
async function click(element) { await act(async () => element.click()); }
async function change(selector, value) { await act(async () => Simulate.change(container.querySelector(selector), { target: { value } })); }
function button(label) { return [...container.querySelectorAll("button")].find((node) => node.textContent === label); }
function filter(label) { return [...container.querySelectorAll(".my-bookings__filter")].find((node) => node.textContent.startsWith(label)); }
function cards() { return [...container.querySelectorAll(".my-booking")]; }
function card(id) { return container.querySelector('[aria-labelledby="booking-title-' + id + '"]'); }
function order() { return cards().map((node) => Number(node.getAttribute("aria-labelledby").split("-").pop())); }

test("shows truthful statuses and prioritizes ongoing and upcoming journeys", async () => {
  await mount();
  expect(container.querySelector("h1").textContent).toBe("My bookings");
  expect(order()).toEqual([5, 1, 4, 2, 3, 6]);
  expect(filter("Upcoming").textContent).toBe("Upcoming2");
  expect(card(3).querySelector(".my-booking__badge").textContent).toBe("Cancelled");
  expect(card(3).textContent).toContain("Refunded");
  expect(card(4).querySelector(".my-booking__badge").textContent).toBe("Pending confirmation");
  expect(card(4).querySelector('[aria-label^="Download"]')).toBeNull();
  expect(card(5).textContent).toContain("Journey in progress");
  expect(card(5).querySelector(".my-booking__time").textContent).toBe("23:00");
  expect(card(5).textContent).toContain("07 Oct 2026");
});

test("filters each status, including date-unknown records in All", async () => {
  await mount();
  for (const [label, expected] of [["Upcoming", [5, 1]], ["Past", [2]], ["Cancelled", [3]], ["Pending", [4]], ["All", [5, 1, 4, 2, 3, 6]]]) {
    await click(filter(label));
    expect(order()).toEqual(expected);
    expect(filter(label).getAttribute("aria-pressed")).toBe("true");
  }
  expect(apiClient.get).toHaveBeenCalledTimes(1);
});

test("searches PNR, train name/number and multiple stations without refetching", async () => {
  await mount();
  for (const [query, expected] of [["  rrtest3 ", [3]], ["coastal express 4", [4]], ["12002", [2]], ["pune mumbai", [5]]]) {
    await change("#my-booking-search", query);
    expect(order()).toEqual(expected);
  }
  await click(filter("Cancelled"));
  expect(cards()).toHaveLength(0);
  expect(container.textContent).toContain("No matching bookings");
  await click(button("Show all bookings"));
  expect(cards()).toHaveLength(6);
  expect(container.querySelector("#my-booking-search").value).toBe("");
  expect(apiClient.get).toHaveBeenCalledTimes(1);
});

test("sorts journey dates and booking dates without mutating the API response", async () => {
  bookings[1].bookedAt = "2026-10-06T10:00:00Z";
  await mount();
  await change("#my-booking-sort", "booked");
  expect(order()[0]).toBe(2);
  await change("#my-booking-sort", "journey");
  expect(order()[0]).toBe(1);
  expect(order().at(-1)).toBe(6);
  expect(bookings.map((booking) => booking.id)).toEqual([1, 2, 3, 4, 5, 6]);
});

test("paginates, moves keyboard focus to results, and resets on a new filter", async () => {
  bookings = Array.from({ length: 14 }, (_, index) => makeBooking(index + 1));
  await mount();
  expect(cards()).toHaveLength(6);
  await click(container.querySelector('[aria-label="Next page"]'));
  expect(order()).toEqual([7, 8, 9, 10, 11, 12]);
  expect(document.activeElement).toBe(container.querySelector(".my-bookings__results"));
  await click(container.querySelector('[aria-label="Next page"]'));
  expect(order()).toEqual([13, 14]);
  expect(container.querySelector('[aria-label="Next page"]').disabled).toBe(true);
  await change("#my-booking-search", "RRTEST1");
  expect(order()).toEqual([1, 10, 11, 12, 13, 14]);
  expect(container.querySelector('[aria-label="Booking pages"]')).toBeNull();
});

test("expands ticket details, copies a PNR and downloads paid and refunded receipts", async () => {
  await mount();
  const details = card(1).querySelector("details");
  expect(details.open).toBe(false);
  await click(details.querySelector("summary"));
  expect(details.open).toBe(true);
  expect(details.textContent).toContain("Asha");
  expect(details.textContent).toContain("Seat 12");
  await click(card(1).querySelector('[aria-label^="Copy PNR"]'));
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith("RRTEST1");
  expect(card(1).querySelector('[role="status"]').textContent).toBe("PNR copied.");
  await click(card(1).querySelector('[aria-label^="Download"]'));
  expect(downloadReceipt).toHaveBeenCalledWith(bookings[0], 500);
  await click(card(3).querySelector('[aria-label^="Download refund"]'));
  expect(downloadReceipt).toHaveBeenCalledWith(bookings[2], 500);
});

test("reports clipboard and receipt errors without breaking other booking actions", async () => {
  navigator.clipboard.writeText.mockRejectedValue(new Error("Clipboard denied"));
  downloadReceipt.mockImplementation(() => { throw new Error("Download blocked"); });
  await mount();
  await click(card(1).querySelector('[aria-label^="Copy PNR"]'));
  expect(card(1).querySelector('[role="status"]').textContent).toContain("copy it manually");
  await click(card(1).querySelector('[aria-label^="Download"]'));
  expect(card(1).querySelector('[role="status"]').textContent).toContain("Could not download");
  expect(card(2).querySelector('[role="status"]').textContent).toBe("");
});

test("handles missing details and a zero-cost paid booking", async () => {
  bookings[0].payment.amount = 0;
  await mount();
  expect(card(6).textContent).toContain("Date unavailable");
  expect(card(6).textContent).not.toContain("Invalid Date");
  expect(card(6).textContent).not.toContain("0 km");
  expect(card(1).textContent).toContain("₹0.00");
  await click(card(1).querySelector('[aria-label^="Download"]'));
  expect(downloadReceipt).toHaveBeenCalledWith(bookings[0], 0);
});

test("loading and fetch errors are distinct from an empty account, with working retry", async () => {
  let reject;
  apiClient.get.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  await mount();
  expect(container.textContent).toContain("Loading your bookings");
  expect(container.textContent).not.toContain("You have no bookings");
  await act(async () => reject(new Error("Offline")));
  expect(container.querySelector('[role="alert"]').textContent).toContain("Could not load");
  expect(container.textContent).not.toContain("You have no bookings");
  await click(button("Try again"));
  expect(cards()).toHaveLength(6);
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

test("shows an actionable empty state and a separate session-expired error", async () => {
  bookings = [];
  await mount();
  expect(container.textContent).toContain("You have no bookings yet");
  expect([...container.querySelectorAll("a")].find((node) => node.textContent === "Book your first journey").getAttribute("href")).toBe("/");
  apiClient.get.mockRejectedValueOnce({ response: { status: 401 } });
  await click(button("Refresh bookings"));
  expect(container.querySelector('[role="alert"]').textContent).toContain("session has expired");
  expect([...container.querySelectorAll("a")].find((node) => node.textContent === "Sign in again").getAttribute("href")).toBe("/login");
});

test("a failed refresh retains existing results and filters", async () => {
  await mount();
  await change("#my-booking-search", "RRTEST1");
  apiClient.get.mockRejectedValueOnce(new Error("Offline"));
  await click(button("Refresh bookings"));
  expect(order()).toEqual([1]);
  expect(container.querySelector('[role="alert"]').textContent).toContain("Previously loaded bookings");
});

test("moves an overnight journey to Past at its scheduled arrival in IST", async () => {
  await mount();
  await click(filter("Upcoming"));
  expect(order()).toEqual([5, 1]);
  await act(async () => jest.advanceTimersByTime(60 * 60 * 1000));
  expect(order()).toEqual([1]);
  await click(filter("Past"));
  expect(order()).toEqual([5, 2]);
});
