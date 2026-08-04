require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const prisma = require("./prismaClient");
const { createUniquePnr } = require("./utils/bookingPresenter");

const authRoutes      = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const trainRoutes     = require("./routes/trainRoutes");
const trainSearchRoutes = require("./routes/trainSearchRoutes");
const bookingRoutes   = require("./routes/bookingRoutes");
const webhookRoutes   = require("./routes/webhookRoutes");
const stationRoutes   = require("./routes/stationRoutes");

const app = express();

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
app.use("/api/trains",       trainSearchRoutes);
app.use("/api/stations",     stationRoutes);
app.use("/api/bookings",     bookingRoutes);

app.use("/api", (req, res) => res.status(404).json({ message: "Not found." }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error." });
});

setInterval(async () => {
  try {
    const expired = await prisma.reservation.findMany({
      where:   { expiresAt: { lte: new Date() } },
      include: { coach: true },
    });

    if (expired.length === 0) return;

    let cancelledCount = 0;
    for (const r of expired) {
      try {
        await prisma.$transaction(async (tx) => {
          const del = await tx.reservation.deleteMany({
            where: { id: r.id, expiresAt: { lte: new Date() } },
          });
          if (del.count === 0) return;

          await tx.booking.create({
            data: {
              pnr:            await createUniquePnr(tx),
              userId:         r.userId,
              trainId:        r.coach.trainId,
              coachId:        r.coachId,
              boarding:       "Expired reservation",
              destination:    "Expired reservation",
              travelDate:     r.travelDate,
              status:         "CANCELLED",
              cancelledSeats: r.seatNumbers,
            },
          });
          cancelledCount++;
        });
      } catch (err) {
        console.error(`[cleanup] Failed to process reservation ${r.id}:`, err.message);
      }
    }

    if (cancelledCount > 0) {
      console.log(
        `[cleanup] Released and marked ${cancelledCount} expired reservation(s) as CANCELLED.`
      );
    }
  } catch (err) {
    console.error("[cleanup] error:", err.message);
  }
}, 60 * 1000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Railway reservation API listening on http://localhost:${PORT}`)
);
