const express = require("express");
const Stripe  = require("stripe");
const { requireAuth, requireRole } = require("../middleware/auth");
const prisma = require("../prismaClient");
const { verifyBookingPayment } = require("../services/verifyBookingPayment");
const {
  findRouteHalts,
  parseRunningDays,
  parseTravelDate,
} = require("../utils/journey");
const {
  createUniquePnr,
  journeyFields,
  presentBooking,
} = require("../utils/bookingPresenter");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

function dateRange(date) {
  const start = new Date(date);
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function lockCoachForReservation(tx, coachId) {
  await tx.$queryRaw`
    SELECT id FROM "coaches" WHERE id = ${Number(coachId)} FOR UPDATE
  `;
}

// POST /api/bookings/reserve
router.post("/reserve", requireAuth, requireRole("USER"), async (req, res) => {
  const { coachId, count, travelDate: travelDateValue } = req.body;
  const userId = req.user.id;
  const travelDate = parseTravelDate(travelDateValue);

  if (!coachId || !count || Number(count) < 1)
    return res.status(400).json({ message: "coachId and a positive count are required." });
  if (!travelDate)
    return res.status(400).json({ message: "A valid travel date is required." });

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      const coach = await tx.coach.findUnique({
        where: { id: Number(coachId) },
        include: { train: true },
      });
      if (!coach) throw Object.assign(new Error("Coach not found."), { statusCode: 404 });
      if (!parseRunningDays(coach.train.runningDays).includes(travelDate.getUTCDay())) {
        throw Object.assign(new Error("This train does not run on the selected date."), {
          statusCode: 409,
        });
      }

      const { start, end } = dateRange(travelDate);
      await lockCoachForReservation(tx, coachId);

      const bookedSeats = await tx.bookingSeat.findMany({
        where:  {
          coachId: Number(coachId),
          booking: {
            status: { in: ["CONFIRMED", "PENDING"] },
            travelDate: { gte: start, lt: end },
          },
        },
        select: { seatNumber: true },
      });
      const activeReservations = await tx.reservation.findMany({
        where:  {
          coachId: Number(coachId),
          expiresAt: { gt: new Date() },
          travelDate: { gte: start, lt: end },
        },
        select: { seatNumbers: true },
      });

      const bookedNums = new Set(bookedSeats.map((s) => s.seatNumber));
      const reservedNums = new Set();
      activeReservations.forEach((r) => {
        JSON.parse(r.seatNumbers).forEach((n) => reservedNums.add(n));
      });

      const toReserve = [];
      for (let i = 1; i <= coach.totalSeats && toReserve.length < Number(count); i++) {
        if (!bookedNums.has(i) && !reservedNums.has(i)) toReserve.push(i);
      }

      if (toReserve.length < Number(count)) {
        throw Object.assign(
          new Error(`Only ${toReserve.length} seat(s) available in this coach.`),
          { statusCode: 409 }
        );
      }

      await tx.reservation.deleteMany({
        where: { userId, coachId: Number(coachId), expiresAt: { lte: new Date() } },
      });

      return tx.reservation.create({
        data: {
          userId,
          coachId:     Number(coachId),
          seatNumbers: JSON.stringify(toReserve),
          travelDate,
          expiresAt:   new Date(Date.now() + 10 * 60 * 1000),
        },
      });
    });

    res.status(201).json({
      reservationId: reservation.id,
      seatNumbers:   JSON.parse(reservation.seatNumbers),
      expiresAt:     reservation.expiresAt,
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Failed to reserve seats." });
  }
});

// POST /api/bookings/confirm
router.post("/confirm", requireAuth, requireRole("USER"), async (req, res) => {
  const { reservationId, boarding, destination, passengers } = req.body;
  const userId = req.user.id;

  if (
    !reservationId ||
    !boarding ||
    !destination ||
    !Array.isArray(passengers) ||
    passengers.length === 0
  )
    return res.status(400).json({ message: "All fields are required." });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where:   { id: Number(reservationId), userId, expiresAt: { gt: new Date() } },
        include: {
          coach: {
            include: {
              train: { include: { halts: { orderBy: { order: "asc" } } } },
            },
          },
        },
      });

      if (!reservation) {
        throw Object.assign(
          new Error("Your session has expired. Please try again and re-select your seats."),
          { statusCode: 410 }
        );
      }

      if (!parseRunningDays(reservation.coach.train.runningDays).includes(reservation.travelDate.getUTCDay())) {
        throw Object.assign(new Error("This train does not run on the selected date."), {
          statusCode: 409,
        });
      }

      const route = findRouteHalts(reservation.coach.train.halts, boarding, destination);
      if (!route) {
        throw Object.assign(
          new Error("This train does not halt at the selected boarding and destination stations in that order."),
          { statusCode: 409 }
        );
      }
      const details = journeyFields(
        { travelDate: reservation.travelDate },
        route,
        reservation.coach.type
      );

      const seatNumbers = JSON.parse(reservation.seatNumbers);
      if (passengers.length !== seatNumbers.length) {
        throw Object.assign(
          new Error("Passenger count does not match the number of reserved seats."),
          { statusCode: 400 }
        );
      }

      const newBooking = await tx.booking.create({
        data: {
          pnr:        await createUniquePnr(tx),
          userId,
          trainId:     reservation.coach.trainId,
          coachId:     reservation.coachId,
          boarding,
          destination,
          travelDate:  reservation.travelDate,
          status:      "PENDING",
          passengers: {
            create: passengers.map((p, i) => ({
              coachId:       reservation.coachId,
              seatNumber:    seatNumbers[i],
              passengerName: p.name,
              passengerAge:  Number(p.age),
            })),
          },
        },
        include: {
          train:      { select: { name: true, number: true } },
          coach:      { select: { name: true, type: true } },
          passengers: true,
        },
      });

      await tx.reservation.delete({ where: { id: reservation.id } });

      return {
        booking: {
          ...newBooking,
          routeFare: details.routeFare,
          distance: details.distance,
          durationMinutes: details.durationMinutes,
          durationText: details.durationText,
          startDateTime: details.startDateTime,
          arrivalDateTime: details.arrivalDateTime,
        },
        routeFare: details.routeFare,
      };
    });

    const { booking, routeFare } = result;
    const totalAmount = routeFare * booking.passengers.length;

    if (totalAmount > 0) {
      let paymentIntent;
      try {
        paymentIntent = await stripe.paymentIntents.create({
          amount:   Math.round(totalAmount * 100),
          currency: "inr",
          metadata: { bookingId: String(booking.id) },
          automatic_payment_methods: { enabled: true },
        });
      } catch (stripeErr) {
        // Stripe call failed — roll back the booking so seats are released
        await prisma.$transaction([
          prisma.bookingSeat.deleteMany({ where: { bookingId: booking.id } }),
          prisma.booking.update({
            where: { id: booking.id },
            data:  { status: "CANCELLED" },
          }),
        ]);
        console.error("Stripe paymentIntent creation failed:", stripeErr.message);
        return res.status(502).json({ message: "Payment service unavailable. Please try again." });
      }

      const payment = await prisma.payment.create({
        data: {
          bookingId:       booking.id,
          stripePaymentId: paymentIntent.id,
          amount:          totalAmount,
          currency:        "inr",
          status:          "PENDING",
        },
      });

      return res.status(201).json({
        booking: { ...booking, payment, stripeId: payment.stripePaymentId },
        clientSecret:    paymentIntent.client_secret,
        amount:          totalAmount,
        requiresPayment: true,
      });
    }

    const payment = await prisma.payment.create({
      data: {
        bookingId:       booking.id,
        stripePaymentId: null,
        amount:          0,
        currency:        "inr",
        status:          "PAID",
      },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED" },
    });
    booking.status = "CONFIRMED";

    return res.status(201).json({
      booking: { ...booking, payment, stripeId: payment.stripePaymentId },
      clientSecret:    null,
      amount:          0,
      requiresPayment: false,
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Failed to confirm booking." });
  }
});

// POST /api/bookings/verify-payment
router.post("/verify-payment", requireAuth, requireRole("USER"), async (req, res) => {
  const { bookingId, paymentIntentId } = req.body;
  const userId = req.user.id;

  try {
    const payment = await verifyBookingPayment({
      prisma, stripe, bookingId, paymentIntentId, userId,
    });
    res.json({ payment });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Failed to verify payment." });
  }
});

//refund handling from admin
// POST /api/bookings/refund 
router.post("/refund", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ message: "bookingId is required." });

  try {
    const payment = await prisma.payment.findUnique({
      where: { bookingId: Number(bookingId) },
    });

    if (!payment)
      return res.status(404).json({ message: "No payment record found for this booking." });
    if (payment.status === "REFUNDED")
      return res.status(400).json({ message: "This payment has already been refunded." });
    if (payment.status !== "PAID")
      return res.status(400).json({ message: "Only successful payments can be refunded." });

    if (payment.stripePaymentId && payment.amount > 0) {
      await stripe.refunds.create({ payment_intent: payment.stripePaymentId });
    }

    const [updatedPayment] = await prisma.$transaction([
      prisma.payment.update({
        where: { bookingId: Number(bookingId) },
        data:  { status: "REFUNDED" },
      }),
      prisma.booking.update({
        where: { id: Number(bookingId) },
        data:  { status: "CANCELLED" },
      }),
      prisma.bookingSeat.deleteMany({
        where: { bookingId: Number(bookingId) },
      })
    ]);

    res.json({ payment: updatedPayment, message: "Refund processed successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to process refund." });
  }
});

//fetching bookings
// GET /api/bookings/my
router.get("/my", requireAuth, requireRole("USER"), async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where:   { userId: req.user.id },
      orderBy: { bookedAt: "desc" },
      include: {
        train:      { select: { name: true, number: true, halts: { orderBy: { order: "asc" } } } },
        coach:      { select: { name: true, type: true } },
        passengers: true,
        payment:    true,
      },
    });
    res.json({
      bookings: bookings.map(presentBooking),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch your bookings." });
  }
});

module.exports = router;
