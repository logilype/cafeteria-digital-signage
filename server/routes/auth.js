const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Login route
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username, active: true });
        if (!user || !(await user.verifyPassword(password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Set session
        req.session.userId = user._id;
        user.lastLogin = new Date();
        await user.save();

        res.json({ 
            message: 'Login successful',
            user: {
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Logout route
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully' });
    });
});

// Get current user
router.get('/me', requireAuth, (req, res) => {
    res.json({
        username: req.user.username,
        role: req.user.role
    });
});

// Create initial admin (only works if no users exist)
router.post('/setup', async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        if (userCount > 0) {
            return res.status(403).json({ error: 'Setup already completed' });
        }

        const admin = new User({
            username: 'admin',
            password: process.env.INITIAL_ADMIN_PASSWORD || 'admin123',
            role: 'admin'
        });

        await admin.save();
        res.json({ message: 'Admin user created successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Setup failed' });
    }
});

module.exports = router; 