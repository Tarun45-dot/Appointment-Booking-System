require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Provider = require("./models/Provider");

async function resetPassword() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const newPassword = "Ravi@1234";
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const provider = await Provider.findOneAndUpdate(
            { email: "ravi.provider@example.com" },
            { password: hashedPassword },
            { new: true }
        );

        if (!provider) {
            console.log("Provider not found");
        } else {
            console.log("Provider password reset successfully");
            console.log("Email:", provider.email);
            console.log("Temporary password:", newPassword);
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error("Password reset error:", error.message);
    }
}

resetPassword();