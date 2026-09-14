const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    name: {
        type: String,
        default: 'New User'
    },
    department: {
        type: String,
        default: 'Unassigned'
    },
    role: {
        type: String,
        default: 'student'
    },
    checkedIn: {
        type: Boolean,
        default: false
    },
    otp: {
        type: String,
        default: null
    },
    otpExpiry: {
        type: Date,
        default: null
    },
    isVerified: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('Staff', staffSchema);