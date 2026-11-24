const express = require("express");
const router = express.Router();

const Appointment = require("../models/Appointment");
const Provider = require("../models/Provider");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");

// ========================================
// VALIDATION HELPERS
// ========================================

const isValidId = (id) =>
  typeof id === "string" &&
  /^[a-fA-F0-9]{24}$/.test(id);

const isValidDate = (date) => {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
};

const isValidTime = (time) =>
  typeof time === "string" &&
  /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

// ========================================
// 1. GET APPOINTMENTS - PATIENT ONLY
// ========================================

router.get(
  "/",
  authenticateToken,
  authorizeRole("user"),
  async (req, res) => {
    try {
      const appointments = await Appointment.find({
        patient: req.user.id,
      })
        .populate(
          "provider",
          "name specialization organization phone morningStart morningEnd eveningStart eveningEnd"
        )
        .sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        appointments,
      });

    } catch (error) {
      console.error("Fetch appointments error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to fetch appointments.",
      });
    }
  }
);

// ========================================
// 2. BOOK APPOINTMENT - PATIENT ONLY
// ========================================

router.post(
  "/",
  authenticateToken,
  authorizeRole("user"),
  async (req, res) => {
    try {
      const {
        provider,
        date,
        time,
        phone,
        place,
        reason,
      } = req.body || {};

      // Validate required fields
      const requiredFields = [
        provider,
        date,
        time,
        phone,
        place,
      ];

      if (
        requiredFields.some(
          (value) =>
            typeof value !== "string" || !value.trim()
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Please fill all required fields.",
        });
      }

      // Validate provider ID
      if (!isValidId(provider)) {
        return res.status(400).json({
          success: false,
          message: "Invalid provider ID.",
        });
      }

      // Validate appointment date
      if (!isValidDate(date)) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment date.",
        });
      }

      // Validate appointment time
      if (!isValidTime(time)) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment time.",
        });
      }

      // Validate appointment date and time in IST
      const appointmentDateTime = new Date(
        `${date}T${time}:00+05:30`
      );

      if (appointmentDateTime.getTime() <= Date.now()) {
        return res.status(400).json({
          success: false,
          message: "Past dates and time slots cannot be booked.",
        });
      }

      // Validate phone number
      if (!/^\+?[0-9]{10,15}$/.test(phone.trim())) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid phone number.",
        });
      }

      // Validate place
      if (place.trim().length > 200) {
        return res.status(400).json({
          success: false,
          message: "Place must not exceed 200 characters.",
        });
      }

      // Validate reason
      if (
        reason != null &&
        (
          typeof reason !== "string" ||
          reason.trim().length > 1000
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment reason.",
        });
      }

      // Verify provider exists
      const existingProvider = await Provider.exists({
        _id: provider,
      });

      if (!existingProvider) {
        return res.status(404).json({
          success: false,
          message: "Selected provider not found.",
        });
      }

      // Check whether the selected slot is already booked
      const existingAppointment = await Appointment.exists({
        provider,
        date,
        time,
        status: {
          $in: ["pending", "confirmed"],
        },
      });

      if (existingAppointment) {
        return res.status(409).json({
          success: false,
          message:
            "This time slot is already booked. Please select another time.",
        });
      }

      // Create appointment
      const newAppointment = await Appointment.create({
        provider,
        patient: req.user.id,
        date,
        time,
        phone: phone.trim(),
        place: place.trim(),
        reason: reason ? reason.trim() : "",
        status: "pending",
      });

      return res.status(201).json({
        success: true,
        message: "Appointment booked successfully!",
        appointment: newAppointment,
      });

    } catch (error) {
      // Handle simultaneous duplicate booking requests
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message:
            "This time slot is already booked. Please select another time.",
        });
      }

      console.error("Booking error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to book appointment.",
      });
    }
  }
);

// ========================================
// 3. CANCEL APPOINTMENT - PATIENT ONLY
// ========================================

router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("user"),
  async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment ID.",
        });
      }

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

      return res.status(200).json({
        success: true,
        message: "Appointment cancelled successfully.",
      });

    } catch (error) {
      console.error("Cancellation error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to cancel appointment.",
      });
    }
  }
);

// ========================================
// 4. UPDATE STATUS - PROVIDER ONLY
// ========================================

router.patch(
  "/:id/status",
  authenticateToken,
  authorizeRole("provider"),
  async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment ID.",
        });
      }

      const { status } = req.body || {};

      const allowedStatuses = [
        "confirmed",
        "completed",
        "cancelled",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment status.",
        });
      }

      const updated = await Appointment.findOneAndUpdate(
        {
          _id: req.params.id,
          provider: req.user.id,
        },
        {
          $set: { status },
        },
        {
          returnDocument: "after",
          runValidators: true,
        }
      );

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found.",
        });
      }

      return res.status(200).json({
        success: true,
        appointment: updated,
      });

    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "This appointment slot is already occupied.",
        });
      }

      console.error("Status update error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to update appointment status.",
      });
    }
  }
);

// ========================================
// 5. SUBMIT REVIEW - PATIENT ONLY
// ========================================

router.patch(
  "/:id/review",
  authenticateToken,
  authorizeRole("user"),
  async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment ID.",
        });
      }

      const { rating, feedback } = req.body || {};

      if (
        typeof rating !== "number" &&
        typeof rating !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid rating.",
        });
      }

      const numRating = Number(rating);

      if (
        !Number.isInteger(numRating) ||
        numRating < 1 ||
        numRating > 5
      ) {
        return res.status(400).json({
          success: false,
          message: "Rating must be between 1 and 5 stars.",
        });
      }

      if (
        feedback != null &&
        (
          typeof feedback !== "string" ||
          feedback.trim().length > 1000
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid feedback.",
        });
      }

      const updated = await Appointment.findOneAndUpdate(
        {
          _id: req.params.id,
          patient: req.user.id,
        },
        {
          $set: {
            rating: numRating,
            feedback: feedback ? feedback.trim() : "",
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
        }
      );

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Thank you, visit again! Your rating and feedback have been submitted.",
        appointment: updated,
      });

    } catch (error) {
      console.error("Review error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Failed to submit review.",
      });
    }
  }
);

module.exports = router;
