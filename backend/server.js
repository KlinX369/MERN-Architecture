/* =========================================================
   EDUSPHERE SERVER
   Express + MongoDB + Passport + Social Authentication
   ========================================================= */

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

/* =========================================================
   PASSPORT / SESSION
   ========================================================= */

const session = require("express-session");
const passport = require("passport");
const GoogleStrategy =
  require("passport-google-oauth20").Strategy;
const FacebookStrategy =
  require("passport-facebook").Strategy;

/* =========================================================
   MODELS / ROUTES
   ========================================================= */

const Staff = require("./models/Staff");
const authRoutes = require("./routes/authRoutes");

/* =========================================================
   APP
   ========================================================= */

const app = express();

/* =========================================================
   ENVIRONMENT
   ========================================================= */

const PORT = process.env.PORT || 5000;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  `http://localhost:${PORT}`;

/*
  Your exact LinkedIn redirect URI.
*/
const LINKEDIN_REDIRECT_URI =
  process.env.LINKEDIN_REDIRECT_URI ||
  `${BACKEND_URL}/api/auth/callback/linkedin`;

/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(cookieParser());

/* =========================================================
   SESSION
   ========================================================= */

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "a_secure_random_string_change_this",

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,

      secure:
        process.env.NODE_ENV === "production",

      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",

      maxAge:
        1000 * 60 * 60 * 24 * 7,
    },
  })
);

/* =========================================================
   PASSPORT
   ========================================================= */

app.use(passport.initialize());

app.use(passport.session());

/* =========================================================
   GOOGLE OAUTH
   ========================================================= */

passport.use(
  new GoogleStrategy(
    {
      clientID:
        process.env.GOOGLE_CLIENT_ID,

      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET,

      callbackURL:
        `${BACKEND_URL}/auth/google/callback`,
    },

    async (
      accessToken,
      refreshToken,
      profile,
      done
    ) => {
      try {
        const email =
          profile.emails?.[0]?.value
            ?.toLowerCase()
            ?.trim();

        /*
          First try the Google account ID.
        */
        let existingStaff =
          await Staff.findOne({
            googleId: profile.id,
          });

        /*
          If the same email already has an account,
          connect Google to that account instead of
          creating a duplicate account.
        */
        if (!existingStaff && email) {
          existingStaff =
            await Staff.findOne({
              email,
            });
        }

        if (existingStaff) {
          /*
            Only add googleId if the schema supports it.
            Mongoose strict schemas will safely ignore
            unknown fields.
          */
          try {
            if (
              !existingStaff.googleId
            ) {
              existingStaff.googleId =
                profile.id;

              await existingStaff.save();
            }
          } catch (error) {
            console.warn(
              "Could not save Google ID:",
              error.message
            );
          }

          return done(
            null,
            existingStaff
          );
        }

        const newStaff =
          await new Staff({
            googleId: profile.id,

            email:
              email || "",

            name:
              profile.displayName ||
              email?.split("@")[0] ||
              "User",

            isVerified: true,
          }).save();

        return done(
          null,
          newStaff
        );
      } catch (error) {
        console.error(
          "Google Authentication Error:",
          error
        );

        return done(
          error,
          null
        );
      }
    }
  )
);

/* =========================================================
   FACEBOOK OAUTH
   ========================================================= */

passport.use(
  new FacebookStrategy(
    {
      clientID:
        process.env.FACEBOOK_APP_ID,

      clientSecret:
        process.env.FACEBOOK_APP_SECRET,

      callbackURL:
        process.env.FACEBOOK_CALLBACK_URL ||
        `${BACKEND_URL}/auth/facebook/callback`,

      profileFields: [
        "id",
        "displayName",
        "emails",
      ],
    },

    async (
      accessToken,
      refreshToken,
      profile,
      done
    ) => {
      try {
        const email =
          profile.emails?.[0]?.value
            ?.toLowerCase()
            ?.trim();

        let existingStaff =
          await Staff.findOne({
            facebookId: profile.id,
          });

        /*
          Prevent duplicate accounts when the
          Facebook email already belongs to a user.
        */
        if (!existingStaff && email) {
          existingStaff =
            await Staff.findOne({
              email,
            });
        }

        if (existingStaff) {
          try {
            if (
              !existingStaff.facebookId
            ) {
              existingStaff.facebookId =
                profile.id;

              await existingStaff.save();
            }
          } catch (error) {
            console.warn(
              "Could not save Facebook ID:",
              error.message
            );
          }

          return done(
            null,
            existingStaff
          );
        }

        const newStaff =
          await new Staff({
            facebookId:
              profile.id,

            email:
              email || "",

            name:
              profile.displayName ||
              email?.split("@")[0] ||
              "User",

            isVerified: true,
          }).save();

        return done(
          null,
          newStaff
        );
      } catch (error) {
        console.error(
          "Facebook Authentication Error:",
          error
        );

        return done(
          error,
          null
        );
      }
    }
  )
);

/* =========================================================
   PASSPORT SESSION SERIALIZATION
   ========================================================= */

passport.serializeUser(
  (user, done) => {
    done(null, user.id);
  }
);

passport.deserializeUser(
  async (id, done) => {
    try {
      const user =
        await Staff.findById(id);

      if (!user) {
        return done(
          null,
          false
        );
      }

      done(
        null,
        user
      );
    } catch (error) {
      done(
        error,
        null
      );
    }
  }
);

/* =========================================================
   LINKEDIN HELPERS
   ========================================================= */

/*
  LinkedIn uses OAuth 2.0 / OpenID Connect.

  We generate a cryptographically secure state value
  instead of using Math.random().
*/

function createOAuthState() {
  return crypto
    .randomBytes(32)
    .toString("hex");
}

/*
  Safely redirect the user to the frontend login page
  when an OAuth operation fails.
*/

function redirectToLogin(
  res,
  reason = ""
) {
  const separator =
    FRONTEND_URL.includes("?")
      ? "&"
      : "?";

  const encodedReason =
    encodeURIComponent(
      reason || "oauth_failed"
    );

  return res.redirect(
    `${FRONTEND_URL}/login${separator}error=${encodedReason}`
  );
}

/* =========================================================
   LINKEDIN LOGIN
   ========================================================= */

/*
  LOGIN URL:

  Frontend:
      /auth/linkedin

  LinkedIn:
      authorization screen

  LinkedIn then returns to:

      /api/auth/callback/linkedin
*/

app.get(
  "/auth/linkedin",
  (req, res) => {
    try {
      if (
        !process.env.LINKEDIN_CLIENT_ID ||
        !process.env.LINKEDIN_CLIENT_SECRET ||
        !process.env.LINKEDIN_REDIRECT_URI
      ) {
        console.error(
          "LinkedIn OAuth credentials are missing."
        );

        return redirectToLogin(
          res,
          "linkedin_not_configured"
        );
      }

      /*
        Generate CSRF protection state.
      */
      const state =
        createOAuthState();

      /*
        Store state in the user's session.
      */
      req.session.linkedinOAuthState =
        state;

      /*
        LinkedIn OpenID Connect scopes.
      */
      const params =
        new URLSearchParams({
          response_type: "code",

          client_id:
            process.env
              .LINKEDIN_CLIENT_ID,

          redirect_uri:
            LINKEDIN_REDIRECT_URI,

          state,

          scope:
            "openid profile email",
        });

      const linkedinAuthorizationURL =
        `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;

      return res.redirect(
        linkedinAuthorizationURL
      );
    } catch (error) {
      console.error(
        "LinkedIn Authorization Error:",
        error
      );

      return redirectToLogin(
        res,
        "linkedin_authorization_failed"
      );
    }
  }
);

/* =========================================================
   LINKEDIN CALLBACK
   ========================================================= */

app.get(
  "/api/auth/callback/linkedin",
  async (req, res) => {
    try {
      const {
        code,
        state,
        error,
        error_description,
      } = req.query;

      /*
        LinkedIn may return an OAuth error.
      */
      if (error) {
        console.error(
          "LinkedIn returned an OAuth error:",
          error,
          error_description || ""
        );

        return redirectToLogin(
          res,
          error
        );
      }

      /*
        Authorization code is required.
      */
      if (!code) {
        console.error(
          "LinkedIn callback did not contain an authorization code."
        );

        return redirectToLogin(
          res,
          "missing_linkedin_code"
        );
      }

      /*
        Validate OAuth state.
        This prevents CSRF attacks.
      */
      const savedState =
        req.session.linkedinOAuthState;

      if (
        !savedState ||
        !state ||
        savedState !== state
      ) {
        console.error(
          "LinkedIn OAuth state validation failed."
        );

        delete req.session
          .linkedinOAuthState;

        return redirectToLogin(
          res,
          "invalid_linkedin_state"
        );
      }

      /*
        State should only be usable once.
      */
      delete req.session
        .linkedinOAuthState;

      /* =====================================================
         EXCHANGE CODE FOR ACCESS TOKEN
         ===================================================== */

      const tokenResponse =
        await axios.post(
          "https://www.linkedin.com/oauth/v2/accessToken",

          new URLSearchParams({
            grant_type:
              "authorization_code",

            code: String(code),

            client_id:
              process.env
                .LINKEDIN_CLIENT_ID,

            client_secret:
              process.env
                .LINKEDIN_CLIENT_SECRET,

            redirect_uri:
              LINKEDIN_REDIRECT_URI,
          }).toString(),

          {
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
            },

            timeout: 15000,
          }
        );

      const accessToken =
        tokenResponse.data
          ?.access_token;

      if (!accessToken) {
        console.error(
          "LinkedIn did not return an access token."
        );

        return redirectToLogin(
          res,
          "linkedin_token_failed"
        );
      }

      /* =====================================================
         GET LINKEDIN OPENID PROFILE
         ===================================================== */

      const profileResponse =
        await axios.get(
          "https://api.linkedin.com/v2/userinfo",
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              /*
                Explicitly request JSON.
              */
              Accept:
                "application/json",
            },

            timeout: 15000,
          }
        );

      const linkedinProfile =
        profileResponse.data || {};

      /*
        LinkedIn OIDC normally provides:

        sub
        email
        email_verified
        name
        given_name
        family_name
        picture
      */

      const linkedinId =
        linkedinProfile.sub;

      const linkedinEmail =
        linkedinProfile.email
          ?.toLowerCase()
          ?.trim();

      const linkedinName =
        linkedinProfile.name ||
        [
          linkedinProfile.given_name,
          linkedinProfile.family_name,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();

      const linkedinPicture =
        linkedinProfile.picture ||
        "";

      /* =====================================================
         VALIDATE LINKEDIN USER
         ===================================================== */

      if (!linkedinId) {
        console.error(
          "LinkedIn profile did not contain a stable user ID."
        );

        return redirectToLogin(
          res,
          "linkedin_profile_invalid"
        );
      }

      if (!linkedinEmail) {
        console.error(
          "LinkedIn did not return an email address."
        );

        return redirectToLogin(
          res,
          "linkedin_email_missing"
        );
      }

      /*
        LinkedIn's verified email should be treated as
        the identity used to connect an existing account.
      */

      /* =====================================================
         FIND EXISTING ACCOUNT
         ===================================================== */

      let existingStaff = null;

      /*
        If your Staff schema already contains linkedinId,
        this lookup will work immediately.

        If it doesn't, Mongoose simply won't have that
        field available, so we also use email below.
      */

      try {
        existingStaff =
          await Staff.findOne({
            linkedinId,
          });
      } catch (error) {
        /*
          This can happen with some unusual schemas/indexes.
          Continue to email lookup.
        */

        console.warn(
          "LinkedIn ID lookup failed; falling back to email:",
          error.message
        );
      }

      /*
        IMPORTANT:

        Matching by verified email allows a user who
        originally registered with email/password,
        Google or Facebook to connect LinkedIn to
        their existing EduSphere account rather than
        accidentally creating a second account.
      */

      if (!existingStaff) {
        existingStaff =
          await Staff.findOne({
            email:
              linkedinEmail,
          });
      }

      /* =====================================================
         UPDATE EXISTING ACCOUNT
         ===================================================== */

      if (existingStaff) {
        /*
          Try to save LinkedIn identity.
          This is useful if your Staff schema has
          linkedinId.
        */

        let changed = false;

        try {
          if (
            "linkedinId" in
              existingStaff.schema.paths
          ) {
            if (
              existingStaff.linkedinId !==
              linkedinId
            ) {
              existingStaff.linkedinId =
                linkedinId;

              changed = true;
            }
          }
        } catch (error) {
          console.warn(
            "LinkedIn ID field could not be updated:",
            error.message
          );
        }

        /*
          Update profile picture if your Staff model
          supports one and the account does not already
          have one.
        */

        try {
          if (
            linkedinPicture &&
            "avatar" in
              existingStaff.schema.paths &&
            !existingStaff.avatar
          ) {
            existingStaff.avatar =
              linkedinPicture;

            changed = true;
          }
        } catch (error) {
          console.warn(
            "Could not update LinkedIn avatar:",
            error.message
          );
        }

        /*
          Mark verified because LinkedIn supplied a
          verified identity/email through OIDC.
        */

        if (
          "isVerified" in
            existingStaff.schema.paths &&
          !existingStaff.isVerified
        ) {
          existingStaff.isVerified =
            true;

          changed = true;
        }

        if (changed) {
          await existingStaff.save();
        }

        /* ===================================================
           CREATE PASSPORT SESSION
           =================================================== */

        return req.login(
          existingStaff,
          (loginError) => {
            if (loginError) {
              console.error(
                "LinkedIn Passport session error:",
                loginError
              );

              return redirectToLogin(
                res,
                "linkedin_session_failed"
              );
            }

            /*
              Session is now established.

              This matches the existing Google/Facebook
              social-login architecture.
            */

            return res.redirect(
              `${FRONTEND_URL}/dashboard`
            );
          }
        );
      }

      /* =====================================================
         CREATE NEW LINKEDIN ACCOUNT
         ===================================================== */

      const newStaffData = {
        email:
          linkedinEmail,

        name:
          linkedinName ||
          linkedinEmail.split("@")[0],

        isVerified: true,
      };

      /*
        Only add linkedinId if the Staff schema contains it.
      */

      try {
        if (
          "linkedinId" in
          Staff.schema.paths
        ) {
          newStaffData.linkedinId =
            linkedinId;
        }
      } catch (error) {
        console.warn(
          "Could not inspect Staff schema:",
          error.message
        );
      }

      /*
        Only add avatar if your schema supports it.
      */

      try {
        if (
          linkedinPicture &&
          "avatar" in
            Staff.schema.paths
        ) {
          newStaffData.avatar =
            linkedinPicture;
        }
      } catch (error) {
        console.warn(
          "Could not inspect avatar field:",
          error.message
        );
      }

      const newStaff =
        await new Staff(
          newStaffData
        ).save();

      console.log(
        `[LinkedIn] Created new EduSphere account for ${linkedinEmail}`
      );

      /* =====================================================
         LOGIN NEW USER
         ===================================================== */

      return req.login(
        newStaff,
        (loginError) => {
          if (loginError) {
            console.error(
              "LinkedIn new-user session error:",
              loginError
            );

            return redirectToLogin(
              res,
              "linkedin_session_failed"
            );
          }

          return res.redirect(
            `${FRONTEND_URL}/dashboard`
          );
        }
      );
    } catch (error) {
      /* =====================================================
         LINKEDIN ERROR HANDLING
         ===================================================== */

      console.error(
        "LinkedIn Authentication Error:"
      );

      if (error.response) {
        console.error(
          "Status:",
          error.response.status
        );

        console.error(
          "LinkedIn response:",
          error.response.data
        );
      } else {
        console.error(
          error.message
        );
      }

      return redirectToLogin(
        res,
        "linkedin_authentication_failed"
      );
    }
  }
);

/* =========================================================
   DATABASE CONNECTION
   ========================================================= */

const connectDB = async () => {
  try {
    const conn =
      await mongoose.connect(
        process.env.MONGO_URI
      );

    console.log(
      `[Database] MongoDB Connected successfully on host: ${conn.connection.host}`
    );
  } catch (error) {
    console.error(
      `[Database] Connection Error: ${error.message}`
    );

    process.exit(1);
  }
};

connectDB();

/* =========================================================
   EXISTING AUTH ROUTES
   ========================================================= */

app.use(
  "/api/auth",
  authRoutes
);

/* =========================================================
   GOOGLE ROUTES
   ========================================================= */

app.get(
  "/auth/google",
  passport.authenticate(
    "google",
    {
      scope: [
        "profile",
        "email",
      ],
    }
  )
);

app.get(
  "/auth/google/callback",

  passport.authenticate(
    "google",
    {
      failureRedirect:
        `${FRONTEND_URL}/login`,
    }
  ),

  (req, res) => {
    res.redirect(
      `${FRONTEND_URL}/dashboard`
    );
  }
);

/* =========================================================
   FACEBOOK ROUTES
   ========================================================= */

app.get(
  "/auth/facebook",
  passport.authenticate(
    "facebook",
    {
      scope: ["email"],
    }
  )
);

app.get(
  "/auth/facebook/callback",

  passport.authenticate(
    "facebook",
    {
      failureRedirect:
        `${FRONTEND_URL}/login`,
    }
  ),

  (req, res) => {
    res.redirect(
      `${FRONTEND_URL}/dashboard`
    );
  }
);

/* =========================================================
   TIKTOK OAUTH
   ========================================================= */

app.get(
  "/auth/tiktok",
  (req, res) => {
    const csrfState =
      crypto
        .randomBytes(16)
        .toString("hex");

    res.cookie(
      "csrfState",
      csrfState,
      {
        maxAge: 60000,

        httpOnly: true,

        sameSite: "lax",

        secure:
          process.env.NODE_ENV ===
          "production",
      }
    );

    const params =
      new URLSearchParams({
        client_key:
          process.env.TIKTOK_CLIENT_KEY,

        scope:
          "user.info.basic",

        response_type:
          "code",

        redirect_uri:
          `${BACKEND_URL}/auth/tiktok/callback`,

        state:
          csrfState,
      });

    const url =
      `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;

    res.redirect(url);
  }
);

/* =========================================================
   TIKTOK CALLBACK
   ========================================================= */

app.get(
  "/auth/tiktok/callback",
  async (req, res) => {
    const {
      code,
      state,
    } = req.query;

    try {
      /*
        Verify TikTok state.
      */

      const savedState =
        req.cookies.csrfState;

      if (
        !state ||
        !savedState ||
        state !== savedState
      ) {
        console.error(
          "TikTok OAuth state validation failed."
        );

        return res.redirect(
          `${FRONTEND_URL}/login?error=tiktok_state`
        );
      }

      res.clearCookie(
        "csrfState"
      );

      if (!code) {
        return res.redirect(
          `${FRONTEND_URL}/login?error=tiktok_code`
        );
      }

      /* =====================================================
         TOKEN
         ===================================================== */

      const tokenResponse =
        await axios.post(
          "https://open.tiktokapis.com/v2/oauth/token/",

          new URLSearchParams({
            client_key:
              process.env.TIKTOK_CLIENT_KEY,

            client_secret:
              process.env.TIKTOK_CLIENT_SECRET,

            code:
              String(code),

            grant_type:
              "authorization_code",

            redirect_uri:
              `${BACKEND_URL}/auth/tiktok/callback`,
          }).toString(),

          {
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
            },
          }
        );

      const accessToken =
        tokenResponse.data
          ?.access_token;

      if (!accessToken) {
        throw new Error(
          "TikTok access token missing"
        );
      }

      /* =====================================================
         PROFILE
         ===================================================== */

      const userResponse =
        await axios.get(
          "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name",

          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );

      const tiktokUser =
        userResponse.data
          ?.data
          ?.user;

      if (!tiktokUser?.open_id) {
        throw new Error(
          "TikTok profile missing open_id"
        );
      }

      /* =====================================================
         FIND ACCOUNT
         ===================================================== */

      let existingStaff =
        await Staff.findOne({
          tiktokId:
            tiktokUser.open_id,
        });

      if (!existingStaff) {
        existingStaff =
          await new Staff({
            tiktokId:
              tiktokUser.open_id,

            name:
              tiktokUser.display_name ||
              "TikTok User",

            isVerified: true,
          }).save();
      }

      /* =====================================================
         PASSPORT SESSION
         ===================================================== */

      req.login(
        existingStaff,
        (err) => {
          if (err) {
            console.error(
              "TikTok Passport Login Error:",
              err
            );

            return res.redirect(
              `${FRONTEND_URL}/login?error=tiktok_session`
            );
          }

          res.redirect(
            `${FRONTEND_URL}/dashboard`
          );
        }
      );
    } catch (error) {
      console.error(
        "TikTok Authentication Error:",
        error
      );

      res.redirect(
        `${FRONTEND_URL}/login?error=tiktok_authentication`
      );
    }
  }
);

/* =========================================================
   CURRENT USER SESSION CHECK
   ========================================================= */

/*
  This is useful for debugging social authentication.

  GET /auth/me

  It tells the frontend whether Passport has an
  authenticated session.
*/

app.get(
  "/auth/me",
  (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        authenticated: false,
        user: null,
      });
    }

    const user =
      req.user;

    return res.json({
      authenticated: true,

      user: {
        id:
          user._id,

        email:
          user.email || "",

        name:
          user.name ||
          user.username ||
          user.email?.split("@")[0] ||
          "User",

        username:
          user.username ||
          user.name ||
          user.email?.split("@")[0] ||
          "user",

        avatar:
          user.avatar ||
          user.profilePicture ||
          user.photoURL ||
          "",

        isVerified:
          Boolean(
            user.isVerified
          ),
      },
    });
  }
);

/* =========================================================
   LOGOUT
   ========================================================= */

app.get(
  "/auth/logout",
  (req, res) => {
    req.logout(
      (logoutError) => {
        if (logoutError) {
          console.error(
            "Logout Error:",
            logoutError
          );
        }

        req.session.destroy(
          (sessionError) => {
            if (sessionError) {
              console.error(
                "Session Destroy Error:",
                sessionError
              );
            }

            res.clearCookie(
              "connect.sid"
            );

            return res.redirect(
              `${FRONTEND_URL}/login`
            );
          }
        );
      }
    );
  }
);

/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get(
  "/",
  (req, res) => {
    res.status(200).json({
      message:
        "EduSphere API is running successfully.",
      status:
        "online",
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
        "Endpoint not found",
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
    console.error(
      err.stack
    );

    res.status(500).json({
      error:
        "Server Error",

      message:
        process.env.NODE_ENV ===
        "development"
          ? err.message
          : "Something went wrong",
    });
  }
);

/* =========================================================
   SERVER
   ========================================================= */

app.listen(
  PORT,
  () => {
    console.log(
      `[Server] EduSphere API running in ${
        process.env.NODE_ENV ||
        "development"
      } mode on port ${PORT}`
    );

    console.log(
      `[Server] Frontend: ${FRONTEND_URL}`
    );

    console.log(
      `[Server] LinkedIn callback: ${LINKEDIN_REDIRECT_URI}`
    );
  }
);