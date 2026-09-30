// routes/authRoutes.js
const express = require('express');
const mongoose = require('mongoose');
const Staff = require('../models/Staff');
const {
  registerStaff,
  loginStaff,
  verifyOTP,
  resendOTP,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  changePassword,
  updateUserRole,
  updateUserStatus,
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { csrfProtection, csrfTokenEndpoint } = require('../middleware/csrf');
const {
  authLoginLimiter,
  registerLimiter,
  otpLimiter,
  passwordResetRequestLimiter,
  passwordResetLimiter,
  csrfLimiter,
  refreshLimiter,
} = require('../middleware/rateLimiters');
const {
  clearAuthCookies,
  clearCsrfCookie,
  clearResetCookie,
  revokeSessionById,
  revokeSessionByRefreshToken,
  revokeAllUserSessions,
  getCookieNames,
  verifyAccessToken,
} = require('../utils/authTokens');
const { audit } = require('../utils/audit');
const { normalizeEmail, isValidEmail } = require('../utils/security');

const router = express.Router();
const { accessCookieName } = getCookieNames();

function clientUser(user) {
  return {
    id: String(user._id),
    email: user.email || '',
    name: user.name || user.email?.split('@')[0] || 'User',
    role: user.role,
    isVerified: Boolean(user.isVerified),
    avatar: user.avatar || '',
    department: user.department || 'Unassigned',
  };
}

// CSRF bootstrap. Token is intentionally readable by frontend JS; it is not an authentication credential.
router.get('/csrf', csrfLimiter, csrfTokenEndpoint);

// Public authentication routes.
router.post('/register', registerLimiter, csrfProtection, registerStaff);
router.post('/login', authLoginLimiter, csrfProtection, loginStaff);
router.post('/verify-otp', otpLimiter, csrfProtection, verifyOTP);
router.post('/resend-otp', otpLimiter, csrfProtection, resendOTP);

// Password recovery routes.
router.post('/forgot-password', passwordResetRequestLimiter, csrfProtection, forgotPassword);
router.post('/verify-reset-otp', otpLimiter, csrfProtection, verifyResetOTP);
router.post('/reset-password', passwordResetLimiter, csrfProtection, resetPassword);

// Optional authenticated password change.
router.post('/change-password', protect, passwordResetLimiter, csrfProtection, changePassword);

// Explicit refresh endpoint. Most protected requests can also refresh transparently when the access token expires.
router.post('/refresh', refreshLimiter, csrfProtection, async (req, res) => {
  try {
    const refreshToken = req.cookies?.[getCookieNames().refreshCookieName];
    if (!refreshToken) return res.status(401).json({ message: 'Not authorized.' });

    const { rotateRefreshToken } = require('../utils/authTokens');
    const rotated = await rotateRefreshToken(refreshToken, req, res);
    if (!rotated) return res.status(401).json({ message: 'Not authorized.' });

    return res.status(200).json({ authenticated: true, user: clientUser(rotated.user) });
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized.' });
  }
});

// Current authenticated application user.
router.get('/me', protect, (req, res) => {
  return res.status(200).json({ authenticated: true, user: clientUser(req.user) });
});

// Logout is authenticated when possible and always clears local cookies.
router.post('/logout', csrfProtection, async (req, res) => {
  try {
    const accessToken = req.cookies?.[accessCookieName];
    const refreshToken = req.cookies?.[getCookieNames().refreshCookieName];

    if (accessToken) {
      try {
        const decoded = verifyAccessToken(accessToken);
        if (decoded?.sid) await revokeSessionById(decoded.sid);
      } catch (_) {
        // Invalid/expired access token is harmless; refresh-session revocation still runs below.
      }
    }

    if (refreshToken) {
      await revokeSessionByRefreshToken(refreshToken);
    }

    if (req.user?._id && req.authSession?._id) {
      await revokeSessionById(req.authSession._id);
    }

    clearAuthCookies(res);
    clearResetCookie(res);
    clearCsrfCookie(res);

    await audit(req, 'LOGOUT', { userId: req.user?._id, success: true });

    return res.status(200).json({ message: 'Successfully logged out.' });
  } catch (error) {
    clearAuthCookies(res);
    clearResetCookie(res);
    clearCsrfCookie(res);
    return res.status(200).json({ message: 'Logged out successfully.' });
  }
});

// Admin-only: list users without security secrets.
router.get('/admin/users', protect, authorize('admin'), async (req, res) => {
  try {
    const users = await Staff.find()
      .select('email name department role checkedIn isVerified isActive avatar authMethods createdAt updatedAt')
      .lean();

    await audit(req, 'ADMIN_USERS_VIEWED', { userId: req.user._id });
    return res.status(200).json(users);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

router.patch(
  '/admin/users/:id/role',
  protect,
  authorize('admin'),
  csrfProtection,
  async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user ID.' });
    return updateUserRole(req, res, next);
  }
);

router.patch(
  '/admin/users/:id/status',
  protect,
  authorize('admin'),
  csrfProtection,
  async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user ID.' });
    return updateUserStatus(req, res, next);
  }
);

// Instructor + admin.
router.get('/courses/manage', protect, authorize('instructor', 'admin'), (req, res) => {
  res.json({ message: 'Instructor course management dashboard content' });
});

// Student + instructor + admin.
router.get('/student/profile', protect, authorize('student', 'instructor', 'admin'), (req, res) => {
  res.json({
    message: `Access granted for ${req.user.role}`,
    user: clientUser(req.user),
  });
});

// Example self-only endpoint for future profile routes.
router.get('/users/:id', protect, (req, res) => {
  if (String(req.params.id) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden.' });
  }

  return Staff.findById(req.params.id)
    .select('email name department role checkedIn isVerified isActive avatar authMethods createdAt updatedAt')
    .lean()
    .then((user) => (user ? res.json(user) : res.status(404).json({ message: 'User not found.' })))
    .catch(() => res.status(500).json({ message: 'Failed to fetch user.' }));
});

module.exports = router;
