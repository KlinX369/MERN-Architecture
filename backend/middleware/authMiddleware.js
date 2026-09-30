// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');


// =========================================================
// JWT AUTHENTICATION
// =========================================================

exports.protect = async (
    req,
    res,
    next
) => {

    let token;

    const authHeader =
        req.header('Authorization') ||
        req.headers.authorization;

    if (
        authHeader &&
        authHeader.startsWith('Bearer ')
    ) {
        token =
            authHeader.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({
            message:
                'Not authorized, no token provided'
        });
    }

    try {

        if (!process.env.JWT_SECRET) {
            throw new Error(
                'JWT_SECRET is not configured'
            );
        }

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        if (!decoded.id) {
            return res.status(401).json({
                message:
                    'Invalid authentication token'
            });
        }

        /*
         * Fetch current user without password.
         */
        const currentUser =
            await Staff.findById(
                decoded.id
            ).select('-password');

        if (!currentUser) {
            return res.status(401).json({
                message:
                    'User belonging to this token no longer exists'
            });
        }

        if (!currentUser.isActive) {
            return res.status(403).json({
                message:
                    'This account has been deactivated'
            });
        }

        /*
         * Password reset invalidates JWTs issued before
         * passwordChangedAt.
         */
        if (
            currentUser.passwordChangedAt &&
            decoded.iat
        ) {

            const passwordChangedAt =
                new Date(
                    currentUser.passwordChangedAt
                ).getTime();

            const tokenIssuedAt =
                decoded.iat * 1000;

            if (
                tokenIssuedAt <
                passwordChangedAt
            ) {
                return res.status(401).json({
                    message:
                        'Authentication session expired. Please log in again.'
                });
            }
        }

        req.user =
            currentUser;

        next();

    } catch (error) {

        console.error(
            'Authentication middleware error:',
            error.message
        );

        return res.status(401).json({
            message:
                'Token is invalid or expired'
        });
    }
};


// =========================================================
// ROLE-BASED AUTHORIZATION
// =========================================================

exports.authorize = (
    ...allowedRoles
) => {

    return (
        req,
        res,
        next
    ) => {

        if (
            !req.user ||
            !allowedRoles.includes(
                req.user.role
            )
        ) {

            return res.status(403).json({
                message:
                    `Forbidden: Role '${req.user ? req.user.role : 'Guest'}' lacks access permission`
            });
        }

        next();
    };
};