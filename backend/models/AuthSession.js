// models/AuthSession.js
const mongoose = require('mongoose');

const authSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
      index: true,
    },

    // SHA-256 hash of the refresh token. Raw refresh tokens are never stored.
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AuthSession',
      default: null,
    },

    ipHash: {
      type: String,
      default: '',
      maxlength: 128,
    },

    userAgent: {
      type: String,
      default: '',
      maxlength: 1000,
    },

    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Automatically removes expired sessions from MongoDB.
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

authSessionSchema.index({ user: 1, revokedAt: 1, expiresAt: 1 });

module.exports = mongoose.model('AuthSession', authSessionSchema);
