const test = require("node:test");
const assert = require("node:assert/strict");
const { verifyBookingPayment } = require("./verifyBookingPayment");

function fixture() {
  const state = {
    booking: { id: 1, userId: 7, status: "PENDING", passengers: [{ id: 10 }] },
    payment: { id: 2, bookingId: 1, stripePaymentId: "pi_test", status: "PENDING" },
  };
  const intent = { status: "succeeded", metadata: { bookingId: "1" } };
  const hooks = {};
  let stripeCalls = 0;
  function matches(row, where) {
    return Object.entries(where).every(([key, value]) => {
      if (key === "passengers") return row.passengers.length > 0;
      if (value?.in) return value.in.includes(row[key]);
      return row[key] === value;
    });
  }
  const prisma = {
    booking: {
      findFirst: async ({ where }) => matches(state.booking, where)
        ? structuredClone({ ...state.booking, payment: state.payment }) : null,
    },
    $transaction: async (callback) => {
      const working = structuredClone(state);
      const tx = Object.fromEntries(["booking", "payment"].map((model) => [model, {
        updateMany: async ({ where, data }) => {
          if (hooks[model]) {
            hooks[model](state);
            hooks[model](working);
          }
          if (!matches(working[model], where)) return { count: 0 };
          Object.assign(working[model], data);
          return { count: 1 };
        },
        findUnique: async () => structuredClone(working[model]),
      }]));
      const result = await callback(tx);
      Object.assign(state, working);
      return result;
    },
  };
  const stripe = { paymentIntents: { retrieve: async () => {
    stripeCalls += 1;
    hooks.stripe?.(state);
    return intent;
  } } };
  return {
    state, intent, hooks, get stripeCalls() { return stripeCalls; },
    verify: (overrides = {}) => verifyBookingPayment({
      prisma, stripe, bookingId: 1, paymentIntentId: "pi_test", userId: 7, ...overrides,
    }),
  };
}

test("successful verification is safe to repeat", async () => {
  const f = fixture();
  assert.equal((await f.verify()).status, "PAID");
  assert.equal(f.state.booking.status, "CONFIRMED");
  const confirmed = structuredClone(f.state);
  assert.equal((await f.verify()).status, "PAID");
  assert.deepEqual(f.state, confirmed);
});

for (const [bookingStatus, paymentStatus] of [
  ["CANCELLED", "PENDING"], ["CANCELLED", "PAID"],
  ["CANCELLED", "REFUNDED"], ["CONFIRMED", "REFUNDED"], ["PENDING", "FAILED"],
]) {
  test(`rejects ${bookingStatus}/${paymentStatus} without changing records`, async () => {
    const f = fixture();
    f.state.booking.status = bookingStatus;
    f.state.payment.status = paymentStatus;
    const before = structuredClone(f.state);
    await assert.rejects(f.verify(), { statusCode: 409 });
    assert.deepEqual(f.state, before);
    assert.equal(f.stripeCalls, 0);
  });
}

test("ownership and stored payment intent are checked before calling Stripe", async () => {
  const f = fixture();
  await assert.rejects(f.verify({ userId: 8 }), { statusCode: 404 });
  await assert.rejects(f.verify({ paymentIntentId: "pi_other" }), { statusCode: 403 });
  assert.equal(f.stripeCalls, 0);
});

test("invalid request values are rejected", async () => {
  const f = fixture();
  for (const bookingId of [null, [], [1], true, 0, -1, 1.5, "abc"]) {
    await assert.rejects(f.verify({ bookingId }), { statusCode: 400 });
  }
  for (const paymentIntentId of [null, [], 1, "", " "]) {
    await assert.rejects(f.verify({ paymentIntentId }), { statusCode: 400 });
  }
  assert.equal(f.stripeCalls, 0);
});

test("requires a successful Stripe intent with matching booking metadata", async () => {
  const f = fixture();
  f.intent.status = "processing";
  await assert.rejects(f.verify(), { statusCode: 400 });
  f.intent.status = "succeeded";
  f.intent.metadata = { bookingId: "99" };
  await assert.rejects(f.verify(), { statusCode: 403 });
  f.intent.metadata = undefined;
  await assert.rejects(f.verify(), { statusCode: 403 });
  assert.equal(f.state.payment.status, "PENDING");
});

test("a booking with no passengers cannot be confirmed and payment changes roll back", async () => {
  const f = fixture();
  f.state.booking.passengers = [];
  await assert.rejects(f.verify(), { statusCode: 409 });
  assert.equal(f.state.booking.status, "PENDING");
  assert.equal(f.state.payment.status, "PENDING");
});

test("cancellation during the Stripe call prevents confirmation", async () => {
  const f = fixture();
  f.hooks.stripe = (state) => { state.booking.status = "CANCELLED"; };
  await assert.rejects(f.verify(), { statusCode: 409 });
  assert.equal(f.state.booking.status, "CANCELLED");
  assert.equal(f.state.payment.status, "PENDING");
});

test("cancellation between transaction writes rolls back the payment update", async () => {
  const f = fixture();
  f.hooks.booking = (state) => { state.booking.status = "CANCELLED"; };
  await assert.rejects(f.verify(), { statusCode: 409 });
  assert.equal(f.state.booking.status, "CANCELLED");
  assert.equal(f.state.payment.status, "PENDING");
});

test("a concurrent refund cannot be overwritten", async () => {
  const f = fixture();
  f.hooks.payment = (state) => {
    state.payment.status = "REFUNDED";
    state.booking.status = "CANCELLED";
    state.booking.passengers = [];
  };
  await assert.rejects(f.verify(), { statusCode: 409 });
  assert.equal(f.state.payment.status, "REFUNDED");
  assert.equal(f.state.booking.status, "CANCELLED");
  assert.deepEqual(f.state.booking.passengers, []);
});

test("verification succeeds if a success webhook confirms during the Stripe call", async () => {
  const f = fixture();
  f.hooks.stripe = (state) => {
    state.payment.status = "PAID";
    state.booking.status = "CONFIRMED";
  };
  assert.equal((await f.verify()).status, "PAID");
  assert.equal(f.state.booking.status, "CONFIRMED");
});
