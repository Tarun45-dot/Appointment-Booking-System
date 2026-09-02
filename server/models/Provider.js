const mongoose = require("mongoose");

const providerSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true
        },

        providerType: {
            type: String,
            enum: ["doctor", "staff", "service-provider"],
            required: true
        },

        specialization: {
            type: String,
            default: ""
        },

        phone: {
            type: String,
            default: ""
        },

        organization: {
            type: String,
            default: ""
        },

        role: {
            type: String,
            default: "provider"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Provider", providerSchema);