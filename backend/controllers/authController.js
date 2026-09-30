// controllers/authController.js

const Staff = require('../models/Staff');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendOTPEmail = require('../utils/sendEmail');


// =========================================================
// CONFIGURATION
// =========================================================

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const MAX_OTP_ATTEMPTS = 5;
const MIN_PASSWORD_LENGTH = 8;


// =========================================================
// HELPER FUNCTIONS
// =========================================================

// Normalize email consistently
const normalizeEmail = (email) => {
    return String(email || '')
        .trim()
        .toLowerCase();
};


// Generate a secure six-digit OTP
const generateOTP = () => {
    return crypto
        .randomInt(100000, 1000000)
        .toString();
};


// Hash OTP before storing it in MongoDB
const hashOTP = (otp) => {
    return crypto
        .createHash('sha256')
        .update(String(otp))
        .digest('hex');
};


// Hash password reset token before storing it
const hashResetToken = (token) => {
    return crypto
        .createHash('sha256')
        .update(String(token))
        .digest('hex');
};


// JWT secret
const getJWTSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error(
            'JWT_SECRET is not configured'
        );
    }

    return process.env.JWT_SECRET;
};


// =========================================================
// PASSWORD VALIDATION
// =========================================================

const validatePassword = (password) => {

    if (typeof password !== 'string') {
        return {
            valid: false,
            message: 'Password is required.'
        };
    }


    if (
        password.length <
        MIN_PASSWORD_LENGTH
    ) {
        return {
            valid: false,
            message:
                'Password must be at least 8 characters long.'
        };
    }


    if (!/[A-Z]/.test(password)) {
        return {
            valid: false,
            message:
                'Password must contain at least one uppercase letter.'
        };
    }


    if (!/[a-z]/.test(password)) {
        return {
            valid: false,
            message:
                'Password must contain at least one lowercase letter.'
        };
    }


    if (!/[0-9]/.test(password)) {
        return {
            valid: false,
            message:
                'Password must contain at least one number.'
        };
    }


    if (!/[^A-Za-z0-9]/.test(password)) {
        return {
            valid: false,
            message:
                'Password must contain at least one special character.'
        };
    }


    return {
        valid: true,
        message: ''
    };
};


// =========================================================
// SAFE USER OBJECT
// =========================================================

const buildSafeUser = (staff) => {

    return {
        id: staff._id,

        email: staff.email,

        name: staff.name,

        department:
            staff.department,

        role:
            staff.role,

        isVerified:
            staff.isVerified,

        isActive:
            staff.isActive,

        avatar:
            staff.avatar || null
    };
};


// =========================================================
// SECURITY AUDIT
// =========================================================

const securityAudit = ({
    event,
    req,
    staff = null,
    success,
    metadata = {}
}) => {

    console.log(
        '[SECURITY_AUDIT]',
        JSON.stringify({
            event,

            userId: staff
                ? staff._id.toString()
                : null,

            ip:
                req?.ip || 'unknown',

            timestamp:
                new Date().toISOString(),

            success,

            metadata
        })
    );
};


// =========================================================
// ISSUE OTP
// =========================================================

const issueOTP = async (
    staff,
    purpose
) => {

    const otp =
        generateOTP();


    // Store only the OTP hash
    staff.otpHash =
        hashOTP(otp);


    // OTP expires in 10 minutes
    staff.otpExpiry =
        new Date(
            Date.now() +
            OTP_EXPIRY_MS
        );


    // Identify what the OTP is for
    staff.otpPurpose =
        purpose;


    // Reset attempt counter
    staff.otpAttempts =
        0;


    // Track when it was sent
    staff.otpLastSentAt =
        new Date();


    // Remove any legacy plaintext OTP field
    if ('otp' in staff) {
        staff.otp = undefined;
    }


    await staff.save();


    // Send actual OTP through email utility
    if (
        process.env.NODE_ENV !==
        'test'
    ) {

        await sendOTPEmail(
            staff.email,
            otp,
            purpose
        );
    }


    return otp;
};


// =========================================================
// VERIFY OTP FOR SPECIFIC PURPOSE
// =========================================================

const verifyOTPForPurpose = async (
    staff,
    submittedOTP,
    expectedPurpose
) => {

    // -------------------------------------------------------
    // USER DOES NOT EXIST
    // -------------------------------------------------------

    if (!staff) {

        return {
            valid: false,
            error:
                'Invalid or expired OTP'
        };
    }


    // -------------------------------------------------------
    // NO ACTIVE OTP
    // -------------------------------------------------------

    if (!staff.otpHash) {

        return {
            valid: false,
            error:
                'Invalid or expired OTP'
        };
    }


    // -------------------------------------------------------
    // OTP PURPOSE MUST MATCH
    // -------------------------------------------------------

    if (
        staff.otpPurpose !==
        expectedPurpose
    ) {

        return {
            valid: false,
            error:
                'Invalid or expired OTP'
        };
    }


    // -------------------------------------------------------
    // CHECK EXPIRY
    // -------------------------------------------------------

    if (
        !staff.otpExpiry ||
        new Date(
            staff.otpExpiry
        ).getTime() <= Date.now()
    ) {

        staff.otpHash = null;
        staff.otpExpiry = null;
        staff.otpPurpose = null;
        staff.otpAttempts = 0;
        staff.otpLastSentAt = null;

        await staff.save();

        return {
            valid: false,
            error:
                'OTP has expired'
        };
    }


    // -------------------------------------------------------
    // CHECK MAXIMUM ATTEMPTS
    // -------------------------------------------------------

    const currentAttempts =
        Number(
            staff.otpAttempts || 0
        );


    if (
        currentAttempts >=
        MAX_OTP_ATTEMPTS
    ) {

        staff.otpHash = null;
        staff.otpExpiry = null;
        staff.otpPurpose = null;
        staff.otpAttempts = 0;
        staff.otpLastSentAt = null;

        await staff.save();

        return {
            valid: false,
            error:
                'Too many invalid OTP attempts. Please request a new code.'
        };
    }


    // -------------------------------------------------------
    // HASH SUBMITTED OTP
    // -------------------------------------------------------

    const submittedHash =
        hashOTP(
            submittedOTP
        );


    // -------------------------------------------------------
    // COMPARE
    // -------------------------------------------------------

    if (
        submittedHash !==
        staff.otpHash
    ) {

        const newAttemptCount =
            currentAttempts + 1;

        staff.otpAttempts =
            newAttemptCount;


        // Maximum attempts reached
        if (
            newAttemptCount >=
            MAX_OTP_ATTEMPTS
        ) {

            staff.otpHash = null;
            staff.otpExpiry = null;
            staff.otpPurpose = null;
            staff.otpAttempts = 0;
            staff.otpLastSentAt = null;

            await staff.save();

            return {
                valid: false,
                error:
                    'Too many invalid OTP attempts. Please request a new code.'
            };
        }


        await staff.save();


        const attemptsRemaining =
            MAX_OTP_ATTEMPTS -
            newAttemptCount;


        return {
            valid: false,

            error:
                `Invalid OTP. ${attemptsRemaining} attempt(s) remaining.`
        };
    }


    // =====================================================
    // OTP SUCCESS
    // =====================================================

    // Consume OTP immediately.
    // It cannot be reused.

    staff.otpHash = null;

    staff.otpExpiry = null;

    staff.otpPurpose = null;

    staff.otpAttempts = 0;

    staff.otpLastSentAt = null;


    await staff.save();


    return {
        valid: true,
        error: null
    };
};


// =========================================================
// REGISTER
// =========================================================

exports.registerStaff = async (
    req,
    res
) => {

    try {

        const email =
            normalizeEmail(
                req.body.email
            );

        const password =
            String(
                req.body.password || ''
            );

        const name =
            String(
                req.body.name ||
                'New User'
            ).trim();


        // -----------------------------------------------------
        // VALIDATION
        // -----------------------------------------------------

        if (
            !email ||
            !password
        ) {

            return res.status(400).json({
                message:
                    'Email and password are required.'
            });
        }


        const passwordCheck =
            validatePassword(
                password
            );


        if (!passwordCheck.valid) {

            return res.status(400).json({
                message:
                    passwordCheck.message
            });
        }


        // -----------------------------------------------------
        // DUPLICATE ACCOUNT CHECK
        // -----------------------------------------------------

        const existingStaff =
            await Staff.findOne({
                email
            });


        if (existingStaff) {

            return res.status(400).json({
                message:
                    'User already exists.'
            });
        }


        // -----------------------------------------------------
        // HASH PASSWORD
        // -----------------------------------------------------

        const passwordHash =
            await bcrypt.hash(
                password,
                12
            );


        // -----------------------------------------------------
        // PUBLIC REGISTRATION
        // -----------------------------------------------------
        //
        // Publicly created accounts are students.
        // Elevated roles should be assigned through
        // authorized administration functionality.
        // -----------------------------------------------------

        const newStaff =
            new Staff({
                email,

                password:
                    passwordHash,

                name,

                department:
                    'Data Annotation',

                role:
                    'student',

                isVerified:
                    false,

                isActive:
                    true
            });


        await newStaff.save();


        // -----------------------------------------------------
        // SEND REGISTRATION OTP
        // -----------------------------------------------------

        await issueOTP(
            newStaff,
            'authentication'
        );


        securityAudit({
            event:
                'REGISTRATION_OTP_REQUESTED',

            req,

            staff:
                newStaff,

            success:
                true,

            metadata: {
                role:
                    newStaff.role
            }
        });


        return res.status(201).json({

            message:
                'Registration successful. Please verify your OTP.',

            requiresOTP:
                true,

            email:
                newStaff.email
        });


    } catch (error) {

        console.error(
            'Error in registerStaff:',
            error
        );


        return res.status(500).json({
            message:
                'Server error during registration.'
        });
    }
};


// =========================================================
// LOGIN
// =========================================================

exports.loginStaff = async (
    req,
    res
) => {

    try {

        const email =
            normalizeEmail(
                req.body.email
            );

        const password =
            String(
                req.body.password || ''
            );


        // -----------------------------------------------------
        // VALIDATION
        // -----------------------------------------------------

        if (
            !email ||
            !password
        ) {

            return res.status(400).json({
                message:
                    'Email and password are required.'
            });
        }


        // -----------------------------------------------------
        // FIND ACCOUNT
        // -----------------------------------------------------
        //
        // password is select:false in Staff.js,
        // so explicitly include it.
        // -----------------------------------------------------

        const staff =
            await Staff.findOne({
                email
            }).select(
                '+password'
            );


        if (!staff) {

            return res.status(401).json({
                message:
                    'Invalid credentials.'
            });
        }


        // -----------------------------------------------------
        // ACCOUNT STATUS
        // -----------------------------------------------------

        if (!staff.isActive) {

            return res.status(403).json({
                message:
                    'This account has been deactivated. Contact an administrator.'
            });
        }


        // -----------------------------------------------------
        // OAUTH-ONLY ACCOUNT
        // -----------------------------------------------------

        if (!staff.password) {

            return res.status(401).json({
                message:
                    'This account does not have a local password. Please use the social login method associated with your account.'
            });
        }


        // -----------------------------------------------------
        // PASSWORD CHECK
        // -----------------------------------------------------

        const passwordMatches =
            await bcrypt.compare(
                password,
                staff.password
            );


        if (!passwordMatches) {

            return res.status(401).json({
                message:
                    'Invalid credentials.'
            });
        }


        // -----------------------------------------------------
        // SEND LOGIN OTP
        // -----------------------------------------------------

        await issueOTP(
            staff,
            'authentication'
        );


        securityAudit({
            event:
                'LOGIN_OTP_REQUESTED',

            req,

            staff,

            success:
                true,

            metadata: {
                role:
                    staff.role
            }
        });


        return res.status(200).json({

            message:
                'Credentials valid. OTP sent to email.',

            requiresOTP:
                true,

            email:
                staff.email
        });


    } catch (error) {

        console.error(
            'Error in loginStaff:',
            error
        );


        return res.status(500).json({
            message:
                'Server error during login.'
        });
    }
};


// =========================================================
// VERIFY NORMAL AUTHENTICATION OTP
// =========================================================

exports.verifyOTP = async (
    req,
    res
) => {

    try {

        const email =
            normalizeEmail(
                req.body.email
            );

        const otp =
            String(
                req.body.otp || ''
            ).trim();


        // -----------------------------------------------------
        // VALIDATION
        // -----------------------------------------------------

        if (!email) {

            return res.status(400).json({
                error:
                    'Email is required.'
            });
        }


        if (!/^\d{6}$/.test(otp)) {

            return res.status(400).json({
                error:
                    'Invalid OTP format.'
            });
        }


        // -----------------------------------------------------
        // FIND ACCOUNT
        // -----------------------------------------------------

        const staff =
            await Staff.findOne({
                email
            }).select(
                '+otpHash'
            );


        // -----------------------------------------------------
        // VERIFY OTP
        // -----------------------------------------------------

        const verification =
            await verifyOTPForPurpose(
                staff,
                otp,
                'authentication'
            );


        if (!verification.valid) {

            if (staff) {

                securityAudit({
                    event:
                        'AUTHENTICATION_OTP_FAILED',

                    req,

                    staff,

                    success:
                        false,

                    metadata: {
                        reason:
                            verification.error
                    }
                });
            }


            return res.status(400).json({
                error:
                    verification.error
            });
        }


        // -----------------------------------------------------
        // ACCOUNT STATUS
        // -----------------------------------------------------

        if (!staff.isActive) {

            return res.status(403).json({
                error:
                    'This account has been deactivated.'
            });
        }


        // -----------------------------------------------------
        // VERIFY ACCOUNT
        // -----------------------------------------------------

        staff.isVerified =
            true;


        await staff.save();


        // -----------------------------------------------------
        // SESSION COMPATIBILITY
        // -----------------------------------------------------

        if (req.session) {

            req.session.userId =
                staff._id.toString();
        }


        // -----------------------------------------------------
        // CREATE JWT
        // -----------------------------------------------------

        const token =
            jwt.sign(
                {
                    id:
                        staff._id.toString(),

                    role:
                        staff.role
                },

                getJWTSecret(),

                {
                    expiresIn:
                        '1d'
                }
            );


        // -----------------------------------------------------
        // AUDIT
        // -----------------------------------------------------

        securityAudit({
            event:
                'AUTHENTICATION_COMPLETED',

            req,

            staff,

            success:
                true,

            metadata: {
                role:
                    staff.role
            }
        });


        // -----------------------------------------------------
        // RESPONSE
        // -----------------------------------------------------

        return res.status(200).json({

            message:
                'Authentication successful',

            token,

            user:
                buildSafeUser(
                    staff
                )
        });


    } catch (error) {

        console.error(
            'Error in verifyOTP:',
            error
        );


        return res.status(500).json({
            error:
                'Server error during verification.'
        });
    }
};


// =========================================================
// FORGOT PASSWORD
// =========================================================

exports.forgotPassword = async (
    req,
    res
) => {

    try {

        const email =
            normalizeEmail(
                req.body.email
            );


        if (!email) {

            return res.status(400).json({
                message:
                    'Email is required.'
            });
        }


        // -----------------------------------------------------
        // FIND ACCOUNT
        // -----------------------------------------------------

        const staff =
            await Staff.findOne({
                email
            });


        // -----------------------------------------------------
        // GENERIC RESPONSE
        // -----------------------------------------------------
        //
        // Do not reveal whether an account exists.
        // -----------------------------------------------------

        if (!staff) {

            return res.status(200).json({
                message:
                    'If that email is in our database, an OTP has been sent.'
            });
        }


        if (!staff.isActive) {

            return res.status(200).json({
                message:
                    'If that email is in our database, an OTP has been sent.'
            });
        }


        // -----------------------------------------------------
        // CREATE PASSWORD RESET OTP
        // -----------------------------------------------------

        await issueOTP(
            staff,
            'password-reset'
        );


        // -----------------------------------------------------
        // SECURITY AUDIT
        // -----------------------------------------------------

        securityAudit({
            event:
                'PASSWORD_RESET_REQUESTED',

            req,

            staff,

            success:
                true,

            metadata: {
                role:
                    staff.role
            }
        });


        return res.status(200).json({
            message:
                'If that email is in our database, an OTP has been sent.'
        });


    } catch (error) {

        console.error(
            '[EMAIL] Password reset OTP failed:',
            error
        );


        securityAudit({
            event:
                'PASSWORD_RESET_REQUESTED',

            req,

            staff:
                null,

            success:
                false,

            metadata: {}
        });


        return res.status(500).json({
            message:
                'Server error during forgot password.'
        });
    }
};


// =========================================================
// VERIFY PASSWORD RESET OTP
// =========================================================

exports.verifyResetOTP = async (
    req,
    res
) => {

    try {

        const email =
            normalizeEmail(
                req.body.email
            );

        const otp =
            String(
                req.body.otp || ''
            ).trim();


        // -----------------------------------------------------
        // VALIDATION
        // -----------------------------------------------------

        if (!email) {

            return res.status(400).json({
                error:
                    'Email is required.'
            });
        }


        if (!/^\d{6}$/.test(otp)) {

            return res.status(400).json({
                error:
                    'Invalid OTP format.'
            });
        }


        // -----------------------------------------------------
        // FIND ACCOUNT
        // -----------------------------------------------------

        const staff =
            await Staff.findOne({
                email
            }).select(
                '+otpHash'
            );


        // -----------------------------------------------------
        // VERIFY RESET OTP
        // -----------------------------------------------------

        const verification =
            await verifyOTPForPurpose(
                staff,
                otp,
                'password-reset'
            );


        if (!verification.valid) {

            if (staff) {

                securityAudit({
                    event:
                        'PASSWORD_RESET_OTP_FAILED',

                    req,

                    staff,

                    success:
                        false,

                    metadata: {
                        reason:
                            verification.error
                    }
                });
            }


            return res.status(400).json({
                error:
                    verification.error
            });
        }


        // -----------------------------------------------------
        // GENERATE RESET TOKEN
        // -----------------------------------------------------

        const resetToken =
            crypto
                .randomBytes(32)
                .toString('hex');


        // Store only token hash
        staff.resetPasswordToken =
            hashResetToken(
                resetToken
            );


        // Token expires in 15 minutes
        staff.resetPasswordExpire =
            new Date(
                Date.now() +
                RESET_TOKEN_EXPIRY_MS
            );


        await staff.save();


        // -----------------------------------------------------
        // SECURITY AUDIT
        // -----------------------------------------------------

        securityAudit({
            event:
                'PASSWORD_RESET_OTP_VERIFIED',

            req,

            staff,

            success:
                true,

            metadata: {
                role:
                    staff.role
            }
        });


        // -----------------------------------------------------
        // RETURN TOKEN TO CURRENT RESET FLOW
        // -----------------------------------------------------

        return res.status(200).json({

            message:
                'OTP Verified',

            resetToken
        });


    } catch (error) {

        console.error(
            'Error in verifyResetOTP:',
            error
        );


        return res.status(500).json({
            error:
                'Server error during reset verification.'
        });
    }
};


// =========================================================
// RESET PASSWORD
// =========================================================

exports.resetPassword = async (
    req,
    res
) => {

    try {

        const email =
            normalizeEmail(
                req.body.email
            );

        const resetToken =
            String(
                req.body.resetToken || ''
            ).trim();

        const newPassword =
            String(
                req.body.newPassword || ''
            );


        // -----------------------------------------------------
        // BASIC VALIDATION
        // -----------------------------------------------------

        if (!email) {

            return res.status(400).json({
                message:
                    'Email is required.'
            });
        }


        if (!resetToken) {

            return res.status(400).json({
                message:
                    'Password reset session is invalid or expired. Please request a new reset code.'
            });
        }


        // -----------------------------------------------------
        // PASSWORD VALIDATION
        // -----------------------------------------------------

        const passwordCheck =
            validatePassword(
                newPassword
            );


        if (!passwordCheck.valid) {

            return res.status(400).json({
                message:
                    passwordCheck.message
            });
        }


        // -----------------------------------------------------
        // HASH RESET TOKEN
        // -----------------------------------------------------

        const hashedResetToken =
            hashResetToken(
                resetToken
            );


        // -----------------------------------------------------
        // FIND ACCOUNT BY RESET TOKEN
        // -----------------------------------------------------
        //
        // IMPORTANT:
        // We intentionally DO NOT use:
        //
        // resetPasswordExpire: { $gt: new Date() }
        //
        // because that caused your Mongoose date-casting error.
        //
        // We retrieve the record first and check the Date
        // directly in JavaScript.
        // -----------------------------------------------------

        const staff =
            await Staff.findOne({
                email,

                resetPasswordToken:
                    hashedResetToken

            }).select(
                '+resetPasswordToken'
            );


        if (!staff) {

            return res.status(400).json({
                message:
                    'Invalid or expired password reset session. Please request a new reset code.'
            });
        }


        // -----------------------------------------------------
        // CHECK RESET TOKEN EXPIRY
        // -----------------------------------------------------

        if (
            !staff.resetPasswordExpire
        ) {

            return res.status(400).json({
                message:
                    'Password reset session is invalid. Please request a new code.'
            });
        }


        const expiryTime =
            new Date(
                staff.resetPasswordExpire
            ).getTime();


        if (
            Number.isNaN(
                expiryTime
            ) ||
            expiryTime <=
            Date.now()
        ) {

            // Clear expired reset token
            staff.resetPasswordToken =
                null;

            staff.resetPasswordExpire =
                null;

            await staff.save();


            return res.status(400).json({
                message:
                    'Password reset session has expired. Please request a new code.'
            });
        }


        // -----------------------------------------------------
        // HASH NEW PASSWORD
        // -----------------------------------------------------

        const passwordHash =
            await bcrypt.hash(
                newPassword,
                12
            );


        // -----------------------------------------------------
        // UPDATE PASSWORD
        // -----------------------------------------------------

        staff.password =
            passwordHash;


        staff.passwordChangedAt =
            new Date();


        staff.isVerified =
            true;


        // -----------------------------------------------------
        // INVALIDATE RESET TOKEN
        // -----------------------------------------------------

        staff.resetPasswordToken =
            null;


        staff.resetPasswordExpire =
            null;


        // -----------------------------------------------------
        // CLEAR ALL OTP STATE
        // -----------------------------------------------------

        staff.otpHash =
            null;


        staff.otpExpiry =
            null;


        staff.otpPurpose =
            null;


        staff.otpAttempts =
            0;


        staff.otpLastSentAt =
            null;


        // -----------------------------------------------------
        // SAVE
        // -----------------------------------------------------

        await staff.save();


        // -----------------------------------------------------
        // SECURITY AUDIT
        // -----------------------------------------------------

        securityAudit({
            event:
                'PASSWORD_RESET_COMPLETED',

            req,

            staff,

            success:
                true,

            metadata: {
                role:
                    staff.role
            }
        });


        // -----------------------------------------------------
        // SUCCESS
        // -----------------------------------------------------

        return res.status(200).json({
            message:
                'Password has been updated successfully.'
        });


    } catch (error) {

        console.error(
            '[PASSWORD_RESET_ERROR]',
            error
        );


        return res.status(500).json({
            message:
                'Server error during password reset.'
        });
    }
};