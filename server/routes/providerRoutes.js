const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Provider = require("../models/Provider");
const Appointment = require("../models/Appointment");

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");

const router = express.Router();

// ========================================
// VALIDATION HELPERS
// ========================================

const isValidEmail = (email) => {
    return (
        typeof email === "string" &&
        email.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    );
};

// Public provider fields
const publicProviderFields =
    "_id name providerType specialization phone organization " +
    "morningStart morningEnd eveningStart eveningEnd";

// Secure provider response
const formatProvider = (provider) => ({
    _id: provider._id,
    id: provider._id,
    name: provider.name,
    email: provider.email,
    providerType: provider.providerType,
    specialization: provider.specialization,
    phone: provider.phone,
    organization: provider.organization,
    morningStart: provider.morningStart,
    morningEnd: provider.morningEnd,
    eveningStart: provider.eveningStart,
    eveningEnd: provider.eveningEnd,
    role: "provider",
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt
});

// ========================================
// GET ALL AVAILABLE PROVIDERS
// ========================================

router.get("/", async (req, res) => {
    try {
        const providers = await Provider.find()
            .select(publicProviderFields);

        return res.status(200).json({
            success: true,
            providers
        });

    } catch (error) {
        console.error(
            "Fetch providers error:",
            error.name
        );

        return res.status(500).json({
            success: false,
            message: "Unable to fetch providers."
        });
    }
});

// ========================================
// DOCTOR / PROVIDER LOGIN
// ========================================

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body || {};

        // Validate input types and password length
        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !password ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid email and password are required."
            });
        }

        const normalizedEmail =
            email.trim().toLowerCase();

        // Validate email format
        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        // Find provider account
        const providerDoc = await Provider.findOne({
            email: normalizedEmail
        });

        if (
            !providerDoc ||
            providerDoc.role !== "provider"
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid provider credentials."
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(
            password,
            providerDoc.password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid provider credentials."
            });
        }

        // Validate JWT configuration
        if (!process.env.JWT_SECRET) {
            throw new Error(
                "JWT_SECRET is not configured."
            );
        }

        // Generate secure JWT
        const token = jwt.sign(
            {
                id: providerDoc._id.toString(),
                email: providerDoc.email,
                role: "provider"
            },
            process.env.JWT_SECRET,
            {
                algorithm: "HS256",
                expiresIn: "1h"
            }
        );

        // Prevent sensitive response caching
        res.set("Cache-Control", "no-store");

        return res.status(200).json({
            success: true,
            message: "Provider login successful.",
            token,
            provider: formatProvider(providerDoc)
        });

    } catch (error) {
        console.error(
            "Provider login error:",
            error.name
        );

        return res.status(500).json({
            success: false,
            message: "Unable to sign in. Please try again."
        });
    }
});

// ========================================
// GET LOGGED-IN PROVIDER APPOINTMENTS
// ========================================

router.get(
    "/appointments",
    authenticateToken,
    authorizeRole("provider"),
    async (req, res) => {
        try {
            // Verify provider account still exists
            const providerExists = await Provider.exists({
                _id: req.user.id,
                role: "provider"
            });

            if (!providerExists) {
                return res.status(404).json({
                    success: false,
                    message: "Provider account not found."
                });
            }

            // Fetch only assigned appointments
            const appointments = await Appointment.find({
                provider: req.user.id
            })
                .populate("patient", "name email phone")
                .sort({ createdAt: -1 });

            res.set("Cache-Control", "no-store");

            return res.status(200).json({
                success: true,
                appointments
            });

        } catch (error) {
            console.error(
                "Provider appointments error:",
                error.name
            );

            return res.status(500).json({
                success: false,
                message: "Unable to fetch appointments."
            });
        }
    }
);

module.exports = router;
