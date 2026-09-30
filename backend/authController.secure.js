// controllers/authController.js
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Staff = require('../models/Staff');
const sendOTPEmail = require('../utils/sendEmail');
const { sendSecurityEmail } = require('../utils/sendEmail');
const {
  normalizeEmail,
  isValidEmail,
  isStrongPassword,
  generateOtp,
  hashSecret,
  safeEqualString,
  generateOpaqueToken,
} = require('../utils/security');
const {
  issueAuthentication,
  revokeAllUserSessions,
  clearAuthCookies,
  setResetCookie,
  clearResetCookie,
  getCookieNames,
} = require('../utils/authTokens');
const { audit } = require('../utils/audit');

const { resetCookieName } = getCookieNames();

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const BCRYPT_ROUNDS = 12;

function publicUser(user) {
  return {
    id: String(user._id),
    email: user.email || '',
    name: user.name || user.username || user.email?.split('@')[0] || 'User',
    role: user.role,
    isVerified: Boolean(user.isVerified),
    avatar: user.avatar || '',
    department: user.department || 'Unassigned',
  };
}

function assignDefaultAuthMethod(user, method) {
  const methods = Array.isArray(user.authMethods) ? user.authMethods : [];
  if (!methods.includes(method)) methods.push(method);
  user.authMethods = methods;
}

function roleFromRegistrationRequest(role) {
  const requested = ['admin', 'instructor', 'student'].includes(role) ? role : 'student';
  const explicitlyEnabled = String(process.env.ALLOW_PUBLIC_ROLE_ASSIGNMENT || '').toLowerCase() === 'true';
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // Production public registration cannot self-promote to an elevated role.
  if (!explicitlyEnabled || !isDevelopment) return 'student';
  return requested;
}

async function createAndSendOtp(staff, purpose, res) {
  const otp = generateOtp();
  staff.otpHash = hashSecret(otp);
  staff.otpExpiry = new Date(Date.now() + OTP_TTL_MS);
  staff.otpPurpose = purpose;
  staff.otpAttempts = 0;
  staff.otpLastSentAt = new Date();
  await staff.save();

  try {
    if (process.env.NODE_ENV !== 'test') {
      await sendOTPEmail(staff.email, otp, purpose);
    }
  } catch (error) {
    // Do not leave an immediately usable OTP after email delivery fails.
    staff.otpHash = null;
    staff.otpExpiry = null;
    staff.otpPurpose = null;
    staff.otpAttempts = 0;
    staff.otpLastSentAt = null;
    await staff.save().catch(() => {});
    console.error('[EMAIL] OTP delivery failed:', error.message);
    return res.status(503).json({ message: 'Unable to deliver the verification code. Please try again later.' });
  }

  return null;
}

// POST /api/auth/register
exports.registerStaff = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    const name = typeof req.body.name === 'string' ? req.body.name.trim().slice(0, 120) : 'New User';
    const role = roleFromRegistrationRequest(req.body.role);

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ message: 'A valid email and password are required.' });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: 'Password must be 8-128 characters and include at least three of uppercase letters, lowercase letters, numbers, and special characters.',
      });
    }

    const existing = await Staff.findOne({ email }).select('_id');
    if (existing) {
      // Keep the existing public behavior without exposing account details.
      return res.status(400).json({ message: 'User already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const otp = generateOtp();

    const newStaff = new Staff({
      email,
      password: hashedPassword,
      name: name || 'New User',
      department: 'Data Annotation',
      role,
      isVerified: false,
      isActive: true,
      authMethods: ['password'],
      otpHash: hashSecret(otp),
      otpExpiry: new Date(Date.now() + OTP_TTL_MS),
      otpPurpose: 'authentication',
      otpAttempts: 0,
      otpLastSentAt: new Date(),
    });

    await newStaff.save();

    try {
      if (process.env.NODE_ENV !== 'test') {
        await sendOTPEmail(email, otp, 'authentication');
      }
    } catch (error) {
      await Staff.deleteOne({ _id: newStaff._id }).catch(() => {});
      console.error('[EMAIL] Registration OTP delivery failed:', error.message);
      return res.status(503).json({ message: 'Unable to deliver the verification code. Please try again later.' });
    }

    await audit(req, 'REGISTER_SUCCESS', {
      userId: newStaff._id,
      email,
      metadata: { role: newStaff.role },
    });

    return res.status(201).json({
      message: 'Registration successful. Please verify your OTP.',
      requiresOTP: true,
      email: newStaff.email,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'User already exists.' });
    }

    console.error('Error in register route:', error);
    return res.status(500).json({ message: 'Server error during registration.' });
  }
};

// POST /api/auth/login
exports.loginStaff = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    if (!isValidEmail(email) || typeof password !== 'string' || password.length > 128) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const staff = await Staff.findOne({ email }).select(
      '+password +failedLoginAttempts +lockUntil +isActive +isVerified +sessionVersion +otpHash +otpExpiry +otpPurpose +otpAttempts +otpLastSentAt'
    );

    if (!staff || !staff.isActive) {
      await audit(req, 'LOGIN_FAILURE', {
        email,
        success: false,
        metadata: { reason: 'invalid_credentials' },
      });
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (staff.lockUntil && staff.lockUntil > new Date()) {
      await audit(req, 'LOGIN_FAILURE', {
        userId: staff._id,
        email,
        success: false,
        metadata: { reason: 'account_locked' },
      });
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (!staff.password) {
      await audit(req, 'LOGIN_FAILURE', {
        userId: staff._id,
        email,
        success: false,
        metadata: { reason: 'oauth_only_account' },
      });
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, staff.password);

    if (!isMatch) {
      const failures = Number(staff.failedLoginAttempts || 0) + 1;
      staff.failedLoginAttempts = failures;

      if (failures >= LOGIN_MAX_FAILURES) {
        staff.lockUntil = new Date(Date.now() + LOGIN_LOCK_MS);
        staff.failedLoginAttempts = 0;
      }

      await staff.save();

      await audit(req, 'LOGIN_FAILURE', {
        userId: staff._id,
        email,
        success: false,
        metadata: {
          reason: 'invalid_password',
          locked: failures >= LOGIN_MAX_FAILURES,
        },
      });

      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    staff.failedLoginAttempts = 0;
    staff.lockUntil = null;

    if (staff.otpLastSentAt && Date.now() - new Date(staff.otpLastSentAt).getTime() < 60 * 1000) {
      return res.status(429).json({ message: 'Please wait before requesting another verification code.' });
    }

    const sendError = await createAndSendOtp(staff, 'authentication', res);
    if (sendError) return sendError;

    await audit(req, 'OTP_SENT', {
      userId: staff._id,
      email,
      metadata: { purpose: 'authentication' },
    });

    return res.status(200).json({
      message: 'Credentials valid. OTP sent to email.',
      requiresOTP: true,
      email: staff.email,
    });
  } catch (error) {
    console.error('Error in login route:', error);
    return res.status(500).json({ message: 'Server error during login.' });
  }
};

// POST /api/auth/verify-otp
exports.verifyOTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = typeof req.body.otp === 'string' ? req.body.otp.trim() : '';

    if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    const staff = await Staff.findOne({ email }).select(
      '+otpHash +otpExpiry +otpPurpose +otpAttempts +sessionVersion +isActive +isVerified'
    );

    if (!staff || !staff.isActive || staff.otpPurpose !== 'authentication' || !staff.otpHash) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    if (!staff.otpExpiry || staff.otpExpiry <= new Date()) {
      staff.otpHash = null;
      staff.otpExpiry = null;
      staff.otpPurpose = null;
      staff.otpAttempts = 0;
      staff.otpLastSentAt = null;
      await staff.save();
      await audit(req, 'OTP_EXPIRED', { userId: staff._id, email, success: false });
      return res.status(400).json({ error: 'OTP has expired.' });
    }

    if (Number(staff.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
      staff.otpHash = null;
      staff.otpExpiry = null;
      staff.otpPurpose = null;
      staff.otpAttempts = 0;
      staff.otpLastSentAt = null;
      await staff.save();
      await audit(req, 'OTP_LOCKED', { userId: staff._id, email, success: false });
      return res.status(400).json({ error: 'Too many invalid attempts. Please request a new code.' });
    }

    const suppliedHash = hashSecret(otp);
    const valid = safeEqualString(suppliedHash, staff.otpHash);

    if (!valid) {
      staff.otpAttempts = Number(staff.otpAttempts || 0) + 1;
      if (staff.otpAttempts >= OTP_MAX_ATTEMPTS) {
        staff.otpHash = null;
        staff.otpExpiry = null;
        staff.otpPurpose = null;
        staff.otpAttempts = 0;
        staff.otpLastSentAt = null;
      }
      await staff.save();
      await audit(req, 'OTP_FAILURE', {
        userId: staff._id,
        email,
        success: false,
        metadata: { attemptsRemaining: Math.max(0, OTP_MAX_ATTEMPTS - Number(staff.otpAttempts || 0)) },
      });
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    staff.otpHash = null;
    staff.otpExpiry = null;
    staff.otpPurpose = null;
    staff.otpAttempts = 0;
    staff.otpLastSentAt = null;
    staff.isVerified = true;
    staff.failedLoginAttempts = 0;
    staff.lockUntil = null;
    staff.lastLoginAt = new Date();
    await staff.save();

    const { authSession } = await issueAuthentication(res, staff, req);

    await audit(req, 'LOGIN_SUCCESS', {
      userId: staff._id,
      email: staff.email,
      metadata: { sessionId: String(authSession._id) },
    });

    return res.status(200).json({
      message: 'Authentication successful.',
      authenticated: true,
      user: publicUser(staff),
    });
  } catch (error) {
    console.error('Error in verify route:', error);
    return res.status(500).json({ error: 'Server error during verification.' });
  }
};

// Optional recovery helper. Existing UI does not have to change to use it.
exports.resendOTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const purpose = req.body.purpose === 'password-reset' ? 'password-reset' : 'authentication';

    if (!isValidEmail(email)) {
      return res.status(200).json({ message: 'If the account can receive a code, a new code has been sent.' });
    }

    const staff = await Staff.findOne({ email }).select(
      '+otpHash +otpExpiry +otpPurpose +otpAttempts +otpLastSentAt +isActive'
    );

    if (!staff || !staff.isActive) {
      return res.status(200).json({ message: 'If the account can receive a code, a new code has been sent.' });
    }

    const sendError = await createAndSendOtp(staff, purpose, res);
    if (sendError) return sendError;

    await audit(req, 'OTP_RESENT', {
      userId: staff._id,
      email,
      metadata: { purpose },
    });

    return res.status(200).json({ message: 'If the account can receive a code, a new code has been sent.' });
  } catch (error) {
    console.error('Error in resendOTP:', error);
    return res.status(500).json({ message: 'Server error while requesting a new code.' });
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    // Always use the same public response to avoid account enumeration.
    const generic = { message: 'If that email is in our database, an OTP has been sent.' };

    if (!isValidEmail(email)) return res.status(200).json(generic);

    const staff = await Staff.findOne({ email }).select(
      '+otpHash +otpExpiry +otpPurpose +otpAttempts +otpLastSentAt +isActive'
    );

    if (!staff || !staff.isActive) return res.status(200).json(generic);

    const sendError = await createAndSendOtp(staff, 'password-reset', res);
    if (sendError) return sendError;

    await audit(req, 'PASSWORD_RESET_REQUESTED', {
      userId: staff._id,
      email,
      metadata: { role: staff.role },
    });

    return res.status(200).json(generic);
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    return res.status(500).json({ message: 'Server error during forgot password.' });
  }
};

// POST /api/auth/verify-reset-otp
exports.verifyResetOTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = typeof req.body.otp === 'string' ? req.body.otp.trim() : '';

    if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    const staff = await Staff.findOne({ email }).select(
      '+otpHash +otpExpiry +otpPurpose +otpAttempts +isActive +sessionVersion'
    );

    if (!staff || !staff.isActive || staff.otpPurpose !== 'password-reset' || !staff.otpHash) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    if (!staff.otpExpiry || staff.otpExpiry <= new Date()) {
      staff.otpHash = null;
      staff.otpExpiry = null;
      staff.otpPurpose = null;
      staff.otpAttempts = 0;
      staff.otpLastSentAt = null;
      await staff.save();
      await audit(req, 'PASSWORD_RESET_OTP_EXPIRED', { userId: staff._id, email, success: false });
      return res.status(400).json({ error: 'OTP has expired.' });
    }

    if (Number(staff.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
      staff.otpHash = null;
      staff.otpExpiry = null;
      staff.otpPurpose = null;
      staff.otpAttempts = 0;
      staff.otpLastSentAt = null;
      await staff.save();
      return res.status(400).json({ error: 'Too many invalid attempts. Please request a new code.' });
    }

    const suppliedHash = hashSecret(otp);
    const valid = safeEqualString(suppliedHash, staff.otpHash);

    if (!valid) {
      staff.otpAttempts = Number(staff.otpAttempts || 0) + 1;
      if (staff.otpAttempts >= OTP_MAX_ATTEMPTS) {
        staff.otpHash = null;
        staff.otpExpiry = null;
        staff.otpPurpose = null;
        staff.otpAttempts = 0;
        staff.otpLastSentAt = null;
      }
      await staff.save();
      await audit(req, 'PASSWORD_RESET_OTP_FAILURE', {
        userId: staff._id,
        email,
        success: false,
      });
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    staff.otpHash = null;
    staff.otpExpiry = null;
    staff.otpPurpose = null;
    staff.otpAttempts = 0;
    staff.otpLastSentAt = null;

    // The raw credential lives only in the HttpOnly reset cookie.
    const rawResetToken = generateOpaqueToken(48);
    staff.resetPasswordToken = hashSecret(rawResetToken);
    staff.resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000);
    await staff.save();

    setResetCookie(res, rawResetToken);

    await audit(req, 'PASSWORD_RESET_OTP_VERIFIED', {
      userId: staff._id,
      email,
    });

    return res.status(200).json({ message: 'OTP verified.', resetReady: true });
  } catch (error) {
    console.error('Error in verifyResetOTP:', error);
    return res.status(500).json({ error: 'Server error during reset verification.' });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const newPassword = req.body.newPassword;
    const rawResetToken = req.cookies?.[resetCookieName];

    if (!isValidEmail(email) || !isStrongPassword(newPassword) || !rawResetToken) {
      return res.status(400).json({ message: 'Invalid or expired reset request.' });
    }

    const hashedToken = hashSecret(rawResetToken);
    const staff = await Staff.findOne({
      email,
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: new Date() },
      isActive: true,
    }).select(
      '+password +resetPasswordToken +resetPasswordExpire +sessionVersion +isActive +isVerified'
    );

    if (!staff) {
      clearResetCookie(res);
      return res.status(400).json({ message: 'Invalid or expired reset request.' });
    }

    staff.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    staff.passwordChangedAt = new Date();
    staff.lastPasswordResetAt = new Date();
    staff.sessionVersion = Number(staff.sessionVersion || 0) + 1;
    staff.isVerified = true;
    staff.failedLoginAttempts = 0;
    staff.lockUntil = null;
    staff.resetPasswordToken = null;
    staff.resetPasswordExpire = null;
    staff.otpHash = null;
    staff.otpExpiry = null;
    staff.otpPurpose = null;
    staff.otpAttempts = 0;

    assignDefaultAuthMethod(staff, 'password');
    await staff.save();

    // Password reset invalidates every existing application session/device.
    await revokeAllUserSessions(staff._id);
    clearResetCookie(res);
    clearAuthCookies(res);

    await audit(req, 'PASSWORD_RESET_COMPLETED', {
      userId: staff._id,
      email,
      metadata: { allSessionsRevoked: true },
    });

    if (process.env.NODE_ENV !== 'test' && staff.email) {
      sendSecurityEmail(
        staff.email,
        'EduSphere password changed',
        'Your EduSphere password was changed successfully. All existing EduSphere application sessions were invalidated. If you did not perform this action, contact your EduSphere administrator immediately.'
      ).catch((error) => {
        console.error('[EMAIL] Password reset notification failed:', error.message);
      });
    }

    return res.status(200).json({ message: 'Password has been updated successfully.' });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    return res.status(500).json({ message: 'Server error during password reset.' });
  }
};

// Optional authenticated password change endpoint.
exports.changePassword = async (req, res) => {
  try {
    const currentPassword = req.body.currentPassword;
    const newPassword = req.body.newPassword;

    if (typeof currentPassword !== 'string' || !isStrongPassword(newPassword)) {
      return res.status(400).json({ message: 'Invalid password data.' });
    }

    const staff = await Staff.findById(req.user._id).select('+password +sessionVersion');
    if (!staff?.password) return res.status(400).json({ message: 'This account does not currently use password authentication.' });

    const correct = await bcrypt.compare(currentPassword, staff.password);
    if (!correct) {
      await audit(req, 'PASSWORD_CHANGE_FAILURE', { userId: staff._id, success: false });
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    staff.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    staff.passwordChangedAt = new Date();
    staff.sessionVersion = Number(staff.sessionVersion || 0) + 1;
    assignDefaultAuthMethod(staff, 'password');
    await staff.save();

    await revokeAllUserSessions(staff._id);

    await audit(req, 'PASSWORD_CHANGED', {
      userId: staff._id,
      metadata: { allSessionsRevoked: true },
    });

    clearResetCookie(res);
    clearAuthCookies(res);
    if (process.env.NODE_ENV !== 'test' && staff.email) {
      sendSecurityEmail(
        staff.email,
        'EduSphere password changed',
        'Your EduSphere password was changed successfully and all existing sessions were invalidated.'
      ).catch(() => {});
    }

    return res.status(200).json({ message: 'Password changed successfully. Please sign in again.' });
  } catch (error) {
    console.error('Error in changePassword:', error);
    return res.status(500).json({ message: 'Server error while changing password.' });
  }
};

// Admin-only role assignment. Public registration cannot create elevated roles in production.
exports.updateUserRole = async (req, res) => {
  try {
    const userId = req.params.id;
    const role = req.body.role;

    if (!['admin', 'instructor', 'student'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role.' });
    }

    const staff = await Staff.findById(userId).select('+sessionVersion');
    if (!staff) return res.status(404).json({ message: 'User not found.' });

    if (String(staff._id) === String(req.user._id) && role !== 'admin') {
      return res.status(400).json({ message: 'Administrators cannot remove their own administrator role.' });
    }

    const previousRole = staff.role;
    staff.role = role;
    staff.sessionVersion = Number(staff.sessionVersion || 0) + 1;
    await staff.save();
    await revokeAllUserSessions(staff._id);

    await audit(req, 'ROLE_CHANGED', {
      userId: staff._id,
      metadata: {
        changedBy: String(req.user._id),
        from: previousRole,
        to: role,
        allSessionsRevoked: true,
      },
    });

    return res.status(200).json({ message: 'User role updated successfully.', user: publicUser(staff) });
  } catch (error) {
    console.error('Error in updateUserRole:', error);
    return res.status(500).json({ message: 'Server error while updating role.' });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    const isActive = req.body.isActive;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be a boolean.' });
    }

    const staff = await Staff.findById(userId).select('+sessionVersion');
    if (!staff) return res.status(404).json({ message: 'User not found.' });

    if (String(staff._id) === String(req.user._id) && !isActive) {
      return res.status(400).json({ message: 'Administrators cannot deactivate their own account.' });
    }

    staff.isActive = isActive;
    staff.sessionVersion = Number(staff.sessionVersion || 0) + 1;
    await staff.save();
    await revokeAllUserSessions(staff._id);

    await audit(req, isActive ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED', {
      userId: staff._id,
      metadata: { changedBy: String(req.user._id) },
    });

    return res.status(200).json({ message: `Account ${isActive ? 'activated' : 'deactivated'} successfully.` });
  } catch (error) {
    console.error('Error in updateUserStatus:', error);
    return res.status(500).json({ message: 'Server error while updating account status.' });
  }
};
