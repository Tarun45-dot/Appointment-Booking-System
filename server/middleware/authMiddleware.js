const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Validate authorization header
    if (typeof authHeader !== "string") {
      return res.status(401).json({
        success: false,
        message: "Authentication token required.",
      });
    }

    // Validate Bearer token format
    const match = authHeader.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format.",
      });
    }

    const token = match[1];

    // Verify JWT signature and expiration
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        algorithms: ["HS256"],
      }
    );

    // Validate token payload
    if (
      !decoded ||
      typeof decoded !== "object" ||
      typeof decoded.id !== "string" ||
      !/^[a-fA-F0-9]{24}$/.test(decoded.id) ||
      typeof decoded.email !== "string" ||
      !["user", "provider"].includes(decoded.role) ||
      !Number.isFinite(decoded.exp)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    // Attach verified user information
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();

  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  }
};

module.exports = authenticateToken;
