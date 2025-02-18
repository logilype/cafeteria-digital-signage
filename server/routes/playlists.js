const express = require('express');
const router = express.Router();
const Playlist = require('../models/playlist');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Get all playlists
router.get('/', async (req, res) => {
    try {
        const playlists = await Playlist.find().sort('-updatedAt');
        res.json(playlists);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching playlists' });
    }
});

// Create new playlist
router.post('/', async (req, res) => {
    try {
        const playlist = new Playlist(req.body);
        await playlist.save();
        res.json(playlist);
    } catch (error) {
        res.status(500).json({ error: 'Error creating playlist' });
    }
});

// Update playlist
router.put('/:id', async (req, res) => {
    try {
        const playlist = await Playlist.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: Date.now() },
            { new: true }
        );
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
        res.json(playlist);
    } catch (error) {
        res.status(500).json({ error: 'Error updating playlist' });
    }
});

module.exports = router; 