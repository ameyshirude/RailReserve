import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Home from "./Home";
import apiClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";

jest.mock("../api/axiosClient", () => ({ get: jest.fn() }));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));

const stations = ["Jalgaon", "Mumbai", "Surat"];
const trains = [
  { id: 1, name: "Night train", number: "101", durationMinutes: 480, durationText: "8h", departure: "23:00", fare: 200 },
  { id: 2, name: "Morning train", number: "102", durationMinutes: 600, durationText: "10h", departure: "09:00", fare: 900 },
  { id: 3, name: "Fast train", number: "103", durationMinutes: 90, durationText: "1h 30m", departure: "12:00", fare: 500 },
].map((train) => ({ ...train, boardingDate: "2026-10-06", destinationDate: "2026-10-07", boardingHalt: { stationName: "Jalgaon", departureTime: train.departure }, destinationHalt: { stationName: "Mumbai", arrivalTime: "07:00" }, coaches: [{ type: "SL", routeFare: train.fare }] }));
const initialUrl = "/?boarding=Jalgaon&destination=Mumbai&date=2026-10-06";
let root, container;

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="url">{location.pathname + location.search}</output><button onClick={() => navigate(-1)}>History back</button><button onClick={() => navigate(1)}>History forward</button></>;
}

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 6, 12));
  jest.clearAllMocks();
  sessionStorage.clear();
  Element.prototype.scrollIntoView = jest.fn();
  useAuth.mockReturnValue({ user: { id: 1, role: "USER" } });
  apiClient.get.mockImplementation((url) => Promise.resolve({ data: url === "/stations" ? { stations } : { trains } }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.useRealTimers(); });
async function mount(entry = initialUrl) {
  await act(async () => root.render(<MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Navigation /><Routes><Route path="/" element={<Home />} /><Route path="/booking/:id" element={<p>Booking page</p>} /><Route path="/login" element={<p>Login page</p>} /></Routes></MemoryRouter>));
}
async function change(selector, value) { await act(async () => Simulate.change(container.querySelector(selector), { target: { value } })); }
async function click(element) { await act(async () => element.click()); }
async function submit() { await act(async () => Simulate.submit(container.querySelector("form"))); }
function button(text) { return [...container.querySelectorAll("button")].find((element) => element.textContent === text); }
function order() { return [...container.querySelectorAll(".train-result h3")].map((element) => element.textContent); }
function url() { return container.querySelector('[data-testid="url"]').textContent; }
function searches() { return apiClient.get.mock.calls.filter(([path]) => path === "/trains/search"); }

test("loads a shared search URL and restores journey and sort after a refresh", async () => {
  await mount(initialUrl + "&sort=price");
  expect(container.querySelector("#boarding").value).toBe("Jalgaon");
  expect(container.querySelector("#travelDate").value).toBe("2026-10-06");
  expect(order()).toEqual(["Night train", "Fast train", "Morning train"]);
  const savedUrl = url();
  await act(async () => root.unmount());
  root = createRoot(container);
  await mount(savedUrl);
  expect(container.querySelector("#train-sort").value).toBe("price");
  expect(order()[0]).toBe("Night train");
});

test("swaps both stations and only submits the reversed journey when requested", async () => {
  await mount();
  await click(container.querySelector(".search-swap"));
  expect(container.querySelector("#boarding").value).toBe("Mumbai");
  expect(container.querySelector("#destination").value).toBe("Jalgaon");
  expect(searches()).toHaveLength(1);
  expect(container.textContent).toContain("Your search details have changed");
  await submit();
  expect(searches()[1][1].params).toEqual({ boarding: "Mumbai", destination: "Jalgaon", date: "2026-10-06" });
  expect(url()).toContain("boarding=Mumbai");
});

test("date shortcuts update the draft and Back/Forward restore submitted searches", async () => {
  await mount();
  await click(button("Tomorrow"));
  expect(container.querySelector("#travelDate").value).toBe("2026-10-07");
  expect(button("Tomorrow").getAttribute("aria-pressed")).toBe("true");
  await submit();
  expect(url()).toContain("date=2026-10-07");
  await click(button("History back"));
  expect(container.querySelector("#travelDate").value).toBe("2026-10-06");
  await click(button("History forward"));
  expect(container.querySelector("#travelDate").value).toBe("2026-10-07");
  await click(button("Today"));
  expect(container.querySelector("#travelDate").value).toBe("2026-10-06");
});

test("validates missing, unknown and duplicate stations plus past and invalid URL dates", async () => {
  await mount("/");
  await submit();
  expect(container.querySelector("#boarding").getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement.id).toBe("boarding");
  await change("#boarding", "Jalgaon");
  await change("#destination", "Unknown");
  await submit();
  expect(container.querySelector("#destination-error").textContent).toContain("valid destination");
  await change("#destination", "jalgaon");
  await submit();
  expect(container.querySelector("#destination-error").textContent).toContain("different");
  expect(document.querySelector(".station-autocomplete__dropdown")).toBeNull();
  await change("#destination", "Mumbai");
  await change("#travelDate", "2026-10-05");
  await submit();
  expect(container.querySelector("#travelDate-error").textContent).toContain("future");
  expect(searches()).toHaveLength(0);
  await act(async () => root.unmount()); root = createRoot(container);
  await mount("/?boarding=Jalgaon&destination=Mumbai&date=2027-02-30");
  expect(container.querySelector("#travelDate-error").textContent).toContain("valid journey date");
  expect(searches()).toHaveLength(0);
});

test("sorts without refetching and preserves draft edits", async () => {
  await mount();
  expect(order()).toEqual(["Morning train", "Fast train", "Night train"]);
  await change("#destination", "Surat");
  await change("#train-sort", "duration");
  expect(order()).toEqual(["Fast train", "Night train", "Morning train"]);
  expect(container.querySelector("#destination").value).toBe("Surat");
  await change("#train-sort", "price");
  expect(order()).toEqual(["Night train", "Fast train", "Morning train"]);
  expect(url()).toContain("sort=price");
  expect(searches()).toHaveLength(1);
});

test("selection uses the submitted journey, not changed fields, and carries sort into booking", async () => {
  await mount(initialUrl + "&sort=duration");
  await change("#destination", "Surat");
  await click(button("Tomorrow"));
  await click(container.querySelector(".train-result button"));
  expect(url()).toBe("/booking/3?boarding=Jalgaon&destination=Mumbai&date=2026-10-06&sort=duration");
  await click(button("History back"));
  expect(container.querySelector("#destination").value).toBe("Mumbai");
  expect(container.querySelector("#train-sort").value).toBe("duration");
});

test("guest selection stores submitted journey and sort for login", async () => {
  useAuth.mockReturnValue({ user: null });
  await mount(initialUrl + "&sort=price");
  await click(button("Tomorrow"));
  await click(container.querySelector(".train-result button"));
  expect(url()).toBe("/login");
  expect(JSON.parse(sessionStorage.getItem("pendingBooking"))).toMatchObject({ boarding: "Jalgaon", destination: "Mumbai", travelDate: "2026-10-06", sort: "price" });
});

test("typed station edits cannot silently reuse an earlier selection", async () => {
  await mount();
  await change("#boarding", "Jalg");
  await submit();
  expect(container.querySelector("#boarding-error").textContent).toContain("valid boarding station");
  expect(searches()).toHaveLength(1);
  await act(async () => Simulate.keyDown(container.querySelector("#boarding"), { key: "ArrowDown" }));
  await act(async () => Simulate.keyDown(container.querySelector("#boarding"), { key: "Enter" }));
  expect(container.querySelector("#boarding").value).toBe("Jalgaon");
  await submit();
  expect(searches()).toHaveLength(2);
});

test("a slow earlier response cannot replace a newer journey", async () => {
  let resolveFirst;
  apiClient.get.mockImplementation((path, options) => {
    if (path === "/stations") return Promise.resolve({ data: { stations } });
    if (options.params.date === "2026-10-06") return new Promise((resolve) => { resolveFirst = resolve; });
    return Promise.resolve({ data: { trains: [{ ...trains[0], name: "Tomorrow train" }] } });
  });
  await mount();
  await click(button("Tomorrow"));
  await submit();
  expect(order()).toEqual(["Tomorrow train"]);
  await act(async () => resolveFirst({ data: { trains } }));
  expect(order()).toEqual(["Tomorrow train"]);
  expect(searches()[0][1].signal.aborted).toBe(true);
});

test("station and search failures expose retries without claiming no trains exist", async () => {
  apiClient.get.mockRejectedValueOnce(new Error("Offline"));
  await mount();
  expect(button("Retry stations")).toBeDefined();
  await click(button("Retry stations"));
  expect(order()).toHaveLength(3);
  apiClient.get.mockRejectedValueOnce(new Error("Offline"));
  await submit();
  expect(container.textContent).toContain("Search couldn’t be completed");
  expect(container.textContent).not.toContain("No trains on this route");
  apiClient.get.mockResolvedValueOnce({ data: { trains: [] } });
  await click(button("Retry search"));
  expect(container.textContent).toContain("No trains on this route");
});
