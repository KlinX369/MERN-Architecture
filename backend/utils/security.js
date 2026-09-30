// utils/security.js
const crypto = require('crypto');

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(email) {
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password) {
  if (typeof password !== 'string') return false;
  if (password.length < 8 || password.length > 128) return false;

  let score = 0;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  return score >= 3;
}

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashSecret(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function safeEqualString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function generateOpaqueToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function hashForAudit(value) {
  if (!value) return '';
  const salt = process.env.AUDIT_HASH_SALT || 'change-this-audit-salt';
  return crypto.createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

module.exports = {
  normalizeEmail,
  isValidEmail,
  isStrongPassword,
  generateOtp,
  hashSecret,
  safeEqualString,
  generateOpaqueToken,
  hashForAudit,
};
