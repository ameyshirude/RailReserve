import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Booking from "./Booking";
import Login from "./Login";
import ProtectedRoute from "../components/ProtectedRoute";
import TrainResultCard from "../components/TrainResultCard";
import apiClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import { bookingUrl } from "../utils/bookingRoute";

jest.mock("../api/axiosClient", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@stripe/react-stripe-js", () => ({ Elements: ({ children }) => children }));
jest.mock("../components/PaymentForm", () => ({
  __esModule: true,
  default: ({ onSuccess }) => <button onClick={onSuccess}>Finish test payment</button>,
  stripePromise: {}, stripeAppearance: {},
}));

const coach = { id: 7, name: "S1", type: "SL", availableSeats: 12, totalSeats: 40, routeFare: 450 };
const train = {
  id: 12, number: "12952", name: "Overnight Express", durationText: "8h 30m",
  serviceDate: "2026-10-09", boardingDate: "2026-10-10", destinationDate: "2026-10-10",
  boardingHalt: { stationName: "Mumbai", departureTime: "01:30" },
  destinationHalt: { stationName: "Surat", arrivalTime: "10:00" },
  coaches: [coach],
};
const route = bookingUrl(train, "Mumbai", "Surat", "2026-10-10");
const draftKey = "railreserve:booking:1:12:Mumbai:Surat:2026-10-10";
let container;
let root;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.scrollTo = jest.fn();
  sessionStorage.clear();
  jest.clearAllMocks();
  useAuth.mockReturnValue({ user: { id: 1, role: "USER" }, loading: false, setUser: jest.fn() });
  apiClient.get.mockImplementation((url) => Promise.resolve({ data: url === "/trains/search" ? { trains: [train] } : { coaches: [coach] } }));
  apiClient.post.mockImplementation((url) => Promise.resolve({ data: url === "/bookings/reserve"
    ? { reservationId: 10, seatNumbers: [4], expiresAt: new Date(Date.now() + 600000).toISOString() }
    : { requiresPayment: true, clientSecret: "test-secret", amount: 450,
        booking: { id: 20, pnr: "TESTPNR", train, coach, passengers: [], boarding: "Mumbai", destination: "Surat" } } }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.useRealTimers();
});

async function mount(initialEntries = [route]) {
  await act(async () => root.render(
    <MemoryRouter initialEntries={initialEntries} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/booking/:trainId" element={<ProtectedRoute role="USER"><Booking /></ProtectedRoute>} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </MemoryRouter>
  ));
}

function button(text) {
  return [...container.querySelectorAll("button")].find((element) => element.textContent.includes(text));
}

async function click(element) { await act(async () => element.click()); }
async function change(selector, value) {
  const element = container.querySelector(selector);
  await act(async () => Simulate.change(element, { target: { value, name: element.name } }));
}
async function reserve() {
  await click(container.querySelector(".coach-option"));
  await click(button("Reserve 1"));
}

test("train result exposes a named native action and includes free fares in the minimum", async () => {
  const select = jest.fn();
  const withFreeClass = { ...train, coaches: [coach, { ...coach, id: 8, type: "2S", routeFare: 0 }] };
  await act(async () => root.render(<TrainResultCard train={withFreeClass} onSelect={select} />));
  const selectButton = button("Select train");
  expect(selectButton.getAttribute("aria-label")).toContain("Overnight Express");
  expect(selectButton.tabIndex).toBe(0);
  expect(container.querySelector(".train-result__fare").textContent).toBe("₹0");
  await click(selectButton);
  expect(select).toHaveBeenCalledWith(withFreeClass);
});

test("route reload uses boarding date for search and service date for overnight seat inventory", async () => {
  await mount();
  expect(apiClient.get).toHaveBeenCalledWith("/trains/search", { params: { boarding: "Mumbai", destination: "Surat", date: "2026-10-10" } });
  expect(apiClient.get).toHaveBeenCalledWith("/trains/12/coaches", { params: { boarding: "Mumbai", destination: "Surat", date: "2026-10-09" } });
  await reserve();
  expect(apiClient.post).toHaveBeenCalledWith("/bookings/reserve", { coachId: 7, count: 1, travelDate: "2026-10-09" });
  expect(document.activeElement.id).toBe("booking-step-title");
});

test("unavailable train never falls back to booking a different train", async () => {
  apiClient.get.mockResolvedValue({ data: { trains: [{ ...train, id: 99 }] } });
  await mount();
  expect(container.querySelector('[role="alert"]').textContent).toContain("no longer available");
  expect(container.querySelector(".coach-option")).toBeNull();
});

test("the results link preserves the boarding date and sort in its URL", async () => {
  await mount([`${route}&sort=price`]);
  const backLink = container.querySelector(".booking-back");
  const params = new URLSearchParams(backLink.getAttribute("href").split("?")[1]);
  expect(params.get("boarding")).toBe("Mumbai");
  expect(params.get("destination")).toBe("Surat");
  expect(params.get("date")).toBe("2026-10-10");
  expect(params.get("sort")).toBe("price");
});

test("direct booking links return to the selected journey after login", async () => {
  useAuth.mockReturnValue({ user: null, loading: false, setUser: jest.fn() });
  apiClient.post.mockResolvedValueOnce({ data: { user: { id: 1, role: "USER" } } });
  await mount();
  expect(container.textContent).toContain("Passenger Login");
  useAuth.mockReturnValue({ user: { id: 1, role: "USER" }, loading: false, setUser: jest.fn() });
  await act(async () => Simulate.submit(container.querySelector("form")));
  expect(container.textContent).toContain("Book your journey");
  expect(container.textContent).toContain("Overnight Express");
});

test("guest selection continues to the dedicated booking route after login", async () => {
  sessionStorage.setItem("pendingBooking", JSON.stringify({ train, boarding: "Mumbai", destination: "Surat", travelDate: "2026-10-10" }));
  apiClient.post.mockResolvedValueOnce({ data: { user: { id: 1, role: "USER" } } });
  await mount(["/login"]);
  await act(async () => Simulate.submit(container.querySelector("form")));
  expect(container.textContent).toContain("Book your journey");
  expect(sessionStorage.getItem("pendingBooking")).toBeNull();
});

test("expired holds refresh availability and preserve entered passengers", async () => {
  jest.useFakeTimers();
  await mount();
  await reserve();
  await change("#passenger-0-name", "Asha");
  await change("#passenger-0-age", "32");
  await act(async () => jest.advanceTimersByTime(601000));
  expect(container.textContent).toContain("Your seat reservation has expired");
  expect(button("Reservation Expired").disabled).toBe(true);
  await click(button("Check availability again"));
  await reserve();
  expect(container.querySelector("#passenger-0-name").value).toBe("Asha");
  expect(container.querySelector("#passenger-0-age").value).toBe("32");
});

test("server-side expiry stays expired on subsequent countdown ticks", async () => {
  jest.useFakeTimers();
  await mount();
  await reserve();
  await change("#passenger-0-name", "Asha");
  await change("#passenger-0-age", "32");
  apiClient.post.mockRejectedValueOnce({ response: { status: 410, data: { message: "Hold expired" } } });
  await click(button("Proceed to Payment"));
  await act(async () => jest.advanceTimersByTime(3000));
  expect(button("Reservation Expired").disabled).toBe(true);
  expect(button("Check availability again")).toBeDefined();
});

test("refresh restores passenger and payment steps without creating another reservation", async () => {
  await mount();
  await reserve();
  await change("#passenger-0-name", "Asha");
  await change("#passenger-0-age", "32");
  await act(async () => root.unmount());
  root = createRoot(container);
  await mount();
  expect(container.querySelector("#passenger-0-name").value).toBe("Asha");
  await click(button("Proceed to Payment"));
  expect(button("Finish test payment")).toBeDefined();
  await act(async () => root.unmount());
  root = createRoot(container);
  await mount();
  expect(button("Finish test payment")).toBeDefined();
  expect(apiClient.post.mock.calls.filter(([url]) => url === "/bookings/reserve")).toHaveLength(1);
  await click(button("Finish test payment"));
  expect(container.textContent).toContain("Booking Confirmed!");
  expect(sessionStorage.getItem(draftKey)).toBeNull();
});

test("invalid ages block confirmation and availability failures offer retry", async () => {
  apiClient.get.mockRejectedValueOnce(new Error("Offline"));
  await mount();
  expect(container.querySelector('[role="alert"]').textContent).toContain("couldn’t load");
  await click(button("Try again"));
  await reserve();
  await change("#passenger-0-name", "Asha");
  await change("#passenger-0-age", "121");
  expect(button("Proceed to Payment").disabled).toBe(true);
  await change("#passenger-0-age", "32");
  expect(button("Proceed to Payment").disabled).toBe(false);
});
