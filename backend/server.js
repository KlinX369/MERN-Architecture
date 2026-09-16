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

const session = require("express-session");
const passport = require("passport");
const GoogleStrategy =
  require("passport-google-oauth20").Strategy;

const Staff = require("./models/Staff");
const authRoutes = require("./routes/authRoutes");

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

const LINKEDIN_REDIRECT_URI =
  process.env.LINKEDIN_REDIRECT_URI ||
  `${BACKEND_URL}/api/auth/callback/linkedin`;

const GITHUB_REDIRECT_URI =
  process.env.GITHUB_REDIRECT_URI ||
  `${BACKEND_URL}/api/auth/callback/github`;

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

        let existingStaff =
          await Staff.findOne({
            googleId: profile.id,
          });

        if (!existingStaff && email) {
          existingStaff =
            await Staff.findOne({
              email,
            });
        }

        if (existingStaff) {
          try {
            if (
              "googleId" in
                existingStaff.schema.paths &&
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
   OAUTH HELPERS
   ========================================================= */

function createOAuthState() {
  return crypto
    .randomBytes(32)
    .toString("hex");
}

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

      const state =
        createOAuthState();

      req.session.linkedinOAuthState =
        state;

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

      return res.redirect(
        `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
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

      if (error) {
        console.error(
          "LinkedIn returned an OAuth error:",
          error,
          error_description || ""
        );

        delete req.session
          .linkedinOAuthState;

        return redirectToLogin(
          res,
          String(error)
        );
      }

      if (!code) {
        return redirectToLogin(
          res,
          "missing_linkedin_code"
        );
      }

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

      delete req.session
        .linkedinOAuthState;

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
        return redirectToLogin(
          res,
          "linkedin_token_failed"
        );
      }

      const profileResponse =
        await axios.get(
          "https://api.linkedin.com/v2/userinfo",
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              Accept:
                "application/json",
            },

            timeout: 15000,
          }
        );

      const linkedinProfile =
        profileResponse.data || {};

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

      if (!linkedinId) {
        return redirectToLogin(
          res,
          "linkedin_profile_invalid"
        );
      }

      if (!linkedinEmail) {
        return redirectToLogin(
          res,
          "linkedin_email_missing"
        );
      }

      let existingStaff = null;

      try {
        existingStaff =
          await Staff.findOne({
            linkedinId,
          });
      } catch (error) {
        console.warn(
          "LinkedIn ID lookup failed; falling back to email:",
          error.message
        );
      }

      if (!existingStaff) {
        existingStaff =
          await Staff.findOne({
            email:
              linkedinEmail,
          });
      }

      if (existingStaff) {
        let changed = false;

        if (
          "linkedinId" in
            existingStaff.schema.paths &&
          existingStaff.linkedinId !==
            linkedinId
        ) {
          existingStaff.linkedinId =
            linkedinId;

          changed = true;
        }

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

            return res.redirect(
              `${FRONTEND_URL}/dashboard`
            );
          }
        );
      }

      const newStaffData = {
        email:
          linkedinEmail,

        name:
          linkedinName ||
          linkedinEmail.split("@")[0],

        isVerified: true,
      };

      if (
        "linkedinId" in
        Staff.schema.paths
      ) {
        newStaffData.linkedinId =
          linkedinId;
      }

      if (
        linkedinPicture &&
        "avatar" in
          Staff.schema.paths
      ) {
        newStaffData.avatar =
          linkedinPicture;
      }

      const newStaff =
        await new Staff(
          newStaffData
        ).save();

      console.log(
        `[LinkedIn] Created new EduSphere account for ${linkedinEmail}`
      );

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
      console.error(
        "LinkedIn Authentication Error:",
        error
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
      }

      return redirectToLogin(
        res,
        "linkedin_authentication_failed"
      );
    }
  }
);

/* =========================================================
   GITHUB OAUTH
   ========================================================= */

app.get(
  "/auth/github",
  (req, res) => {
    try {
      if (
        !process.env.GITHUB_CLIENT_ID ||
        !process.env.GITHUB_CLIENT_SECRET ||
        !GITHUB_REDIRECT_URI
      ) {
        console.error(
          "GitHub OAuth credentials are missing."
        );

        return redirectToLogin(
          res,
          "github_not_configured"
        );
      }

      const state =
        createOAuthState();

      req.session.githubOAuthState =
        state;

      const params =
        new URLSearchParams({
          client_id:
            process.env.GITHUB_CLIENT_ID,

          redirect_uri:
            GITHUB_REDIRECT_URI,

          scope:
            "read:user user:email",

          state,

          allow_signup:
            "true",
        });

      return res.redirect(
        `https://github.com/login/oauth/authorize?${params.toString()}`
      );
    } catch (error) {
      console.error(
        "GitHub Authorization Error:",
        error
      );

      return redirectToLogin(
        res,
        "github_authorization_failed"
      );
    }
  }
);

/* =========================================================
   GITHUB CALLBACK
   ========================================================= */

app.get(
  "/api/auth/callback/github",
  async (req, res) => {
    try {
      const {
        code,
        state,
        error,
        error_description,
      } = req.query;

      if (error) {
        console.error(
          "GitHub returned an OAuth error:",
          error,
          error_description || ""
        );

        delete req.session
          .githubOAuthState;

        return redirectToLogin(
          res,
          String(error)
        );
      }

      if (!code) {
        return redirectToLogin(
          res,
          "missing_github_code"
        );
      }

      const savedState =
        req.session.githubOAuthState;

      if (
        !savedState ||
        !state ||
        savedState !== state
      ) {
        console.error(
          "GitHub OAuth state validation failed."
        );

        delete req.session
          .githubOAuthState;

        return redirectToLogin(
          res,
          "invalid_github_state"
        );
      }

      delete req.session
        .githubOAuthState;

      /* =====================================================
         EXCHANGE CODE FOR ACCESS TOKEN
         ===================================================== */

      const tokenResponse =
        await axios.post(
          "https://github.com/login/oauth/access_token",

          {
            client_id:
              process.env.GITHUB_CLIENT_ID,

            client_secret:
              process.env.GITHUB_CLIENT_SECRET,

            code: String(code),

            redirect_uri:
              GITHUB_REDIRECT_URI,
          },

          {
            headers: {
              Accept:
                "application/json",

              "Content-Type":
                "application/json",

              "X-GitHub-Api-Version":
                "2022-11-28",
            },

            timeout: 15000,
          }
        );

      const accessToken =
        tokenResponse.data
          ?.access_token;

      if (!accessToken) {
        console.error(
          "GitHub did not return an access token:",
          tokenResponse.data
        );

        return redirectToLogin(
          res,
          "github_token_failed"
        );
      }

      const githubHeaders = {
        Authorization:
          `Bearer ${accessToken}`,

        Accept:
          "application/vnd.github+json",

        "X-GitHub-Api-Version":
          "2022-11-28",
      };

      /* =====================================================
         GET GITHUB PROFILE
         ===================================================== */

      const profileResponse =
        await axios.get(
          "https://api.github.com/user",
          {
            headers:
              githubHeaders,

            timeout: 15000,
          }
        );

      const githubProfile =
        profileResponse.data || {};

      const githubId =
        githubProfile.id
          ? String(
              githubProfile.id
            )
          : "";

      if (!githubId) {
        return redirectToLogin(
          res,
          "github_profile_invalid"
        );
      }

      /* =====================================================
         GET GITHUB EMAILS
         ===================================================== */

      const emailResponse =
        await axios.get(
          "https://api.github.com/user/emails",
          {
            headers:
              githubHeaders,

            timeout: 15000,
          }
        );

      const emails =
        Array.isArray(
          emailResponse.data
        )
          ? emailResponse.data
          : [];

      const verifiedEmail =
        emails.find(
          (item) =>
            item.primary &&
            item.verified &&
            item.email
        )?.email ||

        emails.find(
          (item) =>
            item.verified &&
            item.email
        )?.email ||

        "";

      const githubEmail =
        verifiedEmail
          .toLowerCase()
          .trim();

      if (!githubEmail) {
        console.error(
          "GitHub did not return a verified email address."
        );

        return redirectToLogin(
          res,
          "github_email_missing"
        );
      }

      const githubName =
        githubProfile.name
          ?.trim() ||

        githubProfile.login
          ?.trim() ||

        githubEmail.split("@")[0] ||

        "GitHub User";

      /* =====================================================
         FIND EXISTING ACCOUNT
         ===================================================== */

      let existingStaff =
        await Staff.findOne({
          githubId,
        });

      if (!existingStaff) {
        existingStaff =
          await Staff.findOne({
            email:
              githubEmail,
          });
      }

      /* =====================================================
         UPDATE EXISTING ACCOUNT
         ===================================================== */

      if (existingStaff) {
        let changed = false;

        if (
          "githubId" in
            existingStaff.schema.paths &&
          existingStaff.githubId !==
            githubId
        ) {
          existingStaff.githubId =
            githubId;

          changed = true;
        }

        if (
          "isVerified" in
            existingStaff.schema.paths &&
          !existingStaff.isVerified
        ) {
          existingStaff.isVerified =
            true;

          changed = true;
        }

        if (
          "name" in
            existingStaff.schema.paths &&
          !existingStaff.name
        ) {
          existingStaff.name =
            githubName;

          changed = true;
        }

        if (
          githubProfile.avatar_url &&
          "avatar" in
            existingStaff.schema.paths &&
          !existingStaff.avatar
        ) {
          existingStaff.avatar =
            githubProfile.avatar_url;

          changed = true;
        }

        if (changed) {
          await existingStaff.save();
        }

        return req.login(
          existingStaff,
          (loginError) => {
            if (loginError) {
              console.error(
                "GitHub Passport session error:",
                loginError
              );

              return redirectToLogin(
                res,
                "github_session_failed"
              );
            }

            return res.redirect(
              `${FRONTEND_URL}/dashboard`
            );
          }
        );
      }

      /* =====================================================
         CREATE NEW GITHUB ACCOUNT
         ===================================================== */

      const newStaffData = {
        githubId,

        email:
          githubEmail,

        name:
          githubName,

        isVerified: true,
      };

      if (
        githubProfile.avatar_url &&
        "avatar" in
          Staff.schema.paths
      ) {
        newStaffData.avatar =
          githubProfile.avatar_url;
      }

      const newStaff =
        await new Staff(
          newStaffData
        ).save();

      console.log(
        `[GitHub] Created new EduSphere account for ${githubEmail}`
      );

      return req.login(
        newStaff,
        (loginError) => {
          if (loginError) {
            console.error(
              "GitHub new-user session error:",
              loginError
            );

            return redirectToLogin(
              res,
              "github_session_failed"
            );
          }

          return res.redirect(
            `${FRONTEND_URL}/dashboard`
          );
        }
      );
    } catch (error) {
      console.error(
        "GitHub Authentication Error:",
        error
      );

      if (error.response) {
        console.error(
          "GitHub status:",
          error.response.status
        );

        console.error(
          "GitHub response:",
          error.response.data
        );
      }

      return redirectToLogin(
        res,
        "github_authentication_failed"
      );
    }
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
          process.env
            .TIKTOK_CLIENT_KEY,

        scope:
          "user.info.basic",

        response_type:
          "code",

        redirect_uri:
          `${BACKEND_URL}/auth/tiktok/callback`,

        state:
          csrfState,
      });

    res.redirect(
      `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`
    );
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

      const tokenResponse =
        await axios.post(
          "https://open.tiktokapis.com/v2/oauth/token/",

          new URLSearchParams({
            client_key:
              process.env
                .TIKTOK_CLIENT_KEY,

            client_secret:
              process.env
                .TIKTOK_CLIENT_SECRET,

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
   CURRENT USER SESSION CHECK
   ========================================================= */

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
   DATABASE CONNECTION
   ========================================================= */

const connectDB =
  async () => {
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

    console.log(
      `[Server] GitHub callback: ${GITHUB_REDIRECT_URI}`
    );
  }
);