const express = require("express");
const router = express.Router();
const Provider = require("../models/Provider");
const Appointment = require("../models/Appointment");
const authenticateToken = require("../middleware/authMiddleware");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "appointment_jwt_secret_key_12345";

// 1. GET all available doctors
router.get("/", async (req, res) => {
  try {
    const providers = await Provider.find().select("-password");
    res.status(200).json({
      success: true,
      providers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 2. POST Doctor / Provider Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const providerDoc = await Provider.findOne({ email });
    if (!providerDoc || providerDoc.password !== password) {
      return res.status(400).json({
        success: false,
        message: "Invalid provider credentials.",
      });
    }

    const token = jwt.sign(
      { id: providerDoc._id, email: providerDoc.email, role: "provider" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      token,
      provider: providerDoc,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 3. GET all patient appointments assigned to this Doctor
router.get("/appointments", authenticateToken, async (req, res) => {
  try {
    const appointments = await Appointment.find({ provider: req.user.id })
      .populate("patient", "name email phone")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      appointments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;