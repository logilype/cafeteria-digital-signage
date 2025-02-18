// Add these routes to your existing api.js

// Playlist routes
router.get('/playlists', async (req, res) => {
    try {
        const playlists = await Playlist.find().sort('-updatedAt');
        res.json(playlists);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching playlists' });
    }
});

router.get('/playlists/:id', async (req, res) => {
    try {
        const playlist = await Playlist.findById(req.params.id);
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
        res.json(playlist);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching playlist' });
    }
});

router.post('/playlists', async (req, res) => {
    try {
        const playlist = new Playlist(req.body);
        await playlist.save();
        res.json(playlist);
    } catch (error) {
        res.status(500).json({ error: 'Error creating playlist' });
    }
});

router.put('/playlists/:id', async (req, res) => {
    try {
        const playlist = await Playlist.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: Date.now() },
            { new: true }
        );
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
        
        // Notify devices using this playlist
        const devices = await Device.find({ playlistId: playlist._id });
        const ws = req.app.get('ws');
        devices.forEach(device => {
            ws.notifyDevice(device.token, {
                type: 'playlist_update',
                playlist
            });
        });
        
        res.json(playlist);
    } catch (error) {
        res.status(500).json({ error: 'Error updating playlist' });
    }
});

router.delete('/playlists/:id', async (req, res) => {
    try {
        await Playlist.findByIdAndDelete(req.params.id);
        res.json({ message: 'Playlist deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting playlist' });
    }
});

// Device routes
router.get('/devices', async (req, res) => {
    try {
        const devices = await Device.find()
            .populate('playlistId', 'name')
            .sort('-createdAt');
        res.json(devices);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching devices' });
    }
});

router.get('/devices/:id', async (req, res) => {
    try {
        const device = await Device.findById(req.params.id).populate('playlistId');
        if (!device) return res.status(404).json({ error: 'Device not found' });
        res.json(device);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching device' });
    }
});

router.post('/devices', async (req, res) => {
    try {
        const device = new Device(req.body);
        await device.save();
        res.json(device);
    } catch (error) {
        res.status(500).json({ error: 'Error creating device' });
    }
});

router.put('/devices/:id', async (req, res) => {
    try {
        const device = await Device.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!device) return res.status(404).json({ error: 'Device not found' });
        res.json(device);
    } catch (error) {
        res.status(500).json({ error: 'Error updating device' });
    }
});

router.delete('/devices/:id', async (req, res) => {
    try {
        await Device.findByIdAndDelete(req.params.id);
        res.json({ message: 'Device deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting device' });
    }
});

// Device ping endpoint to update online status
router.post('/devices/:token/ping', async (req, res) => {
    try {
        const device = await Device.findOneAndUpdate(
            { token: req.params.token },
            { 
                online: true,
                lastPing: Date.now()
            },
            { new: true }
        );
        if (!device) return res.status(404).json({ error: 'Device not found' });
        res.json({ status: 'ok' });
    } catch (error) {
        res.status(500).json({ error: 'Error updating device status' });
    }
});

// Get playlist for device
router.get('/devices/:token/playlist', async (req, res) => {
    try {
        const device = await Device.findOne({ token: req.params.token })
            .populate('playlistId');
        
        if (!device) return res.status(404).json({ error: 'Device not found' });
        if (!device.playlistId) return res.json({ playlist: null });
        
        res.json({ playlist: device.playlistId });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching device playlist' });
    }
}); 