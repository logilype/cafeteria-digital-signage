const User = require('../models/user');

module.exports = {
    // Require authentication for routes
    requireAuth: (req, res, next) => {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        next();
    },

    // Require admin role
    requireAdmin: async (req, res, next) => {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        try {
            const user = await User.findById(req.session.userId);
            if (!user || user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin privileges required' });
            }
            next();
        } catch (error) {
            res.status(500).json({ error: 'Error checking user role' });
        }
    },

    // Attach user to request if authenticated
    loadUser: async (req, res, next) => {
        if (req.session && req.session.userId) {
            try {
                const user = await User.findById(req.session.userId);
                req.user = user;
            } catch (error) {
                console.error('Error loading user:', error);
            }
        }
        next();
    }
}; 