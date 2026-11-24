const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: String,
      required: true,
      trim: true,
    },
    time: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    place: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate active appointment bookings
appointmentSchema.index(
  {
    provider: 1,
    date: 1,
    time: 1,
  },
  {
    unique: true,
    name: "unique_active_appointment_slot",
    partialFilterExpression: {
      status: {
        $in: ["pending", "confirmed"],
      },
    },
  }
);

module.exports = mongoose.model(
  "Appointment",
  appointmentSchema
);
