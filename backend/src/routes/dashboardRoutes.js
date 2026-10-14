const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const prisma = require("../prismaClient");
const { presentBooking } = require("../utils/bookingPresenter");

const router = express.Router();

router.get("/dashboard", requireAuth, requireRole("USER"), (req, res) => {
  res.json({ message: `Welcome, ${req.user.username}.`, trains: [] });
});

router.get("/admin/dashboard", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const [totalUsers, totalTrains, totalBookings] = await Promise.all([
      prisma.user.count({ where: { role: "USER" } }),
      prisma.train.count(),
      prisma.booking.count(),
    ]);
    res.json({
      message: `Welcome, ${req.user.username}.`,
      stats: { totalUsers, totalTrains, totalBookings },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load dashboard stats." });
  }
});

router.get("/admin/bookings", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        orderBy: { bookedAt: "desc" },
        skip,
        take: limit,
        include: {
          user:       { select: { username: true, email: true, phone: true } },
          train:      { select: { name: true, number: true, halts: { orderBy: { order: "asc" } } } },
          coach:      { select: { name: true, type: true } },
          passengers: true,
          payment:    true,
        },
      }),
      prisma.booking.count(),
    ]);

    res.json({
      bookings: bookings.map(presentBooking),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load bookings." });
  }
});

module.exports = router;
