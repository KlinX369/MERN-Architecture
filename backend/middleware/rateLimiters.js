// middleware/rateLimiters.js
const { rateLimit } = require('express-rate-limit');

const jsonLimiter = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message },
  });

const authLoginLimiter = jsonLimiter(
  15 * 60 * 1000,
  20,
  'Too many login attempts. Please try again later.'
);

const registerLimiter = jsonLimiter(
  60 * 60 * 1000,
  10,
  'Too many registration attempts. Please try again later.'
);

const otpLimiter = jsonLimiter(
  10 * 60 * 1000,
  10,
  'Too many OTP attempts. Please request a new code later.'
);

const passwordResetRequestLimiter = jsonLimiter(
  15 * 60 * 1000,
  5,
  'Too many password reset requests. Please try again later.'
);

const passwordResetLimiter = jsonLimiter(
  15 * 60 * 1000,
  8,
  'Too many password reset attempts. Please try again later.'
);

const oauthLimiter = jsonLimiter(
  10 * 60 * 1000,
  20,
  'Too many authentication requests. Please try again later.'
);

const csrfLimiter = jsonLimiter(
  15 * 60 * 1000,
  60,
  'Too many security-token requests. Please try again later.'
);

const refreshLimiter = jsonLimiter(
  15 * 60 * 1000,
  30,
  'Too many session refresh requests. Please try again later.'
);

module.exports = {
  authLoginLimiter,
  registerLimiter,
  otpLimiter,
  passwordResetRequestLimiter,
  passwordResetLimiter,
  oauthLimiter,
  csrfLimiter,
  refreshLimiter,
};
