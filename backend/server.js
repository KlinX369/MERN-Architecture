require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import your Staff routes here once created
// const staffRoutes = require('./routes/staffRoutes'); 
const authRoutes = require('./routes/authRoutes'); // ADDED: Import the auth routes

const app = express();

// --- Middleware ---
app.use(cors()); // Allows frontend React app to make requests to this API
app.use(express.json()); // Parses incoming JSON payloads (e.g., from POST/PUT requests)
app.use(express.urlencoded({ extended: true })); // Parses URL-encoded data

// --- Database Connection ---
const connectDB = async() => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`[Database] MongoDB Connected successfully on host: ${conn.connection.host}`);
    } catch (error) {
        console.error(`[Database] Connection Error: ${error.message}`);
        // Exit the Node process if the database connection fails to avoid silent errors
        process.exit(1);
    }
};

// Initialize connection
connectDB();

// --- API Routes ---
// Mount your staff routes to a specific endpoint path
// app.use('/api/staff', staffRoutes);

// ADDED: Mount the auth routes to handle login and register requests
app.use('/api/auth', authRoutes);

// Basic health check route to verify server is up
app.get('/', (req, res) => {
    res.status(200).json({ message: 'WebApp running...' });
});

// Catch-all route for undefined endpoints
app.use((req, res, next) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler (catches errors thrown in routes)
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