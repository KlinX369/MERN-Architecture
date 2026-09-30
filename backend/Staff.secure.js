// models/Staff.js
const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
      maxlength: 254,
    },

    // Local-password accounts use this field. OAuth-only accounts may not have one.
    password: {
      type: String,
      default: null,
      select: false,
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    linkedinId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    githubId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    tiktokId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    authMethods: {
      type: [String],
      enum: ['password', 'google', 'github', 'linkedin', 'tiktok'],
      default: [],
    },

    name: {
      type: String,
      default: 'New User',
      trim: true,
      maxlength: 120,
    },

    avatar: {
      type: String,
      default: '',
      maxlength: 2048,
    },

    department: {
      type: String,
      default: 'Unassigned',
      trim: true,
      maxlength: 120,
    },

    role: {
      type: String,
      enum: ['admin', 'instructor', 'student'],
      default: 'student',
      index: true,
    },

    checkedIn: {
      type: Boolean,
      default: false,
    },

    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Authentication OTP. Only the hash is stored; never the raw OTP.
    otpHash: {
      type: String,
      default: null,
      select: false,
    },

    otpExpiry: {
      type: Date,
      default: null,
      select: false,
    },

    otpPurpose: {
      type: String,
      enum: ['authentication', 'password-reset', null],
      default: null,
      select: false,
    },

    otpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    otpLastSentAt: {
      type: Date,
      default: null,
      select: false,
    },

    resetPasswordToken: {
      type: String,
      default: null,
      select: false,
    },

    resetPasswordExpire: {
      type: Date,
      default: null,
      select: false,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
      select: false,
    },

    failedLoginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    lockUntil: {
      type: Date,
      default: null,
      select: false,
    },

    lastLoginAt: {
      type: Date,
      default: null,
      select: false,
    },

    lastPasswordResetAt: {
      type: Date,
      default: null,
      select: false,
    },

    // Incremented whenever all existing app sessions must be invalidated.
    sessionVersion: {
      type: Number,
      default: 0,
      select: false,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

staffSchema.pre('save', function (next) {
  if (this.email) this.email = this.email.toLowerCase().trim();
  next();
});

module.exports = mongoose.model('Staff', staffSchema);
