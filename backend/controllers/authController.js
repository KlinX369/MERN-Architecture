// controllers/authController.js
const Staff = require('../models/Staff');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendOTPEmail = require('../utils/sendEmail');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Registration Controller
exports.registerStaff = async(req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const userExists = await Staff.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash the password for production security
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const otp = generateOTP();

        // Create the new staff member
        const newStaff = new Staff({
            email,
            password: hashedPassword,
            name: name || 'New User',
            department: 'Data Annotation',
            role: 'tutor',
            otp: otp,
            otpExpiry: Date.now() + 10 * 60 * 1000 // 10 minutes
        });

        await newStaff.save();

        // Send OTP email
        await sendOTPEmail(email, otp);

        res.status(201).json({
            message: 'Registration successful. Please verify your email.',
            requiresOTP: true
        });
    } catch (error) {
        console.error('Error in register route:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

// Login Controller
exports.loginStaff = async(req, res) => {
    try {
        const { email, password } = req.body;

        const staff = await Staff.findOne({ email });
        if (!staff) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, staff.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate and save new OTP
        const otp = generateOTP();
        staff.otp = otp;
        staff.otpExpiry = Date.now() + 10 * 60 * 1000;
        await staff.save();

        // Send OTP email
        await sendOTPEmail(staff.email, otp);

        res.status(200).json({
            message: 'Credentials valid. OTP sent to email.',
            requiresOTP: true
        });
    } catch (error) {
        console.error('Error in login route:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
};

// OTP Verification Controller
exports.verifyOTP = async(req, res) => {
    try {
        const { email, otp } = req.body;

        const staff = await Staff.findOne({ email });

        if (!staff || staff.otp !== otp) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        if (staff.otpExpiry < Date.now()) {
            return res.status(400).json({ error: 'OTP has expired' });
        }

        // Clear OTP and mark verified
        staff.otp = null;
        staff.otpExpiry = null;
        staff.isVerified = true;
        await staff.save();

        // Generate a JWT Token
        const token = jwt.sign({ id: staff._id, role: staff.role },
            process.env.JWT_SECRET || 'supersecretkey', { expiresIn: '1d' }
        );

        res.status(200).json({
            message: 'Authentication successful',
            token,
            staff: { id: staff._id, email: staff.email, role: staff.role }
        });
    } catch (error) {
        console.error('Error in verify route:', error);
        res.status(500).json({ error: 'Server error during verification' });
    }
};