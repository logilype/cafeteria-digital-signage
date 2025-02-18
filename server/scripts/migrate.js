const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const Playlist = require('../models/playlist');
const Device = require('../models/device');

async function migrateData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/cafds');
        console.log('Connected to MongoDB');

        // Migrate playlists
        const playlistsFile = await fs.readFile(path.join(__dirname, '../data/configs/playlists.json'), 'utf8');
        const playlists = JSON.parse(playlistsFile);
        
        for (const playlist of playlists) {
            await Playlist.findOneAndUpdate(
                { name: playlist.name },
                playlist,
                { upsert: true, new: true }
            );
        }
        console.log('Playlists migrated');

        // Migrate devices
        const devicesFile = await fs.readFile(path.join(__dirname, '../data/configs/devices.json'), 'utf8');
        const devices = JSON.parse(devicesFile);
        
        for (const device of devices) {
            await Device.findOneAndUpdate(
                { token: device.token },
                device,
                { upsert: true, new: true }
            );
        }
        console.log('Devices migrated');

        console.log('Migration completed');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrateData(); 