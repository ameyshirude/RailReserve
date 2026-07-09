const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const prisma = require("../prismaClient");
const { isAllowedCoachType, normalizeCoachType } = require("../utils/journey");

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

function normalizeCoachIdentifier(value) {
  return String(value || "").trim().toUpperCase();
}

function validateCoaches(coaches) {
  if (!Array.isArray(coaches) || coaches.length < 1)
    return "A train must have at least 1 coach.";

  const names = new Set();
  const ids = new Set();
  for (let i = 0; i < coaches.length; i++) {
    const coach = coaches[i];
    const name = normalizeCoachIdentifier(coach.name);
    const seats = Number(coach.totalSeats);

    if (!name)
      return `Coach ${i + 1}: coach name is required.`;
    if (name.length > 30)
      return `Coach ${i + 1}: coach name must be 30 characters or fewer.`;
    if (names.has(name))
      return `Coach name "${name}" is used more than once.`;
    names.add(name);

    if (!isAllowedCoachType(coach.type))
      return `Coach ${i + 1}: type must be one of SL, 3A, 2A, or 1A.`;
    if (!Number.isInteger(seats) || seats < 1 || seats > 999)
      return `Coach ${i + 1}: total seats must be a whole number from 1 to 999.`;

    if (coach.id !== undefined && coach.id !== null) {
      const id = Number(coach.id);
      if (!Number.isInteger(id) || id < 1 || ids.has(id))
        return `Coach ${i + 1}: invalid coach id.`;
      ids.add(id);
    }
  }
  return null;
}

function validateHalts(halts) {
  if (!Array.isArray(halts)) return "Halts must be an array.";
  for (let i = 0; i < halts.length; i++) {
    const h = halts[i];
    if (!String(h.stationName || "").trim())
      return `Halt ${i + 1}: station name is required.`;

    const distance = Number(h.distance);
    if (h.distance === undefined || h.distance === "" || !Number.isFinite(distance))
      return `Halt ${i + 1}: distance must be a valid number.`;
    if (i === 0 && distance !== 0)
      return "The origin station distance must be 0 km.";
    if (i > 0 && distance <= Number(halts[i - 1].distance))
      return `Halt ${i + 1}: distance must be greater than the previous halt.`;
  }
  return null;
}

function haltData(h, i, trainId) {
  return {
    ...(trainId ? { trainId } : {}),
    stationName:   h.stationName.trim(),
    order:         i + 1,
    arrivalTime:   h.arrivalTime || null,
    departureTime: h.departureTime || null,
    arrivalDay:    normalizeDay(h.arrivalDay),
    departureDay:  normalizeDay(h.departureDay),
    distance:      i === 0 ? 0 : Number(h.distance),
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

  if (!String(name || "").trim() || !String(number || "").trim())
    return res.status(400).json({ message: "Train name and number are required." });
  if (!normalizedDays)
    return res.status(400).json({ message: "Select at least one running day for the train." });
  if (!Array.isArray(halts) || halts.length < 2)
    return res.status(400).json({ message: "A train must have at least 2 halts." });
  const haltError = validateHalts(halts);
  if (haltError)
    return res.status(400).json({ message: haltError });
  const coachError = validateCoaches(coaches);
  if (coachError)
    return res.status(400).json({ message: coachError });

  try {
    const train = await prisma.train.create({
      data: {
        name: name.trim(),
        number: number.trim(),
        runningDays: JSON.stringify(normalizedDays),
        halts: {
          create: halts.map((h, i) => haltData(h, i)),
        },
        coaches: {
          create: coaches.map((c) => ({
            name:       normalizeCoachIdentifier(c.name),
            type:       normalizeCoachType(c.type),
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

  if (!String(name || "").trim() || !String(number || "").trim())
    return res.status(400).json({ message: "Train name and number are required." });
  if (!normalizedDays)
    return res.status(400).json({ message: "Select at least one running day for the train." });
  if (!Array.isArray(halts) || halts.length < 2)
    return res.status(400).json({ message: "A train must have at least 2 halts." });
  const haltError = validateHalts(halts);
  if (haltError)
    return res.status(400).json({ message: haltError });
  const coachError = validateCoaches(coaches);
  if (coachError)
    return res.status(400).json({ message: coachError });

  try {
    await prisma.$transaction(async (tx) => {
      const existingCoaches = await tx.coach.findMany({
        where:   { trainId: id },
        include: {
          bookingSeats: { select: { seatNumber: true } },
          reservations: {
            where: { expiresAt: { gt: new Date() } },
            select: { seatNumbers: true },
          },
        },
      });

      const existingById = new Map(existingCoaches.map((coach) => [coach.id, coach]));
      for (const coach of coaches) {
        if (coach.id && !existingById.has(Number(coach.id))) {
          throw Object.assign(new Error("A submitted coach does not belong to this train."), {
            statusCode: 400,
          });
        }
      }

      const submittedIds = new Set(
        coaches.filter((coach) => coach.id).map((coach) => Number(coach.id))
      );
      const removedCoaches = existingCoaches.filter((coach) => !submittedIds.has(coach.id));
      for (const coach of removedCoaches) {
        if (coach.bookingSeats.length > 0) {
          throw Object.assign(
            new Error(`Coach ${coach.name} has booking history and cannot be removed.`),
            { statusCode: 409 }
          );
        }
        if (coach.reservations.length > 0) {
          throw Object.assign(
            new Error(`Coach ${coach.name} has an active seat reservation. Try again later.`),
            { statusCode: 409 }
          );
        }
      }

      for (const incoming of coaches.filter((coach) => coach.id)) {
        const existing = existingById.get(Number(incoming.id));
        const reservedSeats = existing.reservations.flatMap((reservation) => {
          try {
            const seats = JSON.parse(reservation.seatNumbers);
            return Array.isArray(seats) ? seats.map(Number) : [];
          } catch (_) {
            return [];
          }
        });
        const occupiedSeats = [
          ...existing.bookingSeats.map((seat) => seat.seatNumber),
          ...reservedSeats,
        ];
        const highestOccupiedSeat = Math.max(0, ...occupiedSeats);
        if (Number(incoming.totalSeats) < highestOccupiedSeat) {
          throw Object.assign(
            new Error(
              `Coach ${existing.name} cannot have fewer than ${highestOccupiedSeat} seats because that seat is occupied.`
            ),
            { statusCode: 409 }
          );
        }
      }

      // Free unique coach names before applying renames (also supports swapping S1/S2).
      for (const incoming of coaches.filter((coach) => coach.id)) {
        const existing = existingById.get(Number(incoming.id));
        if (existing.name !== normalizeCoachIdentifier(incoming.name)) {
          await tx.coach.update({
            where: { id: existing.id },
            data: { name: `__TEMP_${id}_${existing.id}` },
          });
        }
      }

      if (removedCoaches.length > 0) {
        await tx.coach.deleteMany({
          where: { id: { in: removedCoaches.map((coach) => coach.id) } },
        });
      }

      for (const coach of coaches.filter((item) => item.id)) {
        await tx.coach.update({
          where: { id: Number(coach.id) },
          data: {
            name: normalizeCoachIdentifier(coach.name),
            type: normalizeCoachType(coach.type),
            totalSeats: Number(coach.totalSeats),
            price: Number(coach.price) || 0,
          },
        });
      }

      const newCoaches = coaches.filter((coach) => !coach.id);
      if (newCoaches.length > 0)
        await tx.coach.createMany({
          data: newCoaches.map((coach) => ({
            trainId: id,
            name: normalizeCoachIdentifier(coach.name),
            type: normalizeCoachType(coach.type),
            totalSeats: Number(coach.totalSeats),
            price: Number(coach.price) || 0,
          })),
        });

      await tx.halt.deleteMany({ where: { trainId: id } });
      await tx.halt.createMany({
        data: halts.map((h, i) => haltData(h, i, id)),
      });

      await tx.train.update({
        where: { id },
        data: {
          name: name.trim(),
          number: number.trim(),
          runningDays: JSON.stringify(normalizedDays),
        },
      });
    });

    const updated = await prisma.train.findUnique({
      where:   { id },
      include: { halts: { orderBy: { order: "asc" } }, coaches: true },
    });
    res.json({ train: updated });
  } catch (err) {
    if (err.statusCode)
      return res.status(err.statusCode).json({ message: err.message });
    if (err.code === "P2002")
      return res.status(409).json({ message: "Train number and coach names must be unique." });
    if (err.code === "P2025")
      return res.status(404).json({ message: "Train not found." });
    console.error(err);
    res.status(500).json({ message: "Failed to update train." });
  }
});

// DELETE /api/admin/trains/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const train = await prisma.train.findUnique({
      where: { id },
      select: { _count: { select: { bookings: true } } },
    });
    if (!train)
      return res.status(404).json({ message: "Train not found." });
    if (train._count.bookings > 0)
      return res.status(409).json({
        message: "This train has booking history and cannot be deleted.",
      });
    await prisma.train.delete({ where: { id } });
    res.json({ message: "Train deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete train." });
  }
});

module.exports = router;
