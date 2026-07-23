const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        default: 'New User'
    },
    department: {
        type: String,
        default: 'Unassigned'
    },
    role: {
        type: String,
        default: 'student'
    },
    checkedIn: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('Staff', staffSchema);