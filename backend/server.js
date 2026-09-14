require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// --- Additional Imports for Social Login ---
const axios = require('axios');
const cookieParser = require('cookie-parser');

// --- Passport and Session Imports ---
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

// Import the updated Staff model
const Staff = require('./models/Staff');

// Import your Staff routes here once created
// const staffRoutes = require('./routes/staffRoutes'); 
const authRoutes = require('./routes/authRoutes');

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Added for TikTok CSRF state token

// --- Session & Passport Middleware ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'a_secure_random_string',
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

// --- Google OAuth 2.0 Strategy Configuration ---
passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`
    },
    async(accessToken, refreshToken, profile, done) => {
        try {
            let existingStaff = await Staff.findOne({ googleId: profile.id });

            if (existingStaff) {
                return done(null, existingStaff);
            } else {
                const newStaff = await new Staff({
                    googleId: profile.id,
                    email: profile.emails[0].value,
                    name: profile.displayName,
                    isVerified: true
                }).save();

                return done(null, newStaff);
            }
        } catch (error) {
            console.error("Error during Google Authentication:", error);
            return done(error, null);
        }
    }
));

// --- Facebook OAuth Strategy Configuration ---
passport.use(new FacebookStrategy({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL,
        profileFields: ['id', 'displayName', 'emails']
    },
    async(accessToken, refreshToken, profile, done) => {
        try {
            let existingStaff = await Staff.findOne({ facebookId: profile.id });

            if (existingStaff) {
                return done(null, existingStaff);
            } else {
                const newStaff = await new Staff({
                    facebookId: profile.id,
                    email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : '',
                    name: profile.displayName,
                    isVerified: true
                }).save();

                return done(null, newStaff);
            }
        } catch (error) {
            console.error("Error during Facebook Authentication:", error);
            return done(error, null);
        }
    }
));

// Serialize user ID into the session
passport.serializeUser((user, done) => done(null, user.id));

// Deserialize user from the database using the ID in the session
passport.deserializeUser(async(id, done) => {
    try {
        const user = await Staff.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// --- Database Connection ---
const connectDB = async() => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`[Database] MongoDB Connected successfully on host: ${conn.connection.host}`);
    } catch (error) {
        console.error(`[Database] Connection Error: ${error.message}`);
        process.exit(1);
    }
};

connectDB();

// --- API Routes ---
// app.use('/api/staff', staffRoutes);
app.use('/api/auth', authRoutes);

// --- Google OAuth Routes ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/login` }),
    (req, res) => {
        res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
    }
);

// --- Facebook OAuth Routes ---
app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: `${process.env.FRONTEND_URL}/login` }),
    (req, res) => {
        res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
    }
);

// --- TikTok OAuth Routes (Manual Implementation via Session) ---
app.get('/auth/tiktok', (req, res) => {
    const csrfState = Math.random().toString(36).substring(7);
    res.cookie('csrfState', csrfState, { maxAge: 60000 });

    const url = `https://www.tiktok.com/v2/auth/authorize/?client_key=${process.env.TIKTOK_CLIENT_KEY}&scope=user.info.basic&response_type=code&redirect_uri=${process.env.BACKEND_URL}/auth/tiktok/callback&state=${csrfState}`;
    res.redirect(url);
});

app.get('/auth/tiktok/callback', async(req, res) => {
    const { code } = req.query;

    try {
        // Exchange authorization code for token
        const tokenResponse = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', {
            client_key: process.env.TIKTOK_CLIENT_KEY,
            client_secret: process.env.TIKTOK_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: `${process.env.BACKEND_URL}/auth/tiktok/callback`
        }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const accessToken = tokenResponse.data.access_token;

        // Fetch User Profile Data
        const userResponse = await axios.get('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const tiktokUser = userResponse.data.data.user;

        // Check if user exists or save to MongoDB
        let existingStaff = await Staff.findOne({ tiktokId: tiktokUser.open_id });

        if (!existingStaff) {
            existingStaff = await new Staff({
                tiktokId: tiktokUser.open_id,
                name: tiktokUser.display_name,
                isVerified: true
            }).save();
        }

        // Establish passport session login manually for TikTok
        req.login(existingStaff, (err) => {
            if (err) throw err;
            res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
        });

    } catch (error) {
        console.error("TikTok Auth Error:", error);
        res.redirect(`${process.env.FRONTEND_URL}/login`);
    }
});

// Basic health check route
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Arel Software System API is running...' });
});

// Catch-all route
app.use((req, res, next) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// --- Server Initialization ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`[Server] Running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});