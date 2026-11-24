const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const helmet = require("helmet");

require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const providerRoutes = require("./routes/providerRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const Appointment = require("./models/Appointment");

const {
  apiLimiter,
  loginLimiter,
  registerLimiter,
} = require("./middleware/rateLimitMiddleware");

const app = express();
const PORT = process.env.PORT || 5000;

// ========================================
// PROXY CONFIGURATION
// ========================================

if (process.env.RENDER === "true") {
  app.set("trust proxy", 1);
}

// ========================================
// ALLOWED FRONTEND ORIGINS
// ========================================

const allowedOrigins = [
  "https://appointment-booking-system-2uz6.onrender.com",
];

if (
  process.env.NODE_ENV !== "production" &&
  process.env.RENDER !== "true"
) {
  allowedOrigins.push(
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  );
}

// ========================================
// SECURITY MIDDLEWARE
// ========================================

app.use(helmet());

app.disable("x-powered-by");

// Secure CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow tools such as Postman and curl
      if (!origin) {
        return callback(null, true);
      }

      // Allow authorized frontend origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const error = new Error("Origin not allowed by CORS");
      error.code = "CORS_DENIED";

      return callback(error);
    },

    methods: [
      "GET",
      "POST",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],

    optionsSuccessStatus: 204,
    maxAge: 600,
  })
);

// General API rate limiting
app.use("/api", apiLimiter);

// Limit JSON request size
app.use(express.json({ limit: "100kb" }));

// ========================================
// AUTHENTICATION RATE LIMITING
// ========================================

app.post("/api/auth/login", loginLimiter);
app.post("/api/provider/login", loginLimiter);
app.post("/api/auth/register", registerLimiter);

// ========================================
// API ROUTES
// ========================================

app.use("/api/auth", authRoutes);
app.use("/api/provider", providerRoutes);
app.use("/api/appointments", appointmentRoutes);

// ========================================
// ROOT AND HEALTH CHECK
// ========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Appointment API is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Appointment API is running",
  });
});

// ========================================
// UNKNOWN ROUTES
// ========================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "API endpoint not found.",
  });
});

// ========================================
// GLOBAL ERROR HANDLER
// ========================================

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === "CORS_DENIED") {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed by CORS.",
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request payload is too large.",
    });
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request.",
    });
  }

  console.error("Server error:", error.message);

  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

// ========================================
// START SERVER
// ========================================

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not configured.");
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured.");
    }

    console.log("Starting MongoDB connection...");

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully");

    console.log("Initializing appointment database indexes...");

    await Appointment.createIndexes();

    console.log("Appointment database indexes ready");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log("Helmet security headers enabled");
      console.log("API rate limiting enabled");
      console.log("Login rate limiting enabled");
      console.log("Registration rate limiting enabled");
      console.log("CORS protection enabled");
      console.log("Global error handler enabled");
      console.log("Allowed origins:", allowedOrigins);
    });

  } catch (error) {
    console.error("Server startup failed:", error.message);

    await mongoose.disconnect().catch(() => {});

    process.exit(1);
  }
}

startServer();
