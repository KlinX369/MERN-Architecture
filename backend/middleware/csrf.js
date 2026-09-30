// middleware/csrf.js
const crypto = require('crypto');
const { setCsrfCookie, getCookieNames } = require('../utils/authTokens');

const { csrfCookieName } = getCookieNames();

function allowedOrigins() {
  return String(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function assertRequestOrigin(req) {
  const origin = req.get('origin');
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, '');
  return allowedOrigins().includes(normalized);
}

function csrfTokenEndpoint(req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  setCsrfCookie(res, token);
  res.status(200).json({ csrfToken: token });
}

function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  if (!assertRequestOrigin(req)) {
    return res.status(403).json({ message: 'Invalid request origin.' });
  }

  const cookieToken = req.cookies?.[csrfCookieName];
  const headerToken = req.get('x-csrf-token');

  if (!cookieToken || !headerToken) {
    return res.status(403).json({ message: 'CSRF validation failed.' });
  }

  const cookieBuffer = Buffer.from(cookieToken, 'utf8');
  const headerBuffer = Buffer.from(headerToken, 'utf8');

  if (
    cookieBuffer.length !== headerBuffer.length ||
    !crypto.timingSafeEqual(cookieBuffer, headerBuffer)
  ) {
    return res.status(403).json({ message: 'CSRF validation failed.' });
  }

  next();
}

module.exports = { csrfTokenEndpoint, csrfProtection };
