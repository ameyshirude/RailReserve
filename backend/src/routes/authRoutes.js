const express = require("express");
const { register, login, adminLogin, me, logout } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/admin-login", adminLogin);
router.get("/me", requireAuth, me);
router.post("/logout", logout);

module.exports = router;
