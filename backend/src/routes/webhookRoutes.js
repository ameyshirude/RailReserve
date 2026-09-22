const express = require("express");
const Stripe  = require("stripe");
const prisma  = require("../prismaClient");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/", async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        if (pi.metadata?.bookingId) {
          await prisma.$transaction([
            prisma.payment.updateMany({
              where: { bookingId: Number(pi.metadata.bookingId), status: "PENDING" },
              data:  { status: "PAID" },
            }),
            prisma.booking.updateMany({
              where: { id: Number(pi.metadata.bookingId), status: "PENDING" },
              data:  { status: "CONFIRMED" },
            })
          ]);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        if (pi.metadata?.bookingId) {
          await prisma.$transaction([
            prisma.payment.updateMany({
              where: { bookingId: Number(pi.metadata.bookingId) },
              data:  { status: "FAILED" },
            }),
            prisma.booking.updateMany({
              where: { id: Number(pi.metadata.bookingId) },
              data:  { status: "CANCELLED" },
            }),
            prisma.bookingSeat.deleteMany({
              where: { bookingId: Number(pi.metadata.bookingId) },
            })
          ]);
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        if (charge.payment_intent) {
          await prisma.$transaction([
            prisma.payment.updateMany({
              where: { stripePaymentId: charge.payment_intent },
              data:  { status: "REFUNDED" },
            }),
            prisma.booking.updateMany({
              where: { payment: { stripePaymentId: charge.payment_intent } },
              data:  { status: "CANCELLED" },
            }),
            prisma.bookingSeat.deleteMany({
              where: { booking: { payment: { stripePaymentId: charge.payment_intent } } },
            })
          ]);
        }
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    res.status(500).json({ message: "Webhook processing failed." });
  }
});

module.exports = router;