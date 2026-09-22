const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const prisma = require("../prismaClient");
const {
  fareForCoach,
  dateForHalt,
  findRouteHalts,
  journeyDetails,
  parseRunningDays,
  parseTravelDate,
  serviceDateForBoarding,
  toDateInputValue,
} = require("../utils/journey");

const router = express.Router();

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
  const boardingDate = parseTravelDate(date);
  if (!boardingDate)
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
        const route = findRouteHalts(train.halts, boarding, destination);
        if (!route) return null;

        const serviceDate = serviceDateForBoarding(boardingDate, route.boardingHalt);
        const runningDays = parseRunningDays(train.runningDays);
        if (!runningDays.includes(serviceDate.getUTCDay())) return null;
        const destinationDate = dateForHalt(
          serviceDate,
          route.destinationHalt,
          "arrivalDay",
          "departureDay"
        );
        const details = journeyDetails(route.boardingHalt, route.destinationHalt);
        const coaches = train.coaches.map((coach) => ({
          ...coach,
          routeFare: fareForCoach(details.baseRouteFare, coach.type),
        }));

        return {
          ...train,
          coaches,
          boardingHalt: route.boardingHalt,
          destinationHalt: route.destinationHalt,
          serviceDate: toDateInputValue(serviceDate),
          boardingDate: toDateInputValue(boardingDate),
          destinationDate: toDateInputValue(destinationDate),
          ...details,
        };
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
  const { boarding, destination } = req.query;
  if (!travelDate)
    return res.status(400).json({ message: "A valid travel date is required." });
  const { start, end } = dateRange(travelDate);

  try {
    const train = await prisma.train.findUnique({
      where: { id: trainId },
      include: {
        halts: { orderBy: { order: "asc" } },
        coaches: {
          include: {
            bookingSeats: {
              where: {
                booking: {
                  status: { in: ["CONFIRMED", "PENDING"] },
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
        },
      },
    });
    if (!train) return res.status(404).json({ message: "Train not found." });

    const route = boarding && destination ? findRouteHalts(train.halts, boarding, destination) : null;
    const baseRouteFare = route
      ? journeyDetails(route.boardingHalt, route.destinationHalt).baseRouteFare
      : null;

    const result = train.coaches.map((coach) => {
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
        type:           coach.type,
        totalSeats:     coach.totalSeats,
        availableSeats: available.length,
        routeFare:      baseRouteFare === null ? 0 : fareForCoach(baseRouteFare, coach.type),
      };
    });

    res.json({ coaches: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load coaches." });
  }
});

module.exports = router;
