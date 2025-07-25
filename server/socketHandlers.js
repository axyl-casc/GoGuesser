const sanitizeHtml = require('sanitize-html');
const filterSwears = require('./swearFilter');
const { SGF_INTERVAL, WAIT_INTERVAL } = require('./config');
const { getRandomSGF } = require('./sgf');

function initSocket(io, sessionMiddleware) {
    io.use((socket, next) => {
        sessionMiddleware(socket.request, {}, next);
    });

    io.use((socket, next) => {
        if (socket.request.session && socket.request.session.user) {
            return next();
        }
        next(new Error('unauthorized'));
    });

    let timer = SGF_INTERVAL;
    let waiting = false;
    let currentSGF = null;
    let voteCounts = { A: 0, B: 0, C: 0 };

    function sendNewSGF() {
        const sgf = getRandomSGF();
        if (!sgf) return;
        currentSGF = sgf;
        waiting = false;
        timer = SGF_INTERVAL;
        voteCounts = { A: 0, B: 0, C: 0 };
        io.emit('sgf-data', {
            ...currentSGF,
            timer,
            waiting,
            votes: voteCounts
        });
    }

    function startTimers() {
        setInterval(() => {
            timer--;
            if (timer <= 0) {
                if (!waiting) {
                    waiting = true;
                    io.emit('answer', currentSGF ? currentSGF.answer : null);
                    io.emit('chat-message', {
                        text: `The correct answer was: ${currentSGF ? currentSGF.answer : '?'}`,
                        rank: '',
                        timestamp: new Date().toISOString(),
                        user: 'System'
                    });
                    timer = WAIT_INTERVAL;
                } else {
                    sendNewSGF();
                }
            }
            io.emit('time-update', { time: timer, waiting });
        }, 1000);
    }

    function startVoteUpdates() {
        setInterval(() => {
            io.emit('vote-update', voteCounts);
        }, 100);
    }

    io.on('connection', socket => {
        const username = socket.request.session.user;
        socket.emit('chat-message', {
            text: 'This game is a work in progress. Source code available at https://github.com/axyl-casc/GoGuesser',
            rank: '',
            timestamp: new Date().toISOString(),
            user: 'System'
        });
        if (currentSGF) {
            socket.emit('sgf-data', {
                ...currentSGF,
                timer,
                waiting,
                votes: voteCounts
            });
        }

        socket.on('chat-message', data => {
            const now = Date.now();
            if (socket.lastMessageTime && now - socket.lastMessageTime < 1000) {
                return; // limit to 1 message per second
            }
            socket.lastMessageTime = now;

            const MAX_LENGTH = 256;
            let text = typeof data === 'string' ? data : data.text;
            const rank = data && data.rank ? data.rank : '?';

            if (text.length > MAX_LENGTH) {
                text = text.slice(0, MAX_LENGTH);
            }

            let clean = sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
            if (clean.length > MAX_LENGTH) {
                clean = clean.slice(0, MAX_LENGTH);
            }

            const filtered = filterSwears(clean);
            const filteredRank = filterSwears(rank);
            const filteredUser = filterSwears(username);
            io.emit('chat-message', {
                text: filtered,
                rank: filteredRank,
                timestamp: new Date().toISOString(),
                user: filteredUser
            });
        });

        socket.on('vote', option => {
            if (['A', 'B', 'C'].includes(option)) {
                voteCounts[option]++;
                io.emit('vote-update', voteCounts);
            }
        });

        socket.on('vote-remove', option => {
            if (['A', 'B', 'C'].includes(option) && voteCounts[option] > 0) {
                voteCounts[option]--;
                io.emit('vote-update', voteCounts);
            }
        });
    });

    return { sendNewSGF, startTimers, startVoteUpdates };
}

module.exports = initSocket;
