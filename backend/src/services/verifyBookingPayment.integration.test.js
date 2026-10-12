const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { verifyBookingPayment } = require("./verifyBookingPayment");

test("payment verification with PostgreSQL", { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const { Pool } = require("pg");
  const { PrismaPg } = require("@prisma/adapter-pg");
  const { PrismaClient } = require(process.env.TEST_PRISMA_CLIENT_PATH || "@prisma/client");
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  t.after(async () => { await prisma.$disconnect(); await pool.end(); });

  async function fixture(subtest) {
    const key = randomUUID();
    const user = await prisma.user.create({ data: {
      username: key, email: `${key}@example.test`, phone: key, passwordHash: "test",
    } });
    subtest.after(() => prisma.user.delete({ where: { id: user.id } }));
    const train = await prisma.train.create({ data: { name: "Verification test", number: key } });
    subtest.after(() => prisma.train.delete({ where: { id: train.id } }));
    const coach = await prisma.coach.create({ data: { trainId: train.id, name: "S1", type: "SL", totalSeats: 1 } });
    const booking = await prisma.booking.create({ data: {
      pnr: key, userId: user.id, trainId: train.id, coachId: coach.id,
      boarding: "A", destination: "B", travelDate: new Date("2030-01-01T00:00:00Z"),
      passengers: { create: { coachId: coach.id, seatNumber: 1, passengerName: "Test", passengerAge: 30 } },
      payment: { create: { stripePaymentId: `pi_${key}`, amount: 140 } },
    } });
    const intent = { status: "succeeded", metadata: { bookingId: String(booking.id) } };
    const stripe = { paymentIntents: { retrieve: async () => intent } };
    return {
      booking, coach, stripe, intent,
      verify: (client = prisma) => verifyBookingPayment({
        prisma: client, stripe, bookingId: booking.id, paymentIntentId: `pi_${key}`, userId: user.id,
      }),
      read: () => prisma.booking.findUnique({ where: { id: booking.id }, include: { payment: true, passengers: true } }),
    };
  }

  await t.test("simultaneous successful verifications are idempotent", async (subtest) => {
    const f = await fixture(subtest);
    const payments = await Promise.all([f.verify(), f.verify()]);
    assert.ok(payments.every((payment) => payment.status === "PAID"));
    assert.equal((await f.read()).status, "CONFIRMED");
  });

  await t.test("expired seats allocated elsewhere cannot be reclaimed", async (subtest) => {
    const f = await fixture(subtest);
    let replacement;
    f.stripe.paymentIntents.retrieve = async () => {
      await prisma.booking.update({ where: { id: f.booking.id }, data: { status: "CANCELLED" } });
      replacement = await prisma.booking.create({ data: {
        pnr: randomUUID(), userId: f.booking.userId, trainId: f.booking.trainId, coachId: f.coach.id,
        boarding: "A", destination: "B", travelDate: f.booking.travelDate, status: "CONFIRMED",
        passengers: { create: { coachId: f.coach.id, seatNumber: 1, passengerName: "Other", passengerAge: 30 } },
      } });
      return f.intent;
    };
    await assert.rejects(f.verify(), { statusCode: 409 });
    const original = await f.read();
    assert.equal(original.status, "CANCELLED");
    assert.equal(original.payment.status, "PENDING");
    assert.equal((await prisma.booking.findUnique({ where: { id: replacement.id } })).status, "CONFIRMED");
  });

  await t.test("a refund during verification stays refunded", async (subtest) => {
    const f = await fixture(subtest);
    await prisma.payment.update({ where: { bookingId: f.booking.id }, data: { status: "PAID" } });
    f.stripe.paymentIntents.retrieve = async () => {
      await prisma.$transaction([
        prisma.payment.update({ where: { bookingId: f.booking.id }, data: { status: "REFUNDED" } }),
        prisma.booking.update({ where: { id: f.booking.id }, data: { status: "CANCELLED" } }),
        prisma.bookingSeat.deleteMany({ where: { bookingId: f.booking.id } }),
      ]);
      return f.intent;
    };
    await assert.rejects(f.verify(), { statusCode: 409 });
    const result = await f.read();
    assert.equal(result.status, "CANCELLED");
    assert.equal(result.payment.status, "REFUNDED");
    assert.equal(result.passengers.length, 0);
  });

  await t.test("cancellation on another connection between writes rolls back payment", async (subtest) => {
    const f = await fixture(subtest);
    const client = {
      booking: prisma.booking,
      $transaction: (callback) => prisma.$transaction((tx) => callback({
        payment: tx.payment,
        booking: { updateMany: async (args) => {
          await prisma.booking.update({ where: { id: f.booking.id }, data: { status: "CANCELLED" } });
          return tx.booking.updateMany(args);
        } },
      })),
    };
    await assert.rejects(f.verify(client), { statusCode: 409 });
    const result = await f.read();
    assert.equal(result.status, "CANCELLED");
    assert.equal(result.payment.status, "PENDING");
  });
});
