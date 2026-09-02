const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment");
const authenticateToken = require("../middleware/authMiddleware");

// 1. GET all appointments for logged-in patient
router.get("/", authenticateToken, async (req, res) => {
  try {
    const appointments = await Appointment.find({ patient: req.user.id })
      .populate("provider", "name specialization organization phone morningStart morningEnd eveningStart eveningEnd")
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

// 2. POST create a new appointment
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { provider, date, time, phone, place, reason } = req.body;

    if (!provider || !date || !time || !phone || !place) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields (doctor, date, time, phone, place).",
      });
    }

    const newAppointment = new Appointment({
      provider,
      patient: req.user.id,
      date,
      time,
      phone,
      place,
      reason: reason ? reason.trim() : "",
      status: "pending",
    });

    await newAppointment.save();

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully!",
      appointment: newAppointment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 3. DELETE cancel an appointment (Patient)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const appointment = await Appointment.findOneAndDelete({
      _id: req.params.id,
      patient: req.user.id,
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 4. PATCH update appointment status (Doctor: accept, reject, complete)
router.patch("/:id/status", authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;

    const updated = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status },
      { returnDocument: "after" }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found.",
      });
    }

    res.status(200).json({
      success: true,
      appointment: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 5. PATCH submit 5-star rating & review (Patient)
router.patch("/:id/review", authenticateToken, async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    const numRating = Number(rating);

    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5 stars.",
      });
    }

    const updated = await Appointment.findOneAndUpdate(
      { _id: req.params.id, patient: req.user.id },
      {
        rating: numRating,
        feedback: feedback ? feedback.trim() : "",
      },
      { returnDocument: "after" }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Thank you, visit again! Your rating and feedback have been submitted.",
      appointment: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to submit review.",
    });
  }
});

module.exports = router;