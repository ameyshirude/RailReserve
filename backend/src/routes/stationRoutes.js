const express = require("express");
const prisma = require("../prismaClient");

const router = express.Router();

// GET /api/stations — return all unique station names (sorted)
router.get("/", async (_req, res) => {
  try {
    const halts = await prisma.halt.findMany({
      select: { stationName: true },
      distinct: ["stationName"],
      orderBy: { stationName: "asc" },
    });

    const stations = halts.map((h) => h.stationName);
    res.json({ stations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load stations." });
  }
});

module.exports = router;
