const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const sanitizeHtml = require('sanitize-html');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const sessionMiddleware = session({
    secret: 'change-this-secret',
    resave: false,
    saveUninitialized: false
});

app.use(express.urlencoded({ extended: false }));
app.use(sessionMiddleware);

io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

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

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
    const username = (req.body.username || '').trim();
    if (username) {
        req.session.user = username;
        return res.redirect('/');
    }
    res.redirect('/login');
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

app.get('/', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

// WebSocket handlers
io.use((socket, next) => {
    if (socket.request.session && socket.request.session.user) {
        return next();
    }
    next(new Error('unauthorized'));
});

io.on('connection', (socket) => {
    const username = socket.request.session.user;

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
        const clean = sanitizeHtml(message, { allowedTags: [], allowedAttributes: {} });
        io.emit('chat-message', {
            text: clean,
            timestamp: new Date().toISOString(),
            user: username
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