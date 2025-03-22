const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configuration
const SGF_INTERVAL = 30; // Seconds between SGF changes
const SGF_DIR = path.join(__dirname, 'sgf');

// Server state
let timer = SGF_INTERVAL;
let currentSGF = null;
let voteCounts = { A: 0, B: 0, C: 0 };

// Get SGF files
function getSGFFiles() {
    return fs.readdirSync(SGF_DIR)
        .filter(file => path.extname(file) === '.sgf')
        .map(file => ({
            path: path.join(SGF_DIR, file),
            name: file,
            move: parseInt(file.split('_').pop().replace('.sgf', '')) || 0
        }));
}

// Send new SGF to clients
function sendNewSGF() {
    const files = getSGFFiles();
    if (!files.length) return;

    const randomFile = files[Math.floor(Math.random() * files.length)];
    const sgfContent = fs.readFileSync(randomFile.path, 'utf8');
    
    currentSGF = {
        name: randomFile.name.split('_')[0],
        move: randomFile.move,
        content: sgfContent
    };

    // Reset votes for new game
    voteCounts = { A: 0, B: 0, C: 0 };
    
    io.emit('sgf-data', {
        ...currentSGF,
        timer: SGF_INTERVAL,
        votes: voteCounts
    });
}

// Timer management
function startTimers() {
    setInterval(() => {
        timer--;
        io.emit('time-update', timer);
        
        if (timer <= 0) {
            timer = SGF_INTERVAL;
            sendNewSGF();
        }
    }, 1000);
}

// Server setup
app.use(express.static('public'));

// WebSocket handlers
io.on('connection', (socket) => {
    // Send initial state
    if (currentSGF) {
        socket.emit('sgf-data', {
            ...currentSGF,
            timer,
            votes: voteCounts
        });
    }
    
    // Handle chat messages
    socket.on('chat-message', (message) => {
        io.emit('chat-message', {
            text: message,
            timestamp: new Date().toISOString(),
            user: socket.id.slice(0, 6)
        });
    });

    // Handle votes
    socket.on('vote', (option) => {
        if (['A', 'B', 'C'].includes(option)) {
            voteCounts[option]++;
            io.emit('vote-update', voteCounts);
        }
    });
});

// Start server
server.listen(3000, () => {
    console.log('Server running on port 3000');
    sendNewSGF();
    startTimers();
});