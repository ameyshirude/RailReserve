const ACTIVE_BOOKING_STATUSES = ["PENDING", "CONFIRMED"];
const VERIFIABLE_PAYMENT_STATUSES = ["PENDING", "PAID"];

function failure(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function confirmationConflict() {
  return failure(409, "This booking can no longer be confirmed. Check My bookings for its status and contact support if you were charged.");
}

async function verifyBookingPayment({ prisma, stripe, bookingId, paymentIntentId, userId }) {
  const id = Number(bookingId);
  if (!["string", "number"].includes(typeof bookingId) || !Number.isSafeInteger(id) || id < 1 ||
      typeof paymentIntentId !== "string" || !paymentIntentId.trim()) {
    throw failure(400, "A valid bookingId and paymentIntentId are required.");
  }

  const booking = await prisma.booking.findFirst({
    where: { id, userId },
    include: { payment: true },
  });
  if (!booking) throw failure(404, "Booking not found.");
  if (!ACTIVE_BOOKING_STATUSES.includes(booking.status) ||
      !booking.payment || !VERIFIABLE_PAYMENT_STATUSES.includes(booking.payment.status)) {
    throw confirmationConflict();
  }
  if (booking.payment.stripePaymentId !== paymentIntentId) {
    throw failure(403, "Payment does not match this booking.");
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status !== "succeeded") {
    throw failure(400, "Payment has not completed yet.");
  }
  if (paymentIntent.metadata?.bookingId !== String(id)) {
    throw failure(403, "Payment does not match this booking.");
  }

  return prisma.$transaction(async (tx) => {
    const paymentUpdate = await tx.payment.updateMany({
      where: {
        id: booking.payment.id,
        bookingId: id,
        stripePaymentId: paymentIntentId,
        status: { in: VERIFIABLE_PAYMENT_STATUSES },
      },
      data: { status: "PAID" },
    });
    if (paymentUpdate.count !== 1) throw confirmationConflict();

    const bookingUpdate = await tx.booking.updateMany({
      where: {
        id,
        userId,
        status: { in: ACTIVE_BOOKING_STATUSES },
        passengers: { some: {} },
      },
      data: { status: "CONFIRMED" },
    });
    if (bookingUpdate.count !== 1) throw confirmationConflict();

    return tx.payment.findUnique({ where: { bookingId: id } });
  });
}

module.exports = { verifyBookingPayment };
