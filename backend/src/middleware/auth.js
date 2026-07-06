const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "Not authenticated. Please log in." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Session expired or invalid. Please log in again." });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have access to this resource." });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
