const sanitizeHtml = require('sanitize-html');
const { SGF_INTERVAL } = require('./config');
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
    let currentSGF = null;
    let voteCounts = { A: 0, B: 0, C: 0 };

    function sendNewSGF() {
        const sgf = getRandomSGF();
        if (!sgf) return;
        currentSGF = sgf;
        voteCounts = { A: 0, B: 0, C: 0 };
        io.emit('sgf-data', {
            ...currentSGF,
            timer: SGF_INTERVAL,
            votes: voteCounts
        });
    }

    function startTimers() {
        setInterval(() => {
            timer--;
            io.emit('time-update', timer);
            if (timer <= 0) {
                io.emit('answer', currentSGF ? currentSGF.answer : null);
                io.emit('chat-message', {
                    text: `The correct answer was: ${currentSGF ? currentSGF.answer : '?'}`,
                    rank: '',
                    timestamp: new Date().toISOString(),
                    user: 'System'
                });
                setTimeout(() => {
                    timer = SGF_INTERVAL;
                    sendNewSGF();
                }, 1000);
            }
        }, 1000);
    }

    function startVoteUpdates() {
        setInterval(() => {
            io.emit('vote-update', voteCounts);
        }, 100);
    }

    io.on('connection', socket => {
        const username = socket.request.session.user;
        if (currentSGF) {
            socket.emit('sgf-data', {
                ...currentSGF,
                timer,
                votes: voteCounts
            });
        }

        socket.on('chat-message', data => {
            const text = typeof data === 'string' ? data : data.text;
            const rank = data && data.rank ? data.rank : '?';
            const clean = sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
            io.emit('chat-message', {
                text: clean,
                rank,
                timestamp: new Date().toISOString(),
                user: username
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
