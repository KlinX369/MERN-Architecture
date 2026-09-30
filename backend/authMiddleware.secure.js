// middleware/authMiddleware.js
const Staff = require('../models/Staff');
const AuthSession = require('../models/AuthSession');
const {
  verifyAccessToken,
  getAccessTokenFromRequest,
  rotateRefreshToken,
} = require('../utils/authTokens');
const { audit } = require('../utils/audit');

async function loadFreshUser(userId) {
  return Staff.findById(userId).select('+sessionVersion +isActive +isVerified');
}

async function authenticateRequest(req, res) {
  const { token, source } = getAccessTokenFromRequest(req);
  const refreshToken = req.cookies?.[
    require('../utils/authTokens').getCookieNames().refreshCookieName
  ];

  if (!token) {
    if (!refreshToken) return null;
    const rotated = await rotateRefreshToken(refreshToken, req, res);
    if (!rotated) return null;
    req.user = rotated.user;
    req.authSession = rotated.authSession;
    return rotated.user;
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (error) {
    if (error?.name === 'TokenExpiredError' && refreshToken && source === 'cookie') {
      const rotated = await rotateRefreshToken(refreshToken, req, res);
      if (!rotated) return null;
      req.user = rotated.user;
      req.authSession = rotated.authSession;
      return rotated.user;
    }
    return null;
  }

  if (!decoded?.sub || !decoded?.sid) return null;

  const currentUser = await loadFreshUser(decoded.sub);
  if (!currentUser || !currentUser.isActive || !currentUser.isVerified) return null;

  if (Number(decoded.sv) !== Number(currentUser.sessionVersion || 0)) return null;

  if (currentUser.passwordChangedAt && decoded.iat) {
    const passwordChangedAtSeconds = Math.floor(new Date(currentUser.passwordChangedAt).getTime() / 1000);
    if (decoded.iat < passwordChangedAtSeconds) return null;
  }

  const authSession = await AuthSession.findOne({
    _id: decoded.sid,
    user: currentUser._id,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!authSession) return null;

  authSession.lastUsedAt = new Date();
  await authSession.save();

  req.user = currentUser;
  req.authSession = authSession;
  return currentUser;
}

// Layer 1: Authenticate identity. Role is always loaded from MongoDB at request time.
exports.protect = async (req, res, next) => {
  try {
    const user = await authenticateRequest(req, res);
    if (!user) {
      return res.status(401).json({ message: 'Not authorized.' });
    }
    next();
  } catch (error) {
    console.error('[AUTH] protect error:', error.message);
    return res.status(401).json({ message: 'Not authorized.' });
  }
};

exports.optionalProtect = async (req, res, next) => {
  try {
    await authenticateRequest(req, res);
    next();
  } catch (error) {
    next();
  }
};

// Layer 2: RBAC. Frontend role values are never trusted.
exports.authorize = (...allowedRoles) => {
  const roles = new Set(allowedRoles);
  return (req, res, next) => {
    if (!req.user || !roles.has(req.user.role)) {
      audit(req, 'RBAC_DENIED', {
        userId: req.user?._id,
        success: false,
        metadata: {
          role: req.user?.role || 'guest',
          requiredRoles: [...roles],
          path: req.originalUrl,
        },
      }).catch(() => {});

      return res.status(403).json({ message: 'Forbidden.' });
    }
    next();
  };
};

// Layer 3: Resource ownership / tenant checks can be composed with this helper.
exports.requireSelfOrRoles = (paramName, ...allowedRoles) => {
  const roles = new Set(allowedRoles);
  return (req, res, next) => {
    const requestedId = String(req.params[paramName] || '');
    const isSelf = req.user && requestedId === String(req.user._id);
    const allowed = req.user && (isSelf || roles.has(req.user.role));

    if (!allowed) return res.status(403).json({ message: 'Forbidden.' });
    next();
  };
};
