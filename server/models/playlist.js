const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    items: [{
        type: {
            type: String,
            enum: ['media', 'offers', 'menu', 'ads'],
            required: true
        },
        id: String,
        duration: {
            type: Number,
            default: 10
        },
        transition: {
            type: String,
            default: 'fade'
        }
    }],
    active: {
        type: Boolean,
        default: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Playlist', playlistSchema); 