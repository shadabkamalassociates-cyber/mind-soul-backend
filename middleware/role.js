const jwt = require("jsonwebtoken");

const userRole = (req, res, next) => {
  req.role = "USER";
  next();
};

const expertRole = (req, res, next) => {
  req.role = "EXPERT";
  next();
};

const adminRole = (req, res, next) => {
  req.role = "ADMIN";
  next();
};

const auth = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const bearerToken =
      header && header.startsWith("Bearer ") ? header.split(" ")[1] : null;
    const cookieToken = req.cookies?.token;
    const token = bearerToken || cookieToken;
    console.log(token);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Token required.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded?.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Invalid token.",
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized. Invalid or expired token.",
    });
  }
};

// Keep old name for existing imports
const protect = auth;

module.exports = {
  userRole,
  expertRole,
  adminRole,
  auth,
  protect,
};
