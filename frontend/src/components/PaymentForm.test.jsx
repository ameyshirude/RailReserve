import React, { act } from "react";
import { createRoot } from "react-dom/client";
import PaymentForm from "./PaymentForm";
import { useStripe, useElements } from "@stripe/react-stripe-js";
import apiClient from "../api/axiosClient";

jest.mock("../api/axiosClient", () => ({ post: jest.fn() }));
jest.mock("@stripe/stripe-js", () => ({ loadStripe: jest.fn() }));
jest.mock("@stripe/react-stripe-js", () => ({
  useStripe: jest.fn(), useElements: jest.fn(),
  PaymentElement: ({ onReady }) => <button onClick={onReady}>Load payment fields</button>,
}));

let container, root, stripe, onSuccess;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  stripe = {
    retrievePaymentIntent: jest.fn().mockResolvedValue({ paymentIntent: { status: "requires_payment_method" } }),
    confirmPayment: jest.fn().mockResolvedValue({ paymentIntent: { id: "pi_test", status: "succeeded" } }),
  };
  useStripe.mockReturnValue(stripe);
  useElements.mockReturnValue({});
  apiClient.post.mockResolvedValue({ data: {} });
  onSuccess = jest.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function mount() {
  await act(async () => root.render(<PaymentForm amount={450} bookingId={20} clientSecret="test-secret" onSuccess={onSuccess} />));
}
async function click(text) {
  await act(async () => [...container.querySelectorAll("button")].find((el) => el.textContent.includes(text)).click());
}

test("a paid intent restored after refresh only verifies the existing payment", async () => {
  stripe.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { id: "pi_paid", status: "succeeded" } });
  await mount();
  await click("Confirm paid booking");
  expect(stripe.confirmPayment).not.toHaveBeenCalled();
  expect(apiClient.post).toHaveBeenCalledWith("/bookings/verify-payment", { bookingId: 20, paymentIntentId: "pi_paid" });
  expect(onSuccess).toHaveBeenCalledTimes(1);
});

test("failed ticket verification can be retried without submitting another payment", async () => {
  apiClient.post.mockRejectedValueOnce(new Error("Offline"));
  await mount();
  await click("Load payment fields");
  await click("Pay ₹450");
  expect(container.querySelector('[role="alert"]').textContent).toContain("won’t be charged again");
  await click("Confirm paid booking");
  expect(stripe.confirmPayment).toHaveBeenCalledTimes(1);
  expect(apiClient.post).toHaveBeenCalledTimes(2);
  expect(onSuccess).toHaveBeenCalledTimes(1);
});

test("declined payments display a persistent error and do not confirm a ticket", async () => {
  stripe.confirmPayment.mockResolvedValue({ error: { message: "Your card was declined." } });
  await mount();
  await click("Load payment fields");
  await click("Pay ₹450");
  expect(container.querySelector('[role="alert"]').textContent).toBe("Your card was declined.");
  expect(apiClient.post).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
});
