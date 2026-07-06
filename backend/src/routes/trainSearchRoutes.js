const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const prisma = require("../prismaClient");

const router = express.Router();

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function parseTravelDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseRunningDays(value) {
  try {
    const days = JSON.parse(value);
    if (Array.isArray(days)) return days.map(Number);
  } catch (_) {}
  return ALL_DAYS;
}

function dateRange(date) {
  const start = new Date(date);
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

// GET /api/trains/search?boarding=X&destination=Y&date=YYYY-MM-DD
router.get("/search", async (req, res) => {
  const { boarding, destination, date } = req.query;
  if (!boarding || !destination)
    return res.status(400).json({ message: "Both boarding and destination are required." });
  const travelDate = parseTravelDate(date);
  if (!travelDate)
    return res.status(400).json({ message: "A valid travel date is required." });
  if (boarding.toLowerCase() === destination.toLowerCase())
    return res.status(400).json({ message: "Boarding and destination cannot be the same." });

  try {
    const trains = await prisma.train.findMany({
      where: {
        halts: { some: { stationName: { equals: boarding, mode: "insensitive" } } },
      },
      include: {
        halts:   { orderBy: { order: "asc" } },
        coaches: true,
      },
    });

    const matching = trains
      .map((train) => {
        const runningDays = parseRunningDays(train.runningDays);
        if (!runningDays.includes(travelDate.getUTCDay())) return null;

        const bHalt = train.halts.find(
          (h) => h.stationName.toLowerCase() === boarding.toLowerCase()
        );
        const dHalt = train.halts.find(
          (h) => h.stationName.toLowerCase() === destination.toLowerCase()
        );
        if (!bHalt || !dHalt || dHalt.order <= bHalt.order) return null;
        return { ...train, boardingHalt: bHalt, destinationHalt: dHalt };
      })
      .filter(Boolean);

    res.json({ trains: matching });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Search failed." });
  }
});

// GET /api/trains/:id/coaches
router.get("/:id/coaches", requireAuth, requireRole("USER"), async (req, res) => {
  const trainId = Number(req.params.id);
  const travelDate = parseTravelDate(req.query.date);
  if (!travelDate)
    return res.status(400).json({ message: "A valid travel date is required." });
  const { start, end } = dateRange(travelDate);

  try {
    const coaches = await prisma.coach.findMany({
      where: { trainId },
      include: {
        bookingSeats: {
          where: {
            booking: {
              status: "CONFIRMED",
              travelDate: { gte: start, lt: end },
            },
          },
          select: { seatNumber: true },
        },
        reservations: {
          where:  { expiresAt: { gt: new Date() }, travelDate: { gte: start, lt: end } },
          select: { seatNumbers: true },
        },
      },
    });

    const result = coaches.map((coach) => {
      const bookedNums = new Set(coach.bookingSeats.map((bs) => bs.seatNumber));
      const reservedNums = new Set();
      coach.reservations.forEach((r) => {
        JSON.parse(r.seatNumbers).forEach((n) => reservedNums.add(n));
      });
      const available = Array.from({ length: coach.totalSeats }, (_, i) => i + 1).filter(
        (n) => !bookedNums.has(n) && !reservedNums.has(n)
      );
      return {
        id:             coach.id,
        name:           coach.name,
        totalSeats:     coach.totalSeats,
        availableSeats: available.length,
        price:          coach.price,
      };
    });

    res.json({ coaches: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load coaches." });
  }
});

module.exports = router;
