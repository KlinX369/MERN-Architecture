// models/AuditLog.js
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      required: true,
      index: true,
      maxlength: 120,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
      index: true,
    },

    emailHash: {
      type: String,
      default: '',
      maxlength: 128,
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

    success: {
      type: Boolean,
      default: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
