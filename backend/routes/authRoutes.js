// routes/authRoutes.js
const express = require('express');
const router = express.Router();

// A simple in-memory array to simulate a database for now.
// Replace this with your actual database logic (MongoDB, PostgreSQL, etc.)
const users = [];

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Check if user already exists
        const userExists = users.find(user => user.email === email);
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Save the user 
        // NOTE: In production, ALWAYS hash passwords using bcrypt before saving!
        const newUser = { email, password };
        users.push(newUser);

        res.status(201).json({ message: 'Registration successful' });
    } catch (error) {
        console.error('Error in register route:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find the user
        const user = users.find(user => user.email === email);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Verify the password 
        // NOTE: In production, use bcrypt.compare() to verify hashed passwords!
        if (user.password !== password) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // NOTE: In production, generate and send a JWT (JSON Web Token) here
        res.status(200).json({ message: 'Login successful' });
    } catch (error) {
        console.error('Error in login route:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

module.exports = router;