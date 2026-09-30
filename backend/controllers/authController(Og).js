// controllers/authController.js
const Staff = require('../models/Staff');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendOTPEmail = require('../utils/sendEmail');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// -- EXISTING: Registration Controller --
exports.registerStaff = async(req, res) => {
    try {
        const { email, password, name, role } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
        
        const userExists = await Staff.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'User already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const otp = generateOTP();
        const assignedRole = ['admin', 'instructor', 'student'].includes(role) ? role : 'student';

        const newStaff = new Staff({
            email, password: hashedPassword, name: name || 'New User',
            department: 'Data Annotation', role: assignedRole,
            otp: otp, otpExpiry: Date.now() + 10 * 60 * 1000 
        });

        await newStaff.save();
        if (process.env.NODE_ENV !== 'test') await sendOTPEmail(email, otp);

        res.status(201).json({ message: 'Registration successful. Please verify your OTP.', requiresOTP: true, email: newStaff.email });
    } catch (error) {
        console.error('Error in register route:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

// -- EXISTING: Login Controller --
exports.loginStaff = async(req, res) => {
    try {
        const { email, password } = req.body;
        const staff = await Staff.findOne({ email });
        if (!staff) return res.status(401).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, staff.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const otp = generateOTP();
        staff.otp = otp;
        staff.otpExpiry = Date.now() + 10 * 60 * 1000;
        await staff.save();

        if (process.env.NODE_ENV !== 'test') await sendOTPEmail(staff.email, otp);

        res.status(200).json({ message: 'Credentials valid. OTP sent to email.', requiresOTP: true, email: staff.email });
    } catch (error) {
        console.error('Error in login route:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
};

// -- EXISTING: OTP Verification Controller --
exports.verifyOTP = async(req, res) => {
    try {
        const { email, otp } = req.body;
        const staff = await Staff.findOne({ email });

        if (!staff || staff.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
        if (staff.otpExpiry < Date.now()) return res.status(400).json({ error: 'OTP has expired' });

        staff.otp = null;
        staff.otpExpiry = null;
        staff.isVerified = true;
        await staff.save();

        if (req.session) req.session.userId = staff._id.toString();

        const token = jwt.sign({ id: staff._id, role: staff.role }, process.env.JWT_SECRET || 'supersecretkey', { expiresIn: '1d' });

        res.status(200).json({
            message: 'Authentication successful', token,
            user: { id: staff._id, email: staff.email, name: staff.name, role: staff.role }
        });
    } catch (error) {
        console.error('Error in verify route:', error);
        res.status(500).json({ error: 'Server error during verification' });
    }
};


// =========================================================================
// SECURITY ADDITIONS: FORGOT & RESET PASSWORD (RBAC & CRYPTO AWARE)
// =========================================================================

// Request Forgot Password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const staff = await Staff.findOne({ email });

        if (!staff) {
            // Security: Prevent User Enumeration attacks by sending generic success
            return res.status(200).json({ message: 'If that email is in our database, an OTP has been sent.' });
        }

        const otp = generateOTP();
        staff.otp = otp;
        staff.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
        await staff.save();

        // RBAC Audit Context: Identify if Admin requested reset
        if (staff.role === 'admin') {
            console.log(`[SECURITY AUDIT] Password reset requested for Admin account: ${staff.email}`);
        }

        if (process.env.NODE_ENV !== 'test') {
            await sendOTPEmail(staff.email, otp);
        }

        res.status(200).json({ message: 'If that email is in our database, an OTP has been sent.' });
    } catch (error) {
        console.error('Error in forgotPassword:', error);
        res.status(500).json({ message: 'Server error during forgot password' });
    }
};

// Verify OTP specifically for resetting password, issues Secure Token
exports.verifyResetOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const staff = await Staff.findOne({ email });

        if (!staff || staff.otp !== otp) return res.status(400).json({ error: 'Invalid or expired OTP' });
        if (staff.otpExpiry < Date.now()) return res.status(400).json({ error: 'OTP has expired' });

        // OTP Valid. Clear it out and generate a secure 15-minute crypto token
        staff.otp = null;
        staff.otpExpiry = null;

        const resetToken = crypto.randomBytes(32).toString('hex');
        staff.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        staff.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 Mins

        await staff.save();

        // Return the unhashed token to the client to use in the final Step 3 Request
        res.status(200).json({ message: 'OTP Verified', resetToken });
    } catch (error) {
        console.error('Error in verifyResetOTP:', error);
        res.status(500).json({ error: 'Server error during reset verification' });
    }
};

// Finalize Password Reset
exports.resetPassword = async (req, res) => {
    try {
        const { email, resetToken, newPassword } = req.body;

        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const staff = await Staff.findOne({ 
            email, 
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() } // Ensure token isn't expired
        });

        if (!staff) {
            return res.status(400).json({ message: 'Invalid or expired reset token.' });
        }

        // Apply new password
        const salt = await bcrypt.genSalt(10);
        staff.password = await bcrypt.hash(newPassword, salt);
        staff.passwordChangedAt = Date.now();
        
        // Invalidate token
        staff.resetPasswordToken = undefined;
        staff.resetPasswordExpire = undefined;
        await staff.save();

        if (staff.role === 'admin') {
            console.log(`[SECURITY AUDIT] Admin account password successfully reset: ${staff.email}`);
        }

        res.status(200).json({ message: 'Password has been updated successfully.' });
    } catch (error) {
        console.error('Error in resetPassword:', error);
        res.status(500).json({ message: 'Server error during password reset' });
    }
};