// models/Staff.js

const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema(
    {
        // =========================================================
        // BASIC USER INFORMATION
        // =========================================================

        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true
        },

        /*
         * Password is optional because OAuth accounts may not have
         * a local password when they are first created.
         *
         * select: false means the password is never returned by
         * normal queries. Login explicitly selects it.
         */
        password: {
            type: String,
            default: null,
            select: false
        },

        name: {
            type: String,
            default: 'New User',
            trim: true
        },

        department: {
            type: String,
            default: 'Unassigned',
            trim: true
        },

        role: {
            type: String,
            enum: {
                values: [
                    'admin',
                    'instructor',
                    'tutor',
                    'student'
                ],
                message: '{VALUE} is not a valid role'
            },
            default: 'student'
        },

        checkedIn: {
            type: Boolean,
            default: false
        },

        isVerified: {
            type: Boolean,
            default: false
        },

        isActive: {
            type: Boolean,
            default: true
        },

        avatar: {
            type: String,
            default: null
        },

        // =========================================================
        // OAUTH PROVIDER IDS
        // =========================================================

        googleId: {
            type: String,
            unique: true,
            sparse: true
        },

        linkedinId: {
            type: String,
            unique: true,
            sparse: true
        },

        githubId: {
            type: String,
            unique: true,
            sparse: true
        },

        tiktokId: {
            type: String,
            unique: true,
            sparse: true
        },

        // =========================================================
        // OTP SECURITY
        // =========================================================

        /*
         * We store a SHA-256 hash of the OTP rather than the
         * plaintext OTP.
         */
        otpHash: {
            type: String,
            default: null,
            select: false
        },

        otpExpiry: {
            type: Date,
            default: null
        },

        /*
         * authentication
         * password-reset
         */
        otpPurpose: {
            type: String,
            enum: [
                'authentication',
                'password-reset',
                null
            ],
            default: null
        },

        otpAttempts: {
            type: Number,
            default: 0
        },

        otpLastSentAt: {
            type: Date,
            default: null
        },

        // =========================================================
        // PASSWORD RESET TOKEN
        // =========================================================

        /*
         * Only the SHA-256 hash is stored in MongoDB.
         */
        resetPasswordToken: {
            type: String,
            default: null,
            select: false
        },

        resetPasswordExpire: {
            type: Date,
            default: null
        },

        passwordChangedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);


// IMPORTANT:
// There is intentionally NO pre('save', function(next) {...})
// middleware here.
//
// Mongoose 9 no longer supports the old next() pattern for
// pre middleware, and email already has lowercase:true and trim:true.

module.exports = mongoose.model('Staff', staffSchema);