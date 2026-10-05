import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";
import apiClient from "../api/axiosClient";
import TrainManagement from "./TrainManagement";

jest.mock("../api/axiosClient", () => ({ get: jest.fn(), delete: jest.fn() }));
jest.mock("react-toastify", () => ({ toast: { success: jest.fn() } }));
jest.mock("../components/TrainFormModal", () => ({ show, train, onClose, onSaved }) => show ? (
  <div role="dialog" aria-label="Train editor">
    <p>{train ? `Editing ${train.number}` : "Creating a train"}</p>
    <button onClick={onSaved}>Save test train</button>
    <button onClick={onClose}>Close editor</button>
  </div>
) : null);

const makeTrains = () => Array.from({ length: 21 }, (_, index) => ({
  id: index + 1,
  name: index === 20 ? "Overnight Special" : `Coastal Express ${index + 1}`,
  number: index === 20 ? "99999" : String(12900 + index),
  runningDays: JSON.stringify(index === 20 ? [0, 6] : index === 0 ? [1, 3, 5] : [0, 1, 2, 3, 4, 5, 6]),
  halts: index === 20 ? [
    { id: 3, order: 3, stationName: "Mumbai CSMT", arrivalTime: "09:00", arrivalDay: 2, distance: 430 },
    { id: 1, order: 1, stationName: "Jalgaon", departureTime: "23:00", departureDay: 1, distance: 0 },
    { id: 2, order: 2, stationName: "Surat", arrivalTime: "03:00", departureTime: "03:05", arrivalDay: 2, departureDay: 2, distance: 240 },
  ] : [{ id: 1, order: 1, stationName: "Pune", distance: 0 }, { id: 2, order: 2, stationName: "Mumbai", distance: 200 }],
  coaches: [{ id: 1, name: index === 20 ? "A1" : "S1", type: index === 20 ? "2A" : "SL", totalSeats: 72 }],
  _count: { bookings: index === 20 ? 0 : 7 },
}));

let container, root, trains;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  Element.prototype.scrollIntoView = jest.fn();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  trains = makeTrains();
  apiClient.get.mockImplementation(() => Promise.resolve({ data: { trains } }));
  apiClient.delete.mockResolvedValue({ data: {} });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function mount() {
  await act(async () => root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TrainManagement /></MemoryRouter>));
}
async function change(selector, value) {
  await act(async () => Simulate.change(container.querySelector(selector), { target: { value } }));
}
async function click(element) { await act(async () => element.click()); }
function button(label) { return [...container.querySelectorAll("button")].find((element) => element.textContent === label); }
function rows() { return [...container.querySelectorAll(".admin-trains__table tbody tr")]; }

test("searches name, number and intermediate stations across the entire catalog", async () => {
  await mount();
  expect(rows()).toHaveLength(10);
  for (const query of ["  OVERNIGHT  ", "99999", "surat", "jalgaon mumbai"]) {
    await change("#admin-train-search", query);
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain("Overnight Special");
  }
  expect(apiClient.get).toHaveBeenCalledTimes(1);
});

test("combines Sunday, class, and booking filters and resets all controls", async () => {
  await mount();
  await change("#admin-train-day", "0");
  await change("#admin-train-class", "2A");
  await change("#admin-train-bookings", "without");
  expect(rows()).toHaveLength(1);
  expect(rows()[0].textContent).toContain("99999");
  await change("#admin-train-day", "1");
  expect(container.textContent).toContain("No matching trains");
  await click(button("Show all trains"));
  expect(rows()).toHaveLength(10);
  expect(container.querySelector("#admin-train-class").value).toBe("");
  expect(container.querySelector("#admin-train-bookings").value).toBe("");
  await change("#admin-train-day", "daily");
  expect(container.textContent).toContain("19 of 21 trains match your filters");
});

test("paginates without overlap and resets to the first page on search or size changes", async () => {
  await mount();
  const firstPage = rows().map((row) => row.textContent);
  expect(container.querySelector('[aria-label="Previous page"]').disabled).toBe(true);
  await click(container.querySelector('[aria-label="Next page"]'));
  expect(rows()).toHaveLength(10);
  expect(rows().some((row) => firstPage.includes(row.textContent))).toBe(false);
  expect(container.textContent).toContain("Showing 11–20 of 21 trains");
  await change("#admin-train-search", "Overnight");
  expect(container.textContent).toContain("Page 1 of 1");
  await click(button("Clear filters"));
  await change("#admin-train-page-size", "25");
  expect(rows()).toHaveLength(21);
  expect(container.querySelector('[aria-label="Next page"]').disabled).toBe(true);
});

test("collapsed route summaries expose ordered timetable details on desktop and mobile", async () => {
  await mount();
  await change("#admin-train-search", "99999");
  const desktop = rows()[0];
  expect(desktop.querySelector(".admin-route__summary").textContent).toContain("Jalgaon");
  expect(desktop.querySelector(".admin-route__summary").textContent).not.toContain("Surat");
  const route = desktop.querySelector("details");
  expect(route.open).toBe(false);
  await click(route.querySelector("summary"));
  expect(route.open).toBe(true);
  expect([...route.querySelectorAll("li strong")].map((node) => node.textContent)).toEqual(["Jalgaon", "Surat", "Mumbai CSMT"]);
  expect(route.textContent).toContain("Arr 03:00 · Day 2");
  expect(route.textContent).toContain("240 km from origin");
  const mobileCard = container.querySelector(".admin-train-card");
  expect(mobileCard.textContent).toContain("Overnight Special");
  expect(mobileCard.querySelectorAll("button")).toHaveLength(2);
});

test("deleting the last train on the last page returns to a populated page", async () => {
  await mount();
  await click(container.querySelector('[aria-label="Next page"]'));
  await click(container.querySelector('[aria-label="Next page"]'));
  expect(rows()).toHaveLength(1);
  await click(rows()[0].querySelector('[aria-label^="Delete"]'));
  expect(apiClient.delete).not.toHaveBeenCalled();
  expect(container.querySelector("dialog").open).toBe(true);
  expect(document.activeElement.textContent).toBe("Cancel");
  await click(button("Delete train"));
  expect(apiClient.delete).toHaveBeenCalledWith("/admin/trains/21");
  expect(container.querySelector("dialog")).toBeNull();
  expect(container.textContent).toContain("Page 2 of 2");
  expect(rows()).toHaveLength(10);
});

test("a rejected delete keeps the train and shows the server reason in the confirmation", async () => {
  apiClient.delete.mockRejectedValueOnce({ response: { data: { message: "This train has booking history and cannot be deleted." } } });
  await mount();
  await click(rows()[0].querySelector('[aria-label^="Delete"]'));
  await click(button("Delete train"));
  expect(container.querySelector('dialog [role="alert"]').textContent).toContain("booking history");
  expect(rows()).toHaveLength(10);
  await click(button("Cancel"));
  expect(container.querySelector("dialog")).toBeNull();
});

test("editing uses the selected train and refreshes the filtered results after save", async () => {
  await mount();
  await change("#admin-train-search", "Overnight");
  await click(rows()[0].querySelector('[aria-label^="Edit"]'));
  expect(container.querySelector('[role="dialog"]').textContent).toContain("Editing 99999");
  trains = trains.map((train) => train.id === 21 ? { ...train, name: "Renamed service" } : train);
  await click(button("Save test train"));
  expect(container.querySelector("#admin-train-search").value).toBe("Overnight");
  expect(container.textContent).toContain("No matching trains");
  await click(button("+ Add train"));
  expect(container.querySelector('[role="dialog"]').textContent).toContain("Creating a train");
});

test("load failure offers retry and is distinct from an empty directory", async () => {
  apiClient.get.mockRejectedValueOnce(new Error("Offline"));
  await mount();
  expect(container.querySelector('[role="alert"]').textContent).toContain("Couldn’t load trains");
  expect(container.textContent).not.toContain("Your train directory is empty");
  trains = [];
  await click(button("Retry"));
  expect(container.textContent).toContain("Your train directory is empty");
  expect(container.textContent).not.toContain("No matching trains");
});
