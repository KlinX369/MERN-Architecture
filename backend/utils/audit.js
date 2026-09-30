// utils/audit.js
const AuditLog = require('../models/AuditLog');
const { hashForAudit } = require('./security');

async function audit(req, event, options = {}) {
  try {
    await AuditLog.create({
      event,
      user: options.userId || null,
      emailHash: options.email ? hashForAudit(options.email) : '',
      ipHash: hashForAudit(req.ip || ''),
      userAgent: String(req.get('user-agent') || '').slice(0, 1000),
      success: options.success !== false,
      metadata: options.metadata || {},
    });
  } catch (error) {
    // Security logging must never break authentication.
    console.error('[AUDIT_LOG_ERROR]', error.message);
  }
}

module.exports = { audit };
