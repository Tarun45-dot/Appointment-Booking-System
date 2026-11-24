const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
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

const isStrongPassword = (password) => {
    return (
        typeof password === "string" &&
        password.length >= 8 &&
        Buffer.byteLength(password, "utf8") <= 72 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9\s]/.test(password)
    );
};

const formatUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    emailType: user.emailType,
    role: user.role
});

// ========================================
// USER REGISTRATION
// ========================================

router.post("/register", async (req, res) => {
    try {
        const { name, email, password, emailType } =
            req.body || {};

        // Validate required input types
        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            typeof emailType !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required and must be valid."
            });
        }

        const normalizedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();

        // Validate name
        if (
            normalizedName.length < 2 ||
            normalizedName.length > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Name must contain 2 to 100 characters."
            });
        }

        // Validate email
        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        // Validate email type
        if (!["personal", "office"].includes(emailType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email type."
            });
        }

        // Validate password strength
        if (!isStrongPassword(password)) {
            return res.status(400).json({
                success: false,
                message:
                    "Password must contain at least 8 characters, including uppercase, lowercase, number and special character, and must not exceed 72 bytes."
            });
        }

        // Check existing account
        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered."
            });
        }

        // Secure password hashing
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user with fixed role
        const user = await User.create({
            name: normalizedName,
            email: normalizedEmail,
            password: hashedPassword,
            emailType,
            role: "user"
        });

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: formatUser(user)
        });

    } catch (error) {

        // Handle concurrent duplicate registrations
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Email already registered."
            });
        }

        console.error("Registration error:", error.name);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
});

// ========================================
// USER LOGIN
// ========================================

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body || {};

        // Strict input validation
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

        const normalizedEmail = email.trim().toLowerCase();

        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        // Find account
        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user || user.role !== "user") {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Verify password
        const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Generate secure JWT
        const token = jwt.sign(
            {
                id: user._id.toString(),
                email: user.email,
                role: "user"
            },
            process.env.JWT_SECRET,
            {
                algorithm: "HS256",
                expiresIn: "1h"
            }
        );

        res.set("Cache-Control", "no-store");

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: formatUser(user)
        });

    } catch (error) {
        console.error("Login error:", error.name);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
});

// ========================================
// PROTECTED USER PROFILE
// ========================================

router.get(
    "/profile",
    authMiddleware,
    authorizeRole("user"),
    async (req, res) => {
        try {
            const user = await User.findOne({
                _id: req.user.id,
                role: "user"
            }).select("-password");

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            res.set("Cache-Control", "no-store");

            return res.status(200).json({
                success: true,
                message: "Profile retrieved successfully",
                user: formatUser(user)
            });

        } catch (error) {
            console.error("Profile error:", error.name);

            return res.status(500).json({
                success: false,
                message: "Internal server error."
            });
        }
    }
);

module.exports = router;
