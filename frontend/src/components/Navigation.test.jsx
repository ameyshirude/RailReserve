import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import App from "../App";
import { AuthProvider } from "../context/AuthContext";
import apiClient from "../api/axiosClient";

jest.mock("../api/axiosClient", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn() } }));
jest.mock("../pages/Home", () => () => <h1>Search page</h1>);
jest.mock("../pages/Booking", () => () => <h1>Booking page</h1>);
jest.mock("../pages/Login", () => () => <h1>Passenger login</h1>);
jest.mock("../pages/Register", () => () => <h1>Registration</h1>);
jest.mock("../pages/Dashboard", () => () => <h1>My bookings page</h1>);
jest.mock("../pages/AdminDashboard", () => () => <h1>Admin overview page</h1>);
jest.mock("../pages/TrainManagement", () => () => <h1>Train management page</h1>);

const passenger = { id: 1, username: "Passenger", role: "USER" };
const admin = { id: 2, username: "Administrator", role: "ADMIN" };
let root, container;
function Location() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="url">{location.pathname + location.search}</output><button onClick={() => navigate(-1)}>Back</button><button onClick={() => navigate("/?date=2026-10-08")}>Change search</button></>;
}
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  sessionStorage.clear();
  window.innerWidth = 375;
  apiClient.get.mockResolvedValue({ data: { user: null } });
  apiClient.post.mockResolvedValue({ data: {} });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function mount(user = null, entry = "/") {
  if (user) apiClient.get.mockResolvedValue({ data: { user } });
  await act(async () => root.render(<MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthProvider><App /><Location /></AuthProvider></MemoryRouter>));
}
async function click(element) { await act(async () => element.click()); }
function link(label) { return [...container.querySelectorAll("a")].find((element) => element.textContent === label); }
function button(label) { return [...container.querySelectorAll("button")].find((element) => element.textContent === label); }
function toggle() { return container.querySelector(".rr-hamburger"); }
function url() { return container.querySelector('[data-testid="url"]').textContent; }

test("guests have search and sign-in links without passenger or admin-only destinations", async () => {
  await mount();
  expect(link("Search trains").getAttribute("aria-current")).toBe("page");
  expect(link("Sign in").getAttribute("href")).toBe("/login");
  expect(link("Create account").getAttribute("href")).toBe("/register");
  expect(link("Admin login").getAttribute("href")).toBe("/admin-login");
  expect(link("My bookings")).toBeUndefined();
  expect(link("Administration")).toBeUndefined();
});

test("session loading avoids flashing guest account controls", async () => {
  let resolve;
  apiClient.get.mockReturnValue(new Promise((done) => { resolve = done; }));
  await mount();
  expect(container.querySelector('[role="status"]').textContent).toBe("Checking session…");
  expect(link("Sign in")).toBeUndefined();
  await act(async () => resolve({ data: { user: passenger } }));
  expect(link("My bookings")).toBeDefined();
  expect(container.querySelector('[role="status"]')).toBeNull();
});

test("passenger navigation follows routes and closes when selecting the current link", async () => {
  await mount(passenger, "/dashboard");
  expect(link("My bookings").getAttribute("aria-current")).toBe("page");
  expect(container.querySelector(".rr-account__name").textContent).toBe("Passenger");
  expect(link("Administration")).toBeUndefined();
  await click(toggle());
  expect(toggle().getAttribute("aria-expanded")).toBe("true");
  expect(toggle().getAttribute("aria-controls")).toBe("rr-navigation-links");
  await click(link("My bookings"));
  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  await click(link("Search trains"));
  expect(url()).toBe("/");
  expect(link("Search trains").getAttribute("aria-current")).toBe("page");
  await click(button("Back"));
  expect(link("My bookings").getAttribute("aria-current")).toBe("page");
});

test("Escape closes the disclosure and restores focus to its button", async () => {
  await mount(passenger);
  await click(toggle());
  await act(async () => link("My bookings").focus());
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(toggle());
});

test("outside pointer or focus, route changes, and desktop resizing dismiss the mobile menu", async () => {
  await mount();
  await click(toggle());
  await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  await click(toggle());
  await act(async () => button("Back").focus());
  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  await click(toggle());
  await click(button("Change search"));
  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  await click(toggle());
  await act(async () => { window.innerWidth = 1024; window.dispatchEvent(new Event("resize")); });
  expect(toggle().getAttribute("aria-expanded")).toBe("false");
});

test("admin layout is shared across protected pages with the correct active destination", async () => {
  await mount(admin, "/admin/trains");
  expect(link("Administration").getAttribute("aria-current")).toBe("true");
  expect(link("Manage trains").getAttribute("aria-current")).toBe("page");
  expect(link("Overview").getAttribute("aria-current")).toBeNull();
  expect(link("My bookings")).toBeUndefined();
  await click(link("Overview"));
  expect(url()).toBe("/admin-dashboard");
  expect(container.textContent).toContain("Admin overview page");
  expect(link("Overview").getAttribute("aria-current")).toBe("page");
  await click(link("Search trains"));
  expect(container.querySelector('nav[aria-label="Administration"]')).toBeNull();
});

test("passengers cannot access the admin layout through a direct URL", async () => {
  await mount(passenger, "/admin/trains");
  expect(url()).toBe("/");
  expect(container.querySelector('nav[aria-label="Administration"]')).toBeNull();
});

test("admin sign-in returns to the requested protected page and keeps query parameters", async () => {
  apiClient.post.mockResolvedValue({ data: { user: admin } });
  await mount(null, "/admin/trains?view=all");
  expect(url()).toBe("/admin-login");
  expect(container.querySelector('nav[aria-label="Administration"]')).toBeNull();
  await act(async () => Simulate.submit(container.querySelector("form")));
  expect(url()).toBe("/admin/trains?view=all");
  expect(link("Manage trains").getAttribute("aria-current")).toBe("page");
});

test("admin sign-in defaults safely when given an external return URL", async () => {
  apiClient.post.mockResolvedValue({ data: { user: admin } });
  await mount(null, { pathname: "/admin-login", state: { from: "https://example.com/admin/trains" } });
  await act(async () => Simulate.submit(container.querySelector("form")));
  expect(url()).toBe("/admin-dashboard");
});

test("sign-out waits for the server, prevents repeats, clears booking drafts and returns home", async () => {
  let resolve;
  apiClient.post.mockReturnValue(new Promise((done) => { resolve = done; }));
  sessionStorage.setItem("railreserve:booking:1", "draft");
  sessionStorage.setItem("unrelated", "keep");
  await mount(passenger, "/dashboard");
  await click(button("Sign out"));
  expect(button("Signing out…").disabled).toBe(true);
  await click(button("Signing out…"));
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  expect(url()).toBe("/dashboard");
  await act(async () => resolve({ data: {} }));
  expect(url()).toBe("/");
  expect(link("Sign in")).toBeDefined();
  expect(sessionStorage.getItem("railreserve:booking:1")).toBeNull();
  expect(sessionStorage.getItem("unrelated")).toBe("keep");
});

test("failed sign-out keeps the account and drafts available for retry", async () => {
  apiClient.post.mockRejectedValueOnce(new Error("Network unavailable"));
  sessionStorage.setItem("railreserve:booking:1", "draft");
  await mount(passenger, "/dashboard");
  await click(button("Sign out"));
  expect(toast.error).toHaveBeenCalledWith("Could not sign out. Please try again.");
  expect(url()).toBe("/dashboard");
  expect(sessionStorage.getItem("railreserve:booking:1")).toBe("draft");
  expect(button("Sign out").disabled).toBe(false);
  await click(button("Sign out"));
  expect(url()).toBe("/");
});
