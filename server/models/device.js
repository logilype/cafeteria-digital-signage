const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    token: {
        type: String,
        required: true,
        unique: true
    },
    playlistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Playlist'
    },
    online: {
        type: Boolean,
        default: false
    },
    lastPing: Date,
    location: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    registration: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('Device', deviceSchema); 