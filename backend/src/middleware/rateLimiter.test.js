const test = require("node:test");
const assert = require("node:assert/strict");
const { authLimiter, bookingLimiter } = require("./rateLimiter");

test("authLimiter and bookingLimiter are correctly defined express functions", () => {
  assert.equal(typeof authLimiter, "function");
  assert.equal(typeof bookingLimiter, "function");
});

test("rate limiters execute next() for standard request within limit", (_t, done) => {
  const req = {
    ip: "127.0.0.1",
    headers: {},
    path: "/test",
    method: "GET",
    app: { get: () => false },
  };

  const res = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    getHeader(name) {
      return this.headers[name];
    },
  };

  authLimiter(req, res, () => {
    assert.ok(true, "authLimiter called next()");
    done();
  });
});
