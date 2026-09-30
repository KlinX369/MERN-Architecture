// models/Staff.js
const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    googleId: { type: String, unique: true, sparse: true },
    linkedinId: { type: String, unique: true, sparse: true },
    githubId: { type: String, unique: true, sparse: true },
    name: {
        type: String,
        default: 'New User',
        trim: true
    },
    department: {
        type: String,
        default: 'Unassigned'
    },
    role: {
        type: String,
        enum: {
            values: ['admin', 'instructor', 'student'],
            message: '{VALUE} is not a valid role'
        },
        default: 'student' 
    },
    checkedIn: { type: Boolean, default: false },
    otp: { type: String, default: null },
    otpExpiry: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
    
    // --- Security Additions for Password Resets ---
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpire: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Staff', staffSchema);