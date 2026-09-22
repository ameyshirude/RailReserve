const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../prismaClient");
const { validateRegistration, validateLogin } = require("../utils/validators");

const SALT_ROUNDS = 12;

function cookieOptions({ clear = false } = {}) {
  const sameSite = (process.env.COOKIE_SAME_SITE || "lax").toLowerCase();

  const secure =
    process.env.COOKIE_SECURE === undefined
      ? sameSite === "none" || process.env.NODE_ENV === "production"
      : process.env.COOKIE_SECURE === "true";

  const options = {
    httpOnly: true,
    secure,
    sameSite,
  };

  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }

  if (!clear) {
    options.maxAge = 24 * 60 * 60 * 1000; // 1 day
  }

  return options;
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

//router.post("/register", register);
async function register(req, res) {
  try {
    const { username, password, confirmPassword, email, phone } = req.body;

    const errors = validateRegistration({ username, password, confirmPassword, email, phone });
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email },
          { phone }
        ]
      }
    });

    if (existing) {
      if (existing.username === username) {
        return res.status(409).json({ message: "That username already exists. Try another!" });
      }
      if (existing.email === email) {
        return res.status(409).json({ message: "That email is already registered." });
      }
      if (existing.phone === phone) {
        return res.status(409).json({ message: "That phone number is already registered." });
      }
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await prisma.user.create({
      data: { username, passwordHash, email, phone, role: "USER" },
    });

    return res.status(201).json({ message: "Account created successfully. Please log in." });
  } catch (err) {
    console.error("register error:", err);
    return res.status(500).json({ message: "Something went wrong while creating your account. Try again." });
  }
}

//router.post("/login", login);
async function login(req, res) {
  try {
    const { username, password } = req.body;
    const errors = validateLogin({ username, password });
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.role !== "USER") {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const token = signToken(user);
    res.cookie("token", token, cookieOptions());

    return res.status(200).json({
      message: "Login successful.",
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ message: "Something went wrong while logging in." });
  }
}

//Login for admin
//router.post("/admin-login", adminLogin);
async function adminLogin(req, res) {
  try {
    const { username, password } = req.body;
    const errors = validateLogin({ username, password });
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const admin = await prisma.user.findUnique({ where: { username } });
    if (!admin || admin.role !== "ADMIN") {
      return res.status(401).json({ message: "Invalid admin username or password." });
    }

    const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid admin username or password." });
    }

    const token = signToken(admin);
    res.cookie("token", token, cookieOptions());

    return res.status(200).json({
      message: "Admin is successfully logged in.",
      user: { id: admin.id, username: admin.username, role: admin.role },
    });
  } catch (err) {
    console.error("adminLogin error:", err);
    return res.status(500).json({ message: "Something went wrong while logging in. Try again." });
  }
}

//router.get("/me", requireAuth, me);
async function me(req, res) {
  return res.status(200).json({ user: req.user });
}

//router.post("/logout", logout);
function logout(req, res) {
  res.clearCookie("token", cookieOptions({ clear: true }));
  return res.status(200).json({ message: "Logged out." });
}

module.exports = { register, login, adminLogin, me, logout };
