const mongoose = require('mongoose');
const User = require('../models/user');
const bcrypt = require('bcrypt');

async function setupDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/cafds');

        // Check if admin exists
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const admin = new User({
                username: 'admin',
                password: process.env.INITIAL_ADMIN_PASSWORD || 'admin123',
                role: 'admin'
            });
            await admin.save();
            console.log('Admin user created successfully');
        }

        console.log('Database setup completed');
        process.exit(0);
    } catch (error) {
        console.error('Database setup failed:', error);
        process.exit(1);
    }
}

setupDatabase(); 