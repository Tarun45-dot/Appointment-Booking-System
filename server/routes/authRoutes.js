const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


// ===============================
// USER REGISTRATION
// ===============================

router.post("/register", async (req, res) => {
    try {
        const { name, email, password, emailType } = req.body;

        // Check required fields
        if (!name || !email || !password || !emailType) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            emailType,
            role: "user"
        });

        // Send response
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                emailType: user.emailType,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Registration error:", error.message);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


// ===============================
// USER LOGIN
// ===============================

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        // Find user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Compare password with stored bcrypt hash
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

        // Create JWT token
        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h"
            }
        );

        // Send successful login response
        res.status(200).json({
            success: true,
            message: "Login successful",
            token: token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                emailType: user.emailType,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login error:", error.message);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


// ===============================
// PROTECTED USER PROFILE
// ===============================

router.get("/profile", authMiddleware, async (req, res) => {
    try {
        // Find the logged-in user using ID from JWT
        const user = await User.findById(req.user.id).select("-password");

        // Check if user exists
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Send profile
        res.status(200).json({
            success: true,
            message: "Profile retrieved successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                emailType: user.emailType,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Profile error:", error.message);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


module.exports = router;