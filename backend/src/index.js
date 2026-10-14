require("dotenv").config();

// for missing env variables
const REQUIRED_ENV = ["DATABASE_URL", "JWT_SECRET", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`❌  Missing required environment variable(s): ${missing.join(", ")}`);
  process.exit(1);
}

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const prisma = require("./prismaClient");
const { createUniquePnr } = require("./utils/bookingPresenter");
const { bookingLimiter, searchLimiter } = require("./middleware/rateLimiter");

const authRoutes      = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const trainRoutes     = require("./routes/trainRoutes");
const trainSearchRoutes = require("./routes/trainSearchRoutes");
const bookingRoutes   = require("./routes/bookingRoutes");
const webhookRoutes   = require("./routes/webhookRoutes");
const stationRoutes   = require("./routes/stationRoutes");

const app = express();

app.use(helmet());

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  credentials: true,
};

app.use(
  "/api/webhook/stripe",
  express.raw({ type: "application/json" }),
  webhookRoutes
);

app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth",         authRoutes);
app.use("/api",              dashboardRoutes);
app.use("/api/admin/trains", trainRoutes);
app.use("/api/trains",       searchLimiter, trainSearchRoutes);
app.use("/api/stations",     searchLimiter, stationRoutes);
app.use("/api/bookings",     bookingLimiter, bookingRoutes);

app.use("/api", (req, res) => res.status(404).json({ message: "Not found." }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error." });
});

const cleanupInterval = setInterval(async () => {
  try {
    // removing  th expired reservations
    const delRes = await prisma.reservation.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    if (delRes.count > 0) {
      console.log(`[cleanup] Deleted ${delRes.count} expired reservation(s).`);
    }

    // removing more than 15 min bookings
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const delBookings = await prisma.booking.updateMany({
      where: {
        status: "PENDING",
        bookedAt: { lte: fifteenMinsAgo },
      },
      data: { status: "CANCELLED" },
    });
    
    if (delBookings.count > 0) {
      console.log(`[cleanup] Cancelled ${delBookings.count} expired PENDING booking(s).`);
    }
  } catch (err) {
    console.error("[cleanup] error:", err.message);
  }
}, 60 * 1000);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
  console.log(`Railway reservation API listening on http://localhost:${PORT}`)
);

// Graceful shutdown — drain connections and stop background jobs on deploy/restart
async function gracefulShutdown(signal) {
  console.log(`\n[shutdown] ${signal} received. Shutting down gracefully…`);

  clearInterval(cleanupInterval);

  server.close(async () => {
    console.log("[shutdown] HTTP server closed.");
    try {
      await prisma.$disconnect();
      console.log("[shutdown] Prisma disconnected.");
    } catch (err) {
      console.error("[shutdown] Prisma disconnect error:", err.message);
    }
    try {
      await prisma.$pool.end();
      console.log("[shutdown] pg pool drained.");
    } catch (err) {
      console.error("[shutdown] pg pool drain error:", err.message);
    }
    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    console.error("[shutdown] Forced exit after 10s timeout.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));
