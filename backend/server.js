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
const passport = require('passport');
const {
    rateLimit
} = require('express-rate-limit');

const GoogleStrategy =
    require('passport-google-oauth20')
        .Strategy;

const Staff =
    require('./models/Staff');

const authRoutes =
    require('./routes/authRoutes');

const {
    issueAuthentication,
    protect,
    getCookieNames,
    clearAuthCookies,
    clearResetCookie,
    clearCsrfCookie,
    revokeSessionByRefreshToken,
    audit,
    safeEqualString
} = require('./middleware/authMiddleware');

const app =
    express();

/* =========================================================
   ENVIRONMENT
   ========================================================= */

const NODE_ENV =
    process.env.NODE_ENV ||
    'development';

const IS_PRODUCTION =
    NODE_ENV ===
    'production';

const PORT =
    Number(
        process.env.PORT ||
            5000
    );

const FRONTEND_URL =
    String(
        process.env.FRONTEND_URL ||
            'http://localhost:5173'
    ).replace(
        /\/$/,
        ''
    );

const FRONTEND_URLS =
    String(
        process.env.FRONTEND_URLS ||
            FRONTEND_URL
    )
        .split(',')
        .map((url) =>
            url
                .trim()
                .replace(
                    /\/$/,
                    ''
                )
        )
        .filter(Boolean);

const BACKEND_URL =
    String(
        process.env.BACKEND_URL ||
            `http://localhost:${PORT}`
    ).replace(
        /\/$/,
        ''
    );

const LINKEDIN_REDIRECT_URI =
    String(
        process.env
            .LINKEDIN_REDIRECT_URI ||
            `${BACKEND_URL}/api/auth/callback/linkedin`
    );

const GITHUB_REDIRECT_URI =
    String(
        process.env
            .GITHUB_REDIRECT_URI ||
            `${BACKEND_URL}/api/auth/callback/github`
    );

const TIKTOK_REDIRECT_URI =
    String(
        process.env
            .TIKTOK_REDIRECT_URI ||
            `${BACKEND_URL}/auth/tiktok/callback`
    );

const GOOGLE_STATE_COOKIE =
    IS_PRODUCTION
        ? '__Host-edusphere_google_state'
        : 'edusphere_google_state';

const GITHUB_STATE_COOKIE =
    IS_PRODUCTION
        ? '__Host-edusphere_github_state'
        : 'edusphere_github_state';

const LINKEDIN_STATE_COOKIE =
    IS_PRODUCTION
        ? '__Host-edusphere_linkedin_state'
        : 'edusphere_linkedin_state';

const TIKTOK_STATE_COOKIE =
    IS_PRODUCTION
        ? '__Host-edusphere_tiktok_state'
        : 'edusphere_tiktok_state';

const STATE_COOKIE_OPTIONS = {
    httpOnly: true,
    secure:
        IS_PRODUCTION,
    sameSite: 'lax',
    path: '/',
    maxAge:
        5 * 60 * 1000
};

function assertStartupConfiguration() {
    if (
        !process.env.MONGO_URI
    ) {
        throw new Error(
            'MONGO_URI is required.'
        );
    }

    if (
        !process.env.JWT_SECRET ||
        process.env.JWT_SECRET.length <
            32
    ) {
        throw new Error(
            'JWT_SECRET must be set and at least 32 characters long.'
        );
    }

    if (
        IS_PRODUCTION &&
        FRONTEND_URLS.some(
            (url) =>
                !url.startsWith(
                    'https://'
                )
        )
    ) {
        throw new Error(
            'All production FRONTEND_URLS must use HTTPS.'
        );
    }

    if (
        IS_PRODUCTION &&
        !BACKEND_URL.startsWith(
            'https://'
        )
    ) {
        throw new Error(
            'BACKEND_URL must use HTTPS in production.'
        );
    }
}

assertStartupConfiguration();

/* =========================================================
   MIDDLEWARE
   ========================================================= */

if (IS_PRODUCTION) {
    app.set(
        'trust proxy',
        1
    );
}

app.disable(
    'x-powered-by'
);

app.use(
    cors({
        origin(
            origin,
            callback
        ) {
            if (!origin) {
                return callback(
                    null,
                    true
                );
            }

            const normalized =
                origin.replace(
                    /\/$/,
                    ''
                );

            if (
                FRONTEND_URLS.includes(
                    normalized
                )
            ) {
                return callback(
                    null,
                    true
                );
            }

            return callback(
                new Error(
                    'CORS origin not allowed.'
                )
            );
        },

        credentials:
            true,

        methods: [
            'GET',
            'POST',
            'PUT',
            'PATCH',
            'DELETE',
            'OPTIONS'
        ],

        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-CSRF-Token'
        ],

        optionsSuccessStatus:
            204
    })
);

app.use(
    helmet({
        strictTransportSecurity:
            IS_PRODUCTION
    })
);

app.use(
    express.json({
        limit:
            '1mb'
    })
);

app.use(
    express.urlencoded({
        extended:
            false,

        limit:
            '1mb'
    })
);

app.use(
    cookieParser()
);

app.use(
    passport.initialize()
);

const oauthLimiter =
    rateLimit({
        windowMs:
            10 * 60 * 1000,

        limit:
            20,

        standardHeaders:
            'draft-8',

        legacyHeaders:
            false,

        message: {
            message:
                'Too many authentication requests. Please try again later.'
        }
    });

/* =========================================================
   OAUTH HELPERS
   ========================================================= */

function redirectToLogin(
    res,
    reason =
        'oauth_failed'
) {
    const separator =
        FRONTEND_URL.includes(
            '?'
        )
            ? '&'
            : '?';

    const safeReason =
        encodeURIComponent(
            String(
                reason
            ).slice(
                0,
                100
            )
        );

    return res.redirect(
        `${FRONTEND_URL}/login${separator}error=${safeReason}`
    );
}

function setOAuthStateCookie(
    res,
    cookieName,
    state
) {
    res.cookie(
        cookieName,
        state,
        STATE_COOKIE_OPTIONS
    );
}

function clearOAuthStateCookie(
    res,
    cookieName
) {
    res.clearCookie(
        cookieName,
        {
            httpOnly:
                true,

            secure:
                IS_PRODUCTION,

            sameSite:
                'lax',

            path: '/'
        }
    );
}

function makeOAuthState() {
    return crypto
        .randomBytes(32)
        .toString('hex');
}

function validateOAuthState(
    req,
    res,
    cookieName,
    receivedState
) {
    const savedState =
        req.cookies?.[
            cookieName
        ];

    clearOAuthStateCookie(
        res,
        cookieName
    );

    if (
        !savedState ||
        !receivedState
    ) {
        return false;
    }

    return safeEqualString(
        String(
            savedState
        ),
        String(
            receivedState
        )
    );
}

function addAuthMethod(
    user,
    provider
) {
    const methods =
        Array.isArray(
            user.authMethods
        )
            ? user.authMethods
            : [];

    if (
        !methods.includes(
            provider
        )
    ) {
        methods.push(
            provider
        );
    }

    user.authMethods =
        methods;
}

/* =========================================================
   OAUTH USER CREATION/LINKING
   ========================================================= */

async function upsertOAuthUser({
    provider,
    providerId,
    email,
    emailVerified,
    name,
    avatar
}) {
    const providerField =
        `${provider}Id`;

    const normalizedEmail =
        email
            ? email
                  .toLowerCase()
                  .trim()
            : '';

    let user =
        await Staff.findOne({
            [providerField]:
                String(
                    providerId
                )
        });

    /*
     * Only verified OAuth emails can automatically link
     * to an existing account.
     */
    if (
        !user &&
        normalizedEmail &&
        emailVerified
    ) {
        user =
            await Staff.findOne({
                email:
                    normalizedEmail
            });
    }

    if (user) {
        if (
            !user.isActive
        ) {
            return {
                error:
                    'account_disabled'
            };
        }

        user[providerField] =
            String(
                providerId
            );

        addAuthMethod(
            user,
            provider
        );

        user.isVerified =
            true;

        if (
            name &&
            (!user.name ||
                user.name ===
                    'New User')
        ) {
            user.name =
                name.slice(
                    0,
                    120
                );
        }

        if (
            avatar &&
            !user.avatar
        ) {
            user.avatar =
                avatar.slice(
                    0,
                    2048
                );
        }

        await user.save();

        return {
            user
        };
    }

    /*
     * A provider with an unverified email must not
     * auto-link to an existing local account.
     */
    if (
        normalizedEmail &&
        !emailVerified
    ) {
        return {
            error:
                'oauth_email_unverified'
        };
    }

    const newUser =
        new Staff({
            email:
                normalizedEmail ||
                undefined,

            password:
                null,

            [providerField]:
                String(
                    providerId
                ),

            authMethods:
                [provider],

            name:
                name ||
                `${provider} User`,

            avatar:
                avatar || '',

            role:
                'student',

            isVerified:
                true,

            isActive:
                true
        });

    try {
        await newUser.save();

        return {
            user:
                newUser
        };
    } catch (error) {
        if (
            error?.code ===
            11000
        ) {
            const existing =
                await Staff.findOne({
                    $or: [
                        {
                            [providerField]:
                                String(
                                    providerId
                                )
                        },

                        ...(normalizedEmail
                            ? [
                                  {
                                      email:
                                          normalizedEmail
                                  }
                              ]
                            : [])
                    ]
                });

            if (
                existing
            ) {
                if (
                    !existing.isActive
                ) {
                    return {
                        error:
                            'account_disabled'
                    };
                }

                return {
                    user:
                        existing
                };
            }
        }

        throw error;
    }
}

async function completeOAuthLogin(
    req,
    res,
    user,
    provider
) {
    if (
        !user ||
        !user.isActive
    ) {
        return redirectToLogin(
            res,
            'account_disabled'
        );
    }

    try {
        const auth =
            await issueAuthentication(
                res,
                user,
                req
            );

        await audit(
            req,
            'OAUTH_LOGIN_SUCCESS',
            {
                userId:
                    user._id,

                email:
                    user.email,

                metadata: {
                    provider,

                    sessionId:
                        auth.sessionId
                }
            }
        );

        return res.redirect(
            `${FRONTEND_URL}/dashboard`
        );
    } catch (error) {
        console.error(
            `[${provider.toUpperCase()}] authentication failed:`,
            error.message
        );

        return redirectToLogin(
            res,
            `${provider}_authentication_failed`
        );
    }
}

/* =========================================================
   GOOGLE
   ========================================================= */

if (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET
) {
    passport.use(
        new GoogleStrategy(
            {
                clientID:
                    process.env
                        .GOOGLE_CLIENT_ID,

                clientSecret:
                    process.env
                        .GOOGLE_CLIENT_SECRET,

                callbackURL:
                    `${BACKEND_URL}/auth/google/callback`
            },

            async (
                accessToken,
                refreshToken,
                profile,
                done
            ) => {
                try {
                    const primaryEmail =
                        profile
                            .emails?.[0];

                    const email =
                        primaryEmail?.value
                            ?.toLowerCase()
                            ?.trim() ||
                        '';

                    const emailVerified =
                        Boolean(
                            primaryEmail?.verified
                        );

                    if (
                        !email ||
                        !emailVerified
                    ) {
                        return done(
                            null,
                            false,
                            {
                                message:
                                    'google_email_unverified'
                            }
                        );
                    }

                    const result =
                        await upsertOAuthUser(
                            {
                                provider:
                                    'google',

                                providerId:
                                    profile.id,

                                email,

                                emailVerified,

                                name:
                                    profile.displayName ||
                                    email.split(
                                        '@'
                                    )[0],

                                avatar:
                                    profile
                                        .photos?.[0]
                                        ?.value ||
                                    ''
                            }
                        );

                    if (
                        result.error
                    ) {
                        return done(
                            null,
                            false,
                            {
                                message:
                                    result.error
                            }
                        );
                    }

                    return done(
                        null,
                        result.user
                    );
                } catch (error) {
                    return done(
                        error,
                        null
                    );
                }
            }
        )
    );
}

app.get(
    '/auth/google',
    oauthLimiter,
    (req, res, next) => {
        if (
            !process.env
                .GOOGLE_CLIENT_ID ||
            !process.env
                .GOOGLE_CLIENT_SECRET
        ) {
            return redirectToLogin(
                res,
                'google_not_configured'
            );
        }

        const state =
            makeOAuthState();

        setOAuthStateCookie(
            res,
            GOOGLE_STATE_COOKIE,
            state
        );

        return passport.authenticate(
            'google',
            {
                scope: [
                    'profile',
                    'email'
                ],

                session:
                    false,

                state
            }
        )(
            req,
            res,
            next
        );
    }
);

app.get(
    '/auth/google/callback',
    (req, res, next) => {
        const valid =
            validateOAuthState(
                req,
                res,
                GOOGLE_STATE_COOKIE,
                req.query.state
            );

        if (!valid) {
            return redirectToLogin(
                res,
                'invalid_google_state'
            );
        }

        return passport.authenticate(
            'google',
            {
                session:
                    false
            },
            async (
                error,
                user,
                info
            ) => {
                if (error) {
                    console.error(
                        '[GOOGLE]',
                        error.message
                    );

                    return redirectToLogin(
                        res,
                        'google_authentication_failed'
                    );
                }

                if (!user) {
                    return redirectToLogin(
                        res,
                        info?.message ||
                            'google_authentication_failed'
                    );
                }

                return completeOAuthLogin(
                    req,
                    res,
                    user,
                    'google'
                );
            }
        )(
            req,
            res,
            next
        );
    }
);

/* =========================================================
   GITHUB
   ========================================================= */

app.get(
    '/auth/github',
    oauthLimiter,
    (req, res) => {
        if (
            !process.env
                .GITHUB_CLIENT_ID ||
            !process.env
                .GITHUB_CLIENT_SECRET
        ) {
            return redirectToLogin(
                res,
                'github_not_configured'
            );
        }

        const state =
            makeOAuthState();

        setOAuthStateCookie(
            res,
            GITHUB_STATE_COOKIE,
            state
        );

        const params =
            new URLSearchParams({
                client_id:
                    process.env
                        .GITHUB_CLIENT_ID,

                redirect_uri:
                    GITHUB_REDIRECT_URI,

                scope:
                    'read:user user:email',

                state,

                allow_signup:
                    'true'
            });

        return res.redirect(
            `https://github.com/login/oauth/authorize?${params.toString()}`
        );
    }
);

app.get(
    '/api/auth/callback/github',
    async (req, res) => {
        try {
            const {
                code,
                state,
                error
            } = req.query;

            if (
                !validateOAuthState(
                    req,
                    res,
                    GITHUB_STATE_COOKIE,
                    state
                )
            ) {
                return redirectToLogin(
                    res,
                    'invalid_github_state'
                );
            }

            if (error) {
                return redirectToLogin(
                    res,
                    'github_provider_error'
                );
            }

            if (!code) {
                return redirectToLogin(
                    res,
                    'missing_github_code'
                );
            }

            const tokenResponse =
                await axios.post(
                    'https://github.com/login/oauth/access_token',

                    {
                        client_id:
                            process.env
                                .GITHUB_CLIENT_ID,

                        client_secret:
                            process.env
                                .GITHUB_CLIENT_SECRET,

                        code:
                            String(
                                code
                            ),

                        redirect_uri:
                            GITHUB_REDIRECT_URI
                    },

                    {
                        headers: {
                            Accept:
                                'application/json',

                            'Content-Type':
                                'application/json',

                            'X-GitHub-Api-Version':
                                '2022-11-28'
                        },

                        timeout:
                            15000
                    }
                );

            const accessToken =
                tokenResponse.data
                    ?.access_token;

            if (!accessToken) {
                return redirectToLogin(
                    res,
                    'github_token_failed'
                );
            }

            const headers = {
                Authorization:
                    `Bearer ${accessToken}`,

                Accept:
                    'application/vnd.github+json',

                'X-GitHub-Api-Version':
                    '2022-11-28'
            };

            const [
                profileResponse,
                emailResponse
            ] =
                await Promise.all([
                    axios.get(
                        'https://api.github.com/user',
                        {
                            headers,
                            timeout:
                                15000
                        }
                    ),

                    axios.get(
                        'https://api.github.com/user/emails',
                        {
                            headers,
                            timeout:
                                15000
                        }
                    )
                ]);

            const profile =
                profileResponse
                    .data || {};

            const emails =
                Array.isArray(
                    emailResponse
                        .data
                )
                    ? emailResponse
                          .data
                    : [];

            const verifiedEmail =
                emails.find(
                    (item) =>
                        item.primary &&
                        item.verified &&
                        item.email
                ) ||
                emails.find(
                    (item) =>
                        item.verified &&
                        item.email
                );

            const email =
                verifiedEmail
                    ?.email
                    ?.toLowerCase()
                    ?.trim() || '';

            if (
                !profile.id ||
                !email
            ) {
                return redirectToLogin(
                    res,
                    'github_email_unverified'
                );
            }

            const result =
                await upsertOAuthUser(
                    {
                        provider:
                            'github',

                        providerId:
                            profile.id,

                        email,

                        emailVerified:
                            true,

                        name:
                            profile.name
                                ?.trim() ||
                            profile.login
                                ?.trim() ||
                            email.split(
                                '@'
                            )[0],

                        avatar:
                            profile.avatar_url ||
                            ''
                    }
                );

            if (
                result.error
            ) {
                return redirectToLogin(
                    res,
                    result.error
                );
            }

            return completeOAuthLogin(
                req,
                res,
                result.user,
                'github'
            );
        } catch (error) {
            console.error(
                '[GITHUB]',
                error.message
            );

            return redirectToLogin(
                res,
                'github_authentication_failed'
            );
        }
    }
);

/* =========================================================
   LINKEDIN
   ========================================================= */

app.get(
    '/auth/linkedin',
    oauthLimiter,
    (req, res) => {
        if (
            !process.env
                .LINKEDIN_CLIENT_ID ||
            !process.env
                .LINKEDIN_CLIENT_SECRET
        ) {
            return redirectToLogin(
                res,
                'linkedin_not_configured'
            );
        }

        const state =
            makeOAuthState();

        setOAuthStateCookie(
            res,
            LINKEDIN_STATE_COOKIE,
            state
        );

        const params =
            new URLSearchParams({
                response_type:
                    'code',

                client_id:
                    process.env
                        .LINKEDIN_CLIENT_ID,

                redirect_uri:
                    LINKEDIN_REDIRECT_URI,

                state,

                scope:
                    'openid profile email'
            });

        return res.redirect(
            `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
        );
    }
);

app.get(
    '/api/auth/callback/linkedin',
    async (req, res) => {
        try {
            const {
                code,
                state,
                error,
                error_description
            } = req.query;

            if (
                !validateOAuthState(
                    req,
                    res,
                    LINKEDIN_STATE_COOKIE,
                    state
                )
            ) {
                return redirectToLogin(
                    res,
                    'invalid_linkedin_state'
                );
            }

            if (error) {
                console.error(
                    '[LINKEDIN]',
                    error,
                    error_description ||
                        ''
                );

                return redirectToLogin(
                    res,
                    'linkedin_provider_error'
                );
            }

            if (!code) {
                return redirectToLogin(
                    res,
                    'missing_linkedin_code'
                );
            }

            const tokenResponse =
                await axios.post(
                    'https://www.linkedin.com/oauth/v2/accessToken',

                    new URLSearchParams({
                        grant_type:
                            'authorization_code',

                        code:
                            String(
                                code
                            ),

                        client_id:
                            process.env
                                .LINKEDIN_CLIENT_ID,

                        client_secret:
                            process.env
                                .LINKEDIN_CLIENT_SECRET,

                        redirect_uri:
                            LINKEDIN_REDIRECT_URI
                    }).toString(),

                    {
                        headers: {
                            'Content-Type':
                                'application/x-www-form-urlencoded'
                        },

                        timeout:
                            15000
                    }
                );

            const accessToken =
                tokenResponse.data
                    ?.access_token;

            if (!accessToken) {
                return redirectToLogin(
                    res,
                    'linkedin_token_failed'
                );
            }

            const profileResponse =
                await axios.get(
                    'https://api.linkedin.com/v2/userinfo',
                    {
                        headers: {
                            Authorization:
                                `Bearer ${accessToken}`,

                            Accept:
                                'application/json'
                        },

                        timeout:
                            15000
                    }
                );

            const profile =
                profileResponse
                    .data || {};

            const email =
                profile.email
                    ?.toLowerCase()
                    ?.trim() || '';

            if (
                !profile.sub ||
                !email ||
                profile.email_verified !==
                    true
            ) {
                return redirectToLogin(
                    res,
                    'linkedin_email_unverified'
                );
            }

            const result =
                await upsertOAuthUser(
                    {
                        provider:
                            'linkedin',

                        providerId:
                            profile.sub,

                        email,

                        emailVerified:
                            true,

                        name:
                            profile.name
                                ?.trim() ||
                            `${
                                profile.given_name ||
                                ''
                            } ${
                                profile.family_name ||
                                ''
                            }`.trim() ||
                            email.split(
                                '@'
                            )[0],

                        avatar:
                            profile.picture ||
                            ''
                    }
                );

            if (
                result.error
            ) {
                return redirectToLogin(
                    res,
                    result.error
                );
            }

            return completeOAuthLogin(
                req,
                res,
                result.user,
                'linkedin'
            );
        } catch (error) {
            console.error(
                '[LINKEDIN]',
                error.message
            );

            return redirectToLogin(
                res,
                'linkedin_authentication_failed'
            );
        }
    }
);

/* =========================================================
   TIKTOK
   ========================================================= */

app.get(
    '/auth/tiktok',
    oauthLimiter,
    (req, res) => {
        if (
            !process.env
                .TIKTOK_CLIENT_KEY ||
            !process.env
                .TIKTOK_CLIENT_SECRET
        ) {
            return redirectToLogin(
                res,
                'tiktok_not_configured'
            );
        }

        const state =
            makeOAuthState();

        setOAuthStateCookie(
            res,
            TIKTOK_STATE_COOKIE,
            state
        );

        const params =
            new URLSearchParams({
                client_key:
                    process.env
                        .TIKTOK_CLIENT_KEY,

                scope:
                    'user.info.basic',

                response_type:
                    'code',

                redirect_uri:
                    TIKTOK_REDIRECT_URI,

                state
            });

        return res.redirect(
            `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`
        );
    }
);

app.get(
    '/auth/tiktok/callback',
    async (req, res) => {
        try {
            const {
                code,
                state,
                error
            } = req.query;

            if (
                !validateOAuthState(
                    req,
                    res,
                    TIKTOK_STATE_COOKIE,
                    state
                )
            ) {
                return redirectToLogin(
                    res,
                    'invalid_tiktok_state'
                );
            }

            if (error) {
                return redirectToLogin(
                    res,
                    'tiktok_provider_error'
                );
            }

            if (!code) {
                return redirectToLogin(
                    res,
                    'missing_tiktok_code'
                );
            }

            const tokenResponse =
                await axios.post(
                    'https://open.tiktokapis.com/v2/oauth/token/',

                    new URLSearchParams({
                        client_key:
                            process.env
                                .TIKTOK_CLIENT_KEY,

                        client_secret:
                            process.env
                                .TIKTOK_CLIENT_SECRET,

                        code:
                            String(
                                code
                            ),

                        grant_type:
                            'authorization_code',

                        redirect_uri:
                            TIKTOK_REDIRECT_URI
                    }).toString(),

                    {
                        headers: {
                            'Content-Type':
                                'application/x-www-form-urlencoded'
                        },

                        timeout:
                            15000
                    }
                );

            const accessToken =
                tokenResponse.data
                    ?.access_token;

            if (!accessToken) {
                return redirectToLogin(
                    res,
                    'tiktok_token_failed'
                );
            }

            const userResponse =
                await axios.get(
                    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name',
                    {
                        headers: {
                            Authorization:
                                `Bearer ${accessToken}`
                        },

                        timeout:
                            15000
                    }
                );

            const tiktokUser =
                userResponse
                    .data
                    ?.data
                    ?.user;

            if (
                !tiktokUser?.open_id
            ) {
                return redirectToLogin(
                    res,
                    'tiktok_profile_invalid'
                );
            }

            const result =
                await upsertOAuthUser(
                    {
                        provider:
                            'tiktok',

                        providerId:
                            tiktokUser.open_id,

                        email:
                            '',

                        emailVerified:
                            false,

                        name:
                            tiktokUser.display_name ||
                            'TikTok User',

                        avatar:
                            tiktokUser.avatar_url ||
                            ''
                    }
                );

            if (
                result.error
            ) {
                return redirectToLogin(
                    res,
                    result.error
                );
            }

            return completeOAuthLogin(
                req,
                res,
                result.user,
                'tiktok'
            );
        } catch (error) {
            console.error(
                '[TIKTOK]',
                error.message
            );

            return redirectToLogin(
                res,
                'tiktok_authentication_failed'
            );
        }
    }
);

/* =========================================================
   AUTH API
   ========================================================= */

app.use(
    '/api/auth',
    authRoutes
);

/* =========================================================
   CURRENT USER COMPATIBILITY ENDPOINT
   ========================================================= */

app.get(
    '/auth/me',
    protect,
    (req, res) => {
        const user =
            req.user;

        return res
            .status(200)
            .json({
                authenticated:
                    true,

                user: {
                    id: String(
                        user._id
                    ),

                    email:
                        user.email ||
                        '',

                    name:
                        user.name ||
                        user.email
                            ?.split(
                                '@'
                            )[0] ||
                        'User',

                    username:
                        user.name ||
                        user.email
                            ?.split(
                                '@'
                            )[0] ||
                        'user',

                    avatar:
                        user.avatar ||
                        '',

                    role:
                        user.role,

                    isVerified:
                        Boolean(
                            user.isVerified
                        ),

                    department:
                        user.department ||
                        'Unassigned'
                }
            });
    }
);

/* =========================================================
   LOGOUT COMPATIBILITY ENDPOINT
   ========================================================= */

app.get(
    '/auth/logout',
    async (req, res) => {
        try {
            const refreshToken =
                req.cookies?.[
                    getCookieNames()
                        .refreshCookieName
                ];

            if (refreshToken) {
                await revokeSessionByRefreshToken(
                    refreshToken
                );
            }

            clearAuthCookies(
                res
            );

            clearResetCookie(
                res
            );

            clearCsrfCookie(
                res
            );

            return res.redirect(
                `${FRONTEND_URL}/login`
            );
        } catch (error) {
            clearAuthCookies(
                res
            );

            clearResetCookie(
                res
            );

            clearCsrfCookie(
                res
            );

            return res.redirect(
                `${FRONTEND_URL}/login`
            );
        }
    }
);

/* =========================================================
   HEALTH
   ========================================================= */

app.get(
    '/',
    (req, res) => {
        res.status(200).json({
            message:
                'EduSphere API is running successfully.',

            status:
                'online'
        });
    }
);

/* =========================================================
   404
   ========================================================= */

app.use(
    (req, res) => {
        res.status(404).json({
            error:
                'Endpoint not found'
        });
    }
);

/* =========================================================
   GLOBAL ERROR HANDLER
   ========================================================= */

app.use(
    (
        err,
        req,
        res,
        next
    ) => {
        if (
            err?.message ===
            'CORS origin not allowed.'
        ) {
            return res
                .status(403)
                .json({
                    message:
                        'Origin not allowed.'
                });
        }

        console.error(
            '[GLOBAL_ERROR]',
            err?.stack ||
                err?.message ||
                err
        );

        if (
            res.headersSent
        ) {
            return next(
                err
            );
        }

        return res
            .status(
                err?.statusCode ||
                    500
            )
            .json({
                error:
                    'Server Error',

                message:
                    IS_PRODUCTION
                        ? 'Something went wrong.'
                        : err.message
            });
    }
);

/* =========================================================
   DATABASE
   ========================================================= */

async function connectDB() {
    mongoose.set(
        'strictQuery',
        true
    );

    mongoose.set(
        'sanitizeFilter',
        true
    );

    const connection =
        await mongoose.connect(
            process.env.MONGO_URI,
            {
                serverSelectionTimeoutMS:
                    10000
            }
        );

    console.log(
        `[Database] MongoDB connected: ${connection.connection.host}`
    );
}

/* =========================================================
   START
   ========================================================= */

async function startServer() {
    await connectDB();

    app.listen(
        PORT,
        () => {
            console.log(
                `[Server] EduSphere API running in ${NODE_ENV} mode on port ${PORT}`
            );

            console.log(
                `[Server] Frontend: ${FRONTEND_URL}`
            );

            console.log(
                `[Server] Backend: ${BACKEND_URL}`
            );
        }
    );
}

if (
    require.main ===
    module
) {
    startServer().catch(
        (error) => {
            console.error(
                `[Startup] ${error.message}`
            );

            process.exit(
                1
            );
        }
    );
}

module.exports =
    app;