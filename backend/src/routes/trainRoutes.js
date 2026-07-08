const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const prisma = require("../prismaClient");
const { isAllowedCoachName, normalizeCoachName } = require("../utils/journey");

const router = express.Router();
router.use(requireAuth, requireRole("ADMIN"));

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function normalizeRunningDays(days) {
  if (!Array.isArray(days)) return null;
  const clean = [...new Set(days.map(Number))]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
  return clean.length > 0 ? clean : null;
}

function normalizeDay(value) {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 ? day : 1;
}

function validateHalts(halts) {
  for (let i = 0; i < halts.length; i++) {
    const h = halts[i];
    if (!h.stationName) return `Halt ${i + 1}: station name is required.`;
    if (i > 0 && (h.price === undefined || h.price === "" || Number(h.price) < 0)) {
      return `Halt ${i + 1}: price must be 0 or greater.`;
    }
  }
  return null;
}

function haltData(h, i, trainId) {
  return {
    ...(trainId ? { trainId } : {}),
    stationName:   h.stationName,
    order:         i + 1,
    arrivalTime:   h.arrivalTime || null,
    departureTime: h.departureTime || null,
    arrivalDay:    normalizeDay(h.arrivalDay),
    departureDay:  normalizeDay(h.departureDay),
    price:         i === 0 ? 0 : Number(h.price) || 0,
  };
}

// GET /api/admin/trains
router.get("/", async (req, res) => {
  try {
    const trains = await prisma.train.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        halts:   { orderBy: { order: "asc" } },
        coaches: true,
        _count:  { select: { bookings: true } },
      },
    });
    res.json({ trains });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch trains." });
  }
});

// POST /api/admin/trains
router.post("/", async (req, res) => {
  const { name, number, halts = [], coaches = [], runningDays = ALL_DAYS } = req.body;
  const normalizedDays = normalizeRunningDays(runningDays);

  if (!name || !number)
    return res.status(400).json({ message: "Train name and number are required." });
  if (!normalizedDays)
    return res.status(400).json({ message: "Select at least one running day for the train." });
  if (halts.length < 2)
    return res.status(400).json({ message: "A train must have at least 2 halts." });
  const haltError = validateHalts(halts);
  if (haltError)
    return res.status(400).json({ message: haltError });
  if (coaches.length < 1)
    return res.status(400).json({ message: "A train must have at least 1 coach." });
  for (const c of coaches) {
    if (!c.name || !c.totalSeats || Number(c.totalSeats) < 1)
      return res.status(400).json({ message: "Each coach needs a name and valid seat count." });
    if (!isAllowedCoachName(c.name))
      return res.status(400).json({ message: "Coach name must be one of SL, 3A, 2A, or 1A." });
  }

  try {
    const train = await prisma.train.create({
      data: {
        name,
        number,
        runningDays: JSON.stringify(normalizedDays),
        halts: {
          create: halts.map((h, i) => haltData(h, i)),
        },
        coaches: {
          create: coaches.map((c) => ({
            name:       normalizeCoachName(c.name),
            totalSeats: Number(c.totalSeats),
            price:      Number(c.price) || 0,
          })),
        },
      },
      include: {
        halts:   { orderBy: { order: "asc" } },
        coaches: true,
      },
    });
    res.status(201).json({ train });
  } catch (err) {
    if (err.code === "P2002")
      return res.status(409).json({ message: "A train with that number already exists." });
    console.error(err);
    res.status(500).json({ message: "Failed to create train." });
  }
});

// PUT /api/admin/trains/:id
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, number, halts = [], coaches = [], runningDays = ALL_DAYS } = req.body;
  const normalizedDays = normalizeRunningDays(runningDays);

  if (!name || !number)
    return res.status(400).json({ message: "Train name and number are required." });
  if (!normalizedDays)
    return res.status(400).json({ message: "Select at least one running day for the train." });
  if (halts.length < 2)
    return res.status(400).json({ message: "A train must have at least 2 halts." });
  const haltError = validateHalts(halts);
  if (haltError)
    return res.status(400).json({ message: haltError });
  if (coaches.length < 1)
    return res.status(400).json({ message: "A train must have at least 1 coach." });
  for (const c of coaches) {
    if (!c.name || !c.totalSeats || Number(c.totalSeats) < 1)
      return res.status(400).json({ message: "Each coach needs a name and valid seat count." });
    if (!isAllowedCoachName(c.name))
      return res.status(400).json({ message: "Coach name must be one of SL, 3A, 2A, or 1A." });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.halt.deleteMany({ where: { trainId: id } });
      await tx.halt.createMany({
        data: halts.map((h, i) => haltData(h, i, id)),
      });

      const existingCoaches = await tx.coach.findMany({
        where:   { trainId: id },
        include: { _count: { select: { bookingSeats: true } } },
      });
      const deletableIds = existingCoaches
        .filter((c) => c._count.bookingSeats === 0)
        .map((c) => c.id);
      if (deletableIds.length > 0)
        await tx.coach.deleteMany({ where: { id: { in: deletableIds } } });

      const bookedCoaches = existingCoaches.filter((c) => c._count.bookingSeats > 0);
      for (const bc of bookedCoaches) {
        const incoming = coaches.find((c) => normalizeCoachName(c.name) === bc.name);
        if (incoming) {
          await tx.coach.update({
            where: { id: bc.id },
            data:  { price: Number(incoming.price) || 0 },
          });
        }
      }

      const bookedNames = new Set(bookedCoaches.map((c) => c.name));
      const toCreate = coaches.filter((c) => !bookedNames.has(normalizeCoachName(c.name)));
      if (toCreate.length > 0) {
        await tx.coach.createMany({
          data: toCreate.map((c) => ({
            trainId:    id,
            name:       normalizeCoachName(c.name),
            totalSeats: Number(c.totalSeats),
            price:      Number(c.price) || 0,
          })),
        });
      }

      await tx.train.update({
        where: { id },
        data: { name, number, runningDays: JSON.stringify(normalizedDays) },
      });
    });

    const updated = await prisma.train.findUnique({
      where:   { id },
      include: { halts: { orderBy: { order: "asc" } }, coaches: true },
    });
    res.json({ train: updated });
  } catch (err) {
    if (err.code === "P2002")
      return res.status(409).json({ message: "A train with that number already exists." });
    console.error(err);
    res.status(500).json({ message: "Failed to update train." });
  }
});

// DELETE /api/admin/trains/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.train.delete({ where: { id } });
    res.json({ message: "Train deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete train." });
  }
});

module.exports = router;
