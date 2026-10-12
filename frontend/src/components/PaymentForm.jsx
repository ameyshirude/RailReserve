import React, { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import apiClient from "../api/axiosClient";

// Initializing Stripe
export const stripePromise = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY) : null;

export const stripeAppearance = {
  theme: "flat",
  variables: {
    colorPrimary:    "#4338ca",
    colorBackground: "#ffffff",
    colorText:       "#1d2b36",
    colorDanger:     "#b42318",
    fontFamily:      "Inter, system-ui, sans-serif",
    borderRadius:    "6px",
  },
  rules: {
    ".Input": {
      border:    "1px solid #dee2e6",
      boxShadow: "none",
    },
    ".Input:focus": {
      border:    "1px solid #4338ca",
      boxShadow: "0 0 0 0.2rem rgba(67,56,202,0.2)",
    },
    ".Label": {
      fontFamily:    "Inter, system-ui, sans-serif",
      fontWeight:    "600",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      fontSize:      "0.75rem",
      color:         "#4a5a68",
    },
  },
};

// Stripe payment form
export default function PaymentForm({ amount, bookingId, clientSecret, onSuccess }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [paying,              setPaying]              = useState(false);
  const [paymentElementReady, setPaymentElementReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [paidIntentId, setPaidIntentId] = useState(null);
  const [checkingPayment, setCheckingPayment] = useState(true);
  const [verificationBlocked, setVerificationBlocked] = useState(false);

  // A refresh after payment must offer verification, rather than another charge.
  useEffect(() => {
    if (!stripe) return;
    let cancelled = false;
    stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent, error }) => {
      if (error) throw error;
      if (!cancelled && paymentIntent?.status === "succeeded") setPaidIntentId(paymentIntent.id);
    }).catch(() => {
      if (!cancelled) setErrorMessage("Couldn’t check payment status. Please refresh before trying again.");
    }).finally(() => { if (!cancelled) setCheckingPayment(false); });
    return () => { cancelled = true; };
  }, [stripe, clientSecret]);

  const verifyPayment = async (paymentIntentId) => {
    try {
      await apiClient.post("/bookings/verify-payment", { bookingId, paymentIntentId });
      onSuccess();
    } catch (err) {
      if (err.response?.status === 409) {
        setVerificationBlocked(true);
        setErrorMessage(err.response.data?.message || "This booking can no longer be confirmed. Check My bookings for its status and contact support if you were charged.");
      } else {
        setErrorMessage("Payment received, but we couldn’t confirm your ticket. Retry confirmation; you won’t be charged again.");
      }
      setPaying(false);
    }
  };

  const handlePay = async () => {
    if (paying || checkingPayment || verificationBlocked) return;
    setErrorMessage("");
    if (paidIntentId) {
      setPaying(true);
      await verifyPayment(paidIntentId);
      return;
    }
    if (!stripe || !elements || !paymentElementReady) return;

    setPaying(true);

    let result;
    try {
      result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // for redirect based payment methods
          return_url: `${window.location.origin}/dashboard`,
        },
        redirect: "if_required", // for standard card payments
      });
    } catch (err) {
      setErrorMessage(err.message || "Payment form is still loading. Please try again.");
      setPaying(false);
      return;
    }

    const { error, paymentIntent } = result;

    if (error) {
      setErrorMessage(error.message);
      setPaying(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      setPaidIntentId(paymentIntent.id);
      await verifyPayment(paymentIntent.id);
    } else {
      setErrorMessage("Payment was not completed. Please check its status before trying again.");
      setPaying(false);
    }
  };

  return (
    <>
      {errorMessage && <p className="booking-error" role="alert">{errorMessage}</p>}
      {paidIntentId && !verificationBlocked && <p role="status">Payment received. Confirm your ticket to finish.</p>}
      {verificationBlocked && <p><a href="/dashboard">View My bookings</a></p>}
      {!paidIntentId && <PaymentElement
        onReady={() => setPaymentElementReady(true)}
        onLoadError={(event) => {
          setErrorMessage(event.error?.message || "Payment form failed to load. Try refreshing the page.");
        }}
      />}

      <button
        type="button"
        className="btn btn-primary w-100 mt-3"
        onClick={handlePay}
        disabled={verificationBlocked || paying || checkingPayment || (!paidIntentId && (!stripe || !elements || !paymentElementReady))}
      >
        {verificationBlocked
          ? "Booking cannot be confirmed"
          : paying
          ? "Processing…"
          : checkingPayment
          ? "Checking payment…"
          : paidIntentId
          ? "Confirm paid booking"
          : paymentElementReady
          ? `Pay ₹${amount.toLocaleString("en-IN")}`
          : "Loading payment form…"}
      </button>
    </>
  );
}
