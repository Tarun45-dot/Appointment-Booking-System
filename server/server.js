const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const providerRoutes = require("./routes/providerRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/provider", providerRoutes);
app.use("/api/appointments", appointmentRoutes);

// Root & Health check routes
app.get("/", (req, res) => {
  res.json({ success: true, message: "Appointment API is running" });
});

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Appointment API is running" });
});

// Start Server
async function startServer() {
  try {
    console.log("Starting MongoDB connection...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:");
    console.error(error.message);
  }
}

startServer();