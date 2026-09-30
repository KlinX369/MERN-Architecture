/* =========================================================
   EDUSPHERE SERVER
   Express + MongoDB + Passport OAuth + Secure Cookie Auth
   ========================================================= */

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const helmet = require('helmet');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const Staff = require('./models/Staff');
const authRoutes = require('./routes/authRoutes');
const {
  issueAuthentication,
  getCookieNames,
  revokeSessionByRefreshToken,
  clearAuthCookies,
  clearResetCookie,
  clearCsrfCookie,
} = require('./utils/authTokens');
const { hashSecret, safeEqualString } = require('./utils/security');
const { audit } = require('./utils/audit');
const { oauthLimiter } = require('./middleware/rateLimiters');

const app = express();

/* =========================================================
   ENVIRONMENT / SECURITY CONFIG
   ========================================================= */

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 5000);

const FRONTEND_URL = String(
  process.env.FRONTEND_URL || 'http://localhost:5173'
).replace(/\/$/, '');

const FRONTEND_URLS = String(process.env.FRONTEND_URLS || FRONTEND_URL)
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

const BACKEND_URL = String(
  process.env.BACKEND_URL || `http://localhost:${PORT}`
).replace(/\/$/, '');

const LINKEDIN_REDIRECT_URI = String(
  process.env.LINKEDIN_REDIRECT_URI || `${BACKEND_URL}/api/auth/callback/linkedin`
);

const GITHUB_REDIRECT_URI = String(
  process.env.GITHUB_REDIRECT_URI || `${BACKEND_URL}/api/auth/callback/github`
);

const TIKTOK_REDIRECT_URI = String(
  process.env.TIKTOK_REDIRECT_URI || `${BACKEND_URL}/auth/tiktok/callback`
);

const OAUTH_SESSION_COOKIE = IS_PRODUCTION
  ? '__Host-edusphere_oauth'
  : 'edusphere_oauth';

function assertStartupConfiguration() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required.');
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long.');
  }

  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters long.');
  }

  if (IS_PRODUCTION && FRONTEND_URLS.some((url) => !url.startsWith('https://'))) {
    throw new Error('All production FRONTEND_URLS must use HTTPS.');
  }
}

assertStartupConfiguration();

/* =========================================================
   MIDDLEWARE
   ========================================================= */

if (IS_PRODUCTION) app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, '');
      if (FRONTEND_URLS.includes(normalized)) return callback(null, true);
      return callback(new Error('CORS origin not allowed.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    optionsSuccessStatus: 204,
  })
);

app.use(
  helmet({
    strictTransportSecurity: IS_PRODUCTION,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

/* =========================================================
   TRANSIENT OAUTH SESSION
   Passport is used only to complete the OAuth handshake.
   The application's real authentication is the secure access/refresh cookie pair.
   ========================================================= */

app.use(
  session({
    name: OAUTH_SESSION_COOKIE,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'oauth_sessions',
      ttl: 10 * 60,
      touchAfter: 300,
    }),
    cookie: {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    },
  })
);

app.use(passport.initialize());

/* =========================================================
   COMMON OAUTH HELPERS
   ========================================================= */

function redirectToLogin(res, reason = 'oauth_failed') {
  const separator = FRONTEND_URL.includes('?') ? '&' : '?';
  const safeReason = encodeURIComponent(String(reason).slice(0, 80));
  return res.redirect(`${FRONTEND_URL}/login${separator}error=${safeReason}`);
}

function addAuthMethod(user, method) {
  const methods = Array.isArray(user.authMethods) ? user.authMethods : [];
  if (!methods.includes(method)) methods.push(method);
  user.authMethods = methods;
}

async function upsertOAuthUser({ provider, providerId, email, emailVerified, name, avatar }) {
  const providerField = `${provider}Id`;
  let user = await Staff.findOne({ [providerField]: providerId });

  if (!user && email && emailVerified) {
    user = await Staff.findOne({ email: email.toLowerCase().trim() });
  }

  if (user) {
    if (!user.isActive) return { error: 'account_disabled' };

    if (user[providerField] && String(user[providerField]) !== String(providerId)) {
      return { error: 'oauth_account_conflict' };
    }

    user[providerField] = providerId;
    addAuthMethod(user, provider);

    if (!user.name && name) user.name = name;
    if (!user.avatar && avatar) user.avatar = avatar;
    user.isVerified = true;

    await user.save();
    return { user };
  }

  // For providers that supply an email, an unverified provider email is never auto-linked.
  if (email && !emailVerified) return { error: 'oauth_email_unverified' };

  const data = {
    email: email || undefined,
    name: name || `${provider} User`,
    avatar: avatar || '',
    role: 'student',
    isVerified: true,
    isActive: true,
    authMethods: [provider],
    [providerField]: providerId,
    password: null,
  };

  try {
    user = await Staff.create(data);
    return { user };
  } catch (error) {
    if (error?.code === 11000) {
      const retry = await Staff.findOne({
        $or: [
          { [providerField]: providerId },
          ...(email ? [{ email: email.toLowerCase().trim() }] : []),
        ],
      });
      if (retry) return { user: retry };
    }
    throw error;
  }
}

async function completeOAuthLogin(req, res, user, provider) {
  if (!user || !user.isActive) return redirectToLogin(res, 'account_disabled');

  try {
    const { authSession } = await issueAuthentication(res, user, req);

    await audit(req, 'OAUTH_LOGIN_SUCCESS', {
      userId: user._id,
      email: user.email,
      metadata: {
        provider,
        sessionId: String(authSession._id),
      },
    });

    // Destroy the transient Passport/OAuth state session after issuing application auth cookies.
    if (req.session) {
      return req.session.destroy(() => {
        res.clearCookie(OAUTH_SESSION_COOKIE, {
          httpOnly: true,
          secure: IS_PRODUCTION,
          sameSite: 'lax',
          path: '/',
        });
        return res.redirect(`${FRONTEND_URL}/dashboard`);
      });
    }

    return res.redirect(`${FRONTEND_URL}/dashboard`);
  } catch (error) {
    console.error(`[${provider.toUpperCase()}] Application authentication failed:`, error.message);
    return redirectToLogin(res, `${provider}_session_failed`);
  }
}

function saveOAuthState(req, key) {
  const state = crypto.randomBytes(32).toString('hex');
  req.session[key] = state;
  return state;
}

/* =========================================================
   GOOGLE OAUTH
   ========================================================= */

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${BACKEND_URL}/auth/google/callback`,
        passReqToCallback: false,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const primary = profile.emails?.[0];
          const email = primary?.value?.toLowerCase()?.trim() || '';
          const emailVerified = Boolean(primary?.verified);

          if (!email || !emailVerified) {
            return done(null, false, { message: 'google_email_unverified' });
          }

          const result = await upsertOAuthUser({
            provider: 'google',
            providerId: String(profile.id),
            email,
            emailVerified,
            name: profile.displayName || email.split('@')[0],
            avatar: profile.photos?.[0]?.value || '',
          });

          if (result.error) return done(null, false, { message: result.error });
          return done(null, result.user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
}

app.get('/auth/google', oauthLimiter, (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return redirectToLogin(res, 'google_not_configured');
  }

  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state: true,
  })(req, res, next);
});

app.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${FRONTEND_URL}/login?error=google_authentication_failed`,
    session: false,
  }),
  async (req, res) => completeOAuthLogin(req, res, req.user, 'google')
);

/* =========================================================
   LINKEDIN OAUTH
   ========================================================= */

app.get('/auth/linkedin', oauthLimiter, (req, res) => {
  if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
    return redirectToLogin(res, 'linkedin_not_configured');
  }

  const state = saveOAuthState(req, 'linkedinOAuthState');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: LINKEDIN_REDIRECT_URI,
    state,
    scope: 'openid profile email',
  });

  return res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
});

app.get('/api/auth/callback/linkedin', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    const savedState = req.session?.linkedinOAuthState;

    delete req.session?.linkedinOAuthState;

    if (error) return redirectToLogin(res, 'linkedin_provider_error');
    if (!code || !state || !savedState || !safeEqualString(String(state), String(savedState))) {
      return redirectToLogin(res, 'invalid_linkedin_state');
    }

    const tokenResponse = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        redirect_uri: LINKEDIN_REDIRECT_URI,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      }
    );

    const accessToken = tokenResponse.data?.access_token;
    if (!accessToken) return redirectToLogin(res, 'linkedin_token_failed');

    const profileResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      timeout: 15000,
    });

    const profile = profileResponse.data || {};
    const email = profile.email?.toLowerCase()?.trim() || '';
    const emailVerified = Boolean(profile.email_verified);

    if (!profile.sub || !email || !emailVerified) {
      return redirectToLogin(res, 'linkedin_email_unverified');
    }

    const result = await upsertOAuthUser({
      provider: 'linkedin',
      providerId: String(profile.sub),
      email,
      emailVerified,
      name: profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(' ').trim(),
      avatar: profile.picture || '',
    });

    if (result.error) return redirectToLogin(res, result.error);
    return completeOAuthLogin(req, res, result.user, 'linkedin');
  } catch (error) {
    console.error('LinkedIn Authentication Error:', error.message);
    return redirectToLogin(res, 'linkedin_authentication_failed');
  }
});

/* =========================================================
   GITHUB OAUTH
   ========================================================= */

app.get('/auth/github', oauthLimiter, (req, res) => {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return redirectToLogin(res, 'github_not_configured');
  }

  const state = saveOAuthState(req, 'githubOAuthState');
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: 'read:user user:email',
    state,
    allow_signup: 'true',
  });

  return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

app.get('/api/auth/callback/github', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    const savedState = req.session?.githubOAuthState;

    delete req.session?.githubOAuthState;

    if (error) return redirectToLogin(res, 'github_provider_error');
    if (!code || !state || !savedState || !safeEqualString(String(state), String(savedState))) {
      return redirectToLogin(res, 'invalid_github_state');
    }

    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: String(code),
        redirect_uri: GITHUB_REDIRECT_URI,
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        timeout: 15000,
      }
    );

    const accessToken = tokenResponse.data?.access_token;
    if (!accessToken) return redirectToLogin(res, 'github_token_failed');

    const githubHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    const [profileResponse, emailResponse] = await Promise.all([
      axios.get('https://api.github.com/user', { headers: githubHeaders, timeout: 15000 }),
      axios.get('https://api.github.com/user/emails', { headers: githubHeaders, timeout: 15000 }),
    ]);

    const profile = profileResponse.data || {};
    const emails = Array.isArray(emailResponse.data) ? emailResponse.data : [];
    const verified =
      emails.find((item) => item.primary && item.verified && item.email) ||
      emails.find((item) => item.verified && item.email);

    const email = verified?.email?.toLowerCase()?.trim() || '';
    if (!profile.id || !email) return redirectToLogin(res, 'github_email_unverified');

    const result = await upsertOAuthUser({
      provider: 'github',
      providerId: String(profile.id),
      email,
      emailVerified: true,
      name: profile.name?.trim() || profile.login?.trim() || email.split('@')[0],
      avatar: profile.avatar_url || '',
    });

    if (result.error) return redirectToLogin(res, result.error);
    return completeOAuthLogin(req, res, result.user, 'github');
  } catch (error) {
    console.error('GitHub Authentication Error:', error.message);
    return redirectToLogin(res, 'github_authentication_failed');
  }
});

/* =========================================================
   TIKTOK OAUTH
   ========================================================= */

const TIKTOK_STATE_COOKIE = IS_PRODUCTION
  ? '__Host-edusphere_tiktok_state'
  : 'edusphere_tiktok_state';

app.get('/auth/tiktok', oauthLimiter, (req, res) => {
  if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) {
    return redirectToLogin(res, 'tiktok_not_configured');
  }

  const state = crypto.randomBytes(32).toString('hex');
  res.cookie(TIKTOK_STATE_COOKIE, state, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    path: '/',
    maxAge: 5 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    scope: 'user.info.basic',
    response_type: 'code',
    redirect_uri: TIKTOK_REDIRECT_URI,
    state,
  });

  return res.redirect(`https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`);
});

app.get('/auth/tiktok/callback', async (req, res) => {
  try {
    const stateCookie = req.cookies?.[TIKTOK_STATE_COOKIE];
    const { code, state } = req.query;

    res.clearCookie(TIKTOK_STATE_COOKIE, {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: 'lax',
      path: '/',
    });

    if (!stateCookie || !state || !safeEqualString(String(state), String(stateCookie))) {
      return redirectToLogin(res, 'invalid_tiktok_state');
    }

    if (!code) return redirectToLogin(res, 'missing_tiktok_code');

    const tokenResponse = await axios.post(
      'https://open.tiktokapis.com/v2/oauth/token/',
      new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        code: String(code),
        grant_type: 'authorization_code',
        redirect_uri: TIKTOK_REDIRECT_URI,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      }
    );

    const accessToken = tokenResponse.data?.access_token;
    if (!accessToken) return redirectToLogin(res, 'tiktok_token_failed');

    const userResponse = await axios.get(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }
    );

    const tiktokUser = userResponse.data?.data?.user;
    if (!tiktokUser?.open_id) return redirectToLogin(res, 'tiktok_profile_invalid');

    const result = await upsertOAuthUser({
      provider: 'tiktok',
      providerId: String(tiktokUser.open_id),
      email: '',
      emailVerified: false,
      name: tiktokUser.display_name || 'TikTok User',
      avatar: tiktokUser.avatar_url || '',
    });

    if (result.error) return redirectToLogin(res, result.error);
    return completeOAuthLogin(req, res, result.user, 'tiktok');
  } catch (error) {
    console.error('TikTok Authentication Error:', error.message);
    return redirectToLogin(res, 'tiktok_authentication_failed');
  }
});

/* =========================================================
   AUTH API
   ========================================================= */

app.use('/api/auth', authRoutes);

/* Compatibility endpoint used by existing application code. */
const { protect } = require('./middleware/authMiddleware');

app.get('/auth/me', protect, (req, res) => {
  const user = req.user;
  return res.status(200).json({
    authenticated: true,
    user: {
      id: String(user._id),
      email: user.email || '',
      name: user.name || user.email?.split('@')[0] || 'User',
      username: user.username || user.name || user.email?.split('@')[0] || 'user',
      avatar: user.avatar || '',
      role: user.role,
      isVerified: Boolean(user.isVerified),
      department: user.department || 'Unassigned',
    },
  });
});

/* =========================================================
   LOGOUT COMPATIBILITY ROUTE
   ========================================================= */

app.get('/auth/logout', async (req, res) => {
  try {
    const refreshCookie = req.cookies?.[getCookieNames().refreshCookieName];
    if (refreshCookie) await revokeSessionByRefreshToken(refreshCookie);

    if (req.session) {
      await new Promise((resolve) => req.session.destroy(() => resolve()));
    }

    clearAuthCookies(res);
    clearResetCookie(res);
    clearCsrfCookie(res);
    res.clearCookie(OAUTH_SESSION_COOKIE, { httpOnly: true, secure: IS_PRODUCTION, sameSite: 'lax', path: '/' });
    res.clearCookie(TIKTOK_STATE_COOKIE, { httpOnly: true, secure: IS_PRODUCTION, sameSite: 'lax', path: '/' });

    return res.redirect(`${FRONTEND_URL}/login`);
  } catch (error) {
    return res.redirect(`${FRONTEND_URL}/login`);
  }
});

/* =========================================================
   HEALTH / ERROR HANDLERS
   ========================================================= */

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'EduSphere API is running successfully.',
    status: 'online',
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  if (err?.message === 'CORS origin not allowed.') {
    return res.status(403).json({ message: 'Origin not allowed.' });
  }

  console.error('[GLOBAL_ERROR]', err?.stack || err?.message || err);
  if (res.headersSent) return next(err);

  return res.status(err?.statusCode || 500).json({
    error: 'Server Error',
    message: IS_PRODUCTION ? 'Something went wrong.' : err.message,
  });
});

/* =========================================================
   DATABASE / SERVER
   ========================================================= */

async function connectDB() {
  mongoose.set('strictQuery', true);
  mongoose.set('sanitizeFilter', true);

  const conn = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log(`[Database] MongoDB connected: ${conn.connection.host}`);
}

async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`[Server] EduSphere API running in ${NODE_ENV} mode on port ${PORT}`);
    console.log(`[Server] Frontend: ${FRONTEND_URL}`);
    console.log(`[Server] Backend: ${BACKEND_URL}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(`[Startup] ${error.message}`);
    process.exit(1);
  });
}

module.exports = app;
