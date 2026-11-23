
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Provider = require("../models/Provider");
const Appointment = require("../models/Appointment");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

// Get all available doctors
router.get("/", async (req, res) => {
  try {
    const providers = await Provider.find().select("-password");

    return res.status(200).json({
      success: true,
      providers,
    });
  } catch (error) {
    console.error("Fetch providers error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch providers.",
    });
  }
});

// Doctor login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const providerDoc = await Provider.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!providerDoc) {
      return res.status(401).json({
        success: false,
        message: "Invalid provider credentials.",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      providerDoc.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid provider credentials.",
      });
    }

    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured.");
    }

    const token = jwt.sign(
      {
        id: providerDoc._id,
        email: providerDoc.email,
        role: "provider",
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const provider = providerDoc.toObject();
    delete provider.password;

    return res.status(200).json({
      success: true,
      token,
      provider,
    });
  } catch (error) {
    console.error("Provider login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to sign in. Please try again.",
    });
  }
});

// Get appointments assigned to the logged-in doctor
router.get("/appointments", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "provider") {
      return res.status(403).json({
        success: false,
        message: "Provider access required.",
      });
    }

    const appointments = await Appointment.find({
      provider: req.user.id,
    })
      .populate("patient", "name email phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      appointments,
    });
  } catch (error) {
    console.error("Provider appointments error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch appointments.",
    });
  }
});

module.exports = router;
