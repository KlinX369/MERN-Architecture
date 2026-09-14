// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

exports.protect = (req, res, next) => {
    // 1. Get the token safely without optional chaining
    let token;
    const authHeader = req.header('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    // 2. If there's no token, reject the request
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        // 3. Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');

        // 4. Attach the decoded user payload
        req.user = decoded;

        // 5. Pass control to the next function
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};