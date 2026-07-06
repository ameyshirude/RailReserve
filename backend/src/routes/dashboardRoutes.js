const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const prisma = require("../prismaClient");

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
    const bookings = await prisma.booking.findMany({
      orderBy: { bookedAt: "desc" },
      include: {
        user:       { select: { username: true, email: true, phone: true } },
        train:      { select: { name: true, number: true } },
        coach:      { select: { name: true } },
        passengers: true,
        payment:    true,
      },
    });
    res.json({ bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load bookings." });
  }
});

module.exports = router;