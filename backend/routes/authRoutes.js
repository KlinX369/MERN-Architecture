// routes/authRoutes.js

const express = require('express');
const router = express.Router();

const Staff = require('../models/Staff');

const {
    registerStaff,
    loginStaff,
    verifyOTP,
    forgotPassword,
    verifyResetOTP,
    resetPassword
} = require('../controllers/authController');

const {
    protect,
    authorize
} = require('../middleware/authMiddleware');


// =========================================================
// PUBLIC AUTHENTICATION ROUTES
// =========================================================

router.post(
    '/register',
    registerStaff
);

router.post(
    '/login',
    loginStaff
);

router.post(
    '/verify-otp',
    verifyOTP
);


// =========================================================
// PASSWORD RESET FLOW
// =========================================================

router.post(
    '/forgot-password',
    forgotPassword
);

router.post(
    '/verify-reset-otp',
    verifyResetOTP
);

router.post(
    '/reset-password',
    resetPassword
);


// =========================================================
// LOGOUT
// =========================================================

router.post(
    '/logout',
    (req, res) => {

        if (req.session) {
            req.session.destroy(() => {

                res.clearCookie(
                    'connect.sid'
                );

                return res.status(200).json({
                    message:
                        'Successfully logged out'
                });
            });

        } else {

            res.clearCookie(
                'connect.sid'
            );

            return res.status(200).json({
                message:
                    'Logged out successfully'
            });
        }
    }
);


// =========================================================
// ADMIN ONLY
// =========================================================

router.get(
    '/admin/users',
    protect,
    authorize('admin'),

    async (req, res) => {
        try {

            const users =
                await Staff.find()
                    .select(
                        '-password ' +
                        '-otpHash ' +
                        '-otpExpiry ' +
                        '-resetPasswordToken ' +
                        '-resetPasswordExpire'
                    );

            return res.status(200).json(
                users
            );

        } catch (error) {

            console.error(
                'Failed to fetch users:',
                error
            );

            return res.status(500).json({
                message:
                    'Failed to fetch users'
            });
        }
    }
);


// =========================================================
// COURSE MANAGEMENT
// INSTRUCTOR + TUTOR + ADMIN
// =========================================================

router.get(
    '/courses/manage',
    protect,
    authorize(
        'instructor',
        'tutor',
        'admin'
    ),

    (req, res) => {

        return res.status(200).json({
            message:
                'Course management access granted',
            role:
                req.user.role
        });
    }
);


// =========================================================
// STUDENT PROFILE / GENERAL PROFILE
// ALL AUTHENTICATED EDU-SPHERE ROLES
// =========================================================

router.get(
    '/student/profile',
    protect,
    authorize(
        'student',
        'tutor',
        'instructor',
        'admin'
    ),

    (req, res) => {

        return res.status(200).json({
            message:
                `Access granted for ${req.user.role}`,
            user:
                req.user
        });
    }
);


module.exports = router;