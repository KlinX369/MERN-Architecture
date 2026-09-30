// utils/authTokens.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Staff = require('../models/Staff');
const AuthSession = require('../models/AuthSession');
const { generateOpaqueToken, hashSecret, hashForAudit } = require('./security');

const isProduction = process.env.NODE_ENV === 'production';
const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const sameSite = ['lax', 'strict', 'none'].includes(
  String(process.env.COOKIE_SAME_SITE || '').toLowerCase()
)
  ? String(process.env.COOKIE_SAME_SITE).toLowerCase()
  : isProduction
    ? 'none'
    : 'lax';

const accessCookieName = isProduction
  ? '__Host-edusphere_access'
  : 'edusphere_access';

const refreshCookieName = isProduction
  ? '__Host-edusphere_refresh'
  : 'edusphere_refresh';

const resetCookieName = isProduction
  ? '__Host-edusphere_reset'
  : 'edusphere_reset';

const csrfCookieName = 'edusphere_csrf';

function assertJwtConfig() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long.');
  }
}

function cookieBase(maxAge, httpOnly = true) {
  return {
    httpOnly,
    secure: isProduction,
    sameSite,
    path: '/',
    maxAge,
  };
}

function setAccessCookie(res, token) {
  res.cookie(accessCookieName, token, cookieBase(ACCESS_TTL_MS, true));
}

function setRefreshCookie(res, token) {
  res.cookie(refreshCookieName, token, cookieBase(REFRESH_TTL_MS, true));
}

function setResetCookie(res, token) {
  // Reset credential is deliberately HttpOnly and short-lived.
  res.cookie(resetCookieName, token, cookieBase(15 * 60 * 1000, true));
}

function setCsrfCookie(res, token) {
  res.cookie(csrfCookieName, token, {
    httpOnly: false,
    secure: isProduction,
    sameSite,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res) {
  const opts = { httpOnly: true, secure: isProduction, sameSite, path: '/' };
  res.clearCookie(accessCookieName, opts);
  res.clearCookie(refreshCookieName, opts);
}

function clearResetCookie(res) {
  const opts = { httpOnly: true, secure: isProduction, sameSite, path: '/' };
  res.clearCookie(resetCookieName, opts);
}

function clearCsrfCookie(res) {
  res.clearCookie(csrfCookieName, {
    httpOnly: false,
    secure: isProduction,
    sameSite,
    path: '/',
  });
}

function signAccessToken(user, sessionId) {
  assertJwtConfig();

  const payload = {
    sub: String(user._id),
    sid: String(sessionId),
    sv: Number(user.sessionVersion || 0),
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '15m',
    issuer: process.env.JWT_ISSUER || 'edusphere-api',
    audience: process.env.JWT_AUDIENCE || 'edusphere-web',
    algorithm: 'HS256',
  });
}

function verifyAccessToken(token) {
  assertJwtConfig();
  return jwt.verify(token, process.env.JWT_SECRET, {
    issuer: process.env.JWT_ISSUER || 'edusphere-api',
    audience: process.env.JWT_AUDIENCE || 'edusphere-web',
    algorithms: ['HS256'],
  });
}

async function createAuthSession(user, req) {
  const rawRefreshToken = generateOpaqueToken(64);
  const tokenHash = hashSecret(rawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  const authSession = await AuthSession.create({
    user: user._id,
    tokenHash,
    expiresAt,
    ipHash: hashForAudit(req.ip || ''),
    userAgent: String(req.get('user-agent') || '').slice(0, 1000),
  });

  return { authSession, rawRefreshToken };
}

async function issueAuthentication(res, user, req) {
  const freshUser = await Staff.findById(user._id).select('+sessionVersion +isActive +isVerified');
  if (!freshUser || !freshUser.isActive || !freshUser.isVerified) {
    throw new Error('User is not allowed to authenticate.');
  }

  const { authSession, rawRefreshToken } = await createAuthSession(freshUser, req);
  const accessToken = signAccessToken(freshUser, authSession._id);

  setAccessCookie(res, accessToken);
  setRefreshCookie(res, rawRefreshToken);

  return {
    accessToken,
    authSession,
    user: freshUser,
  };
}

async function revokeSessionById(sessionId) {
  if (!sessionId) return;
  await AuthSession.updateOne(
    { _id: sessionId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}


async function revokeSessionByRefreshToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashSecret(rawToken);
  await AuthSession.updateOne(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

async function revokeAllUserSessions(userId) {
  await AuthSession.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

async function rotateRefreshToken(rawToken, req, res) {
  if (!rawToken) return null;

  const oldHash = hashSecret(rawToken);
  const oldSession = await AuthSession.findOne({ tokenHash: oldHash });

  if (!oldSession) return null;

  const user = await Staff.findById(oldSession.user).select('+sessionVersion +isActive +isVerified');
  if (!user) return null;

  if (oldSession.revokedAt) {
    // Reuse of a rotated refresh token is treated as token theft.
    if (oldSession.replacedBy) {
      user.sessionVersion = Number(user.sessionVersion || 0) + 1;
      await user.save();
      await revokeAllUserSessions(user._id);
    }
    return null;
  }

  if (oldSession.expiresAt <= new Date()) {
    oldSession.revokedAt = new Date();
    await oldSession.save();
    return null;
  }

  if (!user.isActive || !user.isVerified) return null;

  const { authSession: newSession, rawRefreshToken: newRawRefreshToken } =
    await createAuthSession(user, req);

  oldSession.revokedAt = new Date();
  oldSession.replacedBy = newSession._id;
  oldSession.lastUsedAt = new Date();
  await oldSession.save();

  const accessToken = signAccessToken(user, newSession._id);
  setAccessCookie(res, accessToken);
  setRefreshCookie(res, newRawRefreshToken);

  return { user, authSession: newSession, accessToken };
}

function getAccessTokenFromRequest(req) {
  const cookieToken = req.cookies?.[accessCookieName];
  if (cookieToken) return { token: cookieToken, source: 'cookie' };

  // Compatibility for older clients. Keep disabled in production unless explicitly enabled.
  const allowBearer =
    !isProduction || String(process.env.ALLOW_BEARER_TOKENS || '').toLowerCase() === 'true';

  if (allowBearer) {
    const authHeader = req.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      return { token: authHeader.slice(7).trim(), source: 'bearer' };
    }
  }

  return { token: null, source: null };
}

function getCookieNames() {
  return {
    accessCookieName,
    refreshCookieName,
    resetCookieName,
    csrfCookieName,
  };
}

module.exports = {
  ACCESS_TTL_MS,
  REFRESH_TTL_MS,
  signAccessToken,
  verifyAccessToken,
  issueAuthentication,
  revokeSessionById,
  revokeSessionByRefreshToken,
  revokeAllUserSessions,
  rotateRefreshToken,
  getAccessTokenFromRequest,
  setResetCookie,
  clearResetCookie,
  setCsrfCookie,
  clearCsrfCookie,
  clearAuthCookies,
  getCookieNames,
};
