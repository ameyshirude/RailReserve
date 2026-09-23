const express = require("express");
const { register, login, adminLogin, me, logout } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/admin-login", authLimiter, adminLogin);
router.get("/me", requireAuth, me);
router.post("/logout", logout);

module.exports = router;
