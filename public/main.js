let socket;

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const urlRank = params.get('rank');
    if (urlRank) {
        localStorage.setItem('local_rank', urlRank);
    }

    socket = io();
    let currentPlayer = null;
    let userVote = null;
    
    // DOM elements
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const timeLeft = document.getElementById('time-left');
    const timerLabel = document.getElementById('timer-label');
    const voteButtons = {
        A: document.getElementById('count-a'),
        B: document.getElementById('count-b'),
        C: document.getElementById('count-c')
    };

    // Voting system
    function handleVote(option) {
        if(userVote === option) return;
        
        // Remove previous vote
        if(userVote) {
            socket.emit('vote-remove', userVote);
            document.querySelector(`.vote-button[data-option="${userVote}"]`).classList.remove('selected');
        }
        
        // Add new vote
        userVote = option;
        socket.emit('vote', option);
        document.querySelector(`.vote-button[data-option="${option}"]`).classList.add('selected');
    }

    // Disable board interactions
    function disableBoardInteractions() {
        if(currentPlayer && currentPlayer.board) {
            currentPlayer.board.element.style.pointerEvents = 'none';
            if(currentPlayer.board._eventListeners && currentPlayer.board._eventListeners.click) {
                currentPlayer.board._eventListeners.click = [];
            }
        }
    }

    // SGF updates
    socket.on('sgf-data', (data) => {
        // Clear previous board
        if(currentPlayer) {
            document.getElementById('board-container').innerHTML = '';
        }

        // Create new board
        currentPlayer = new WGo.BasicPlayer(document.getElementById('board-container'), {
            sgf: data.content,
            move: data.move,
            layout: {},
            board: {
                section: { top: 0, right: 0, bottom: 0, left: 0 },
                stoneHandler: WGo.Board.drawHandlers.GLOW,
                lineWidth: 1.5,
                starSize: 0.3,
                background: "wood.jpg"
            },
            enableWheel: false,
            enableKeys: false,
            markLastMove: true
        });

        // Disable board interactions
        disableBoardInteractions();
        userVote = null;
        document.querySelectorAll('.vote-button').forEach(btn => btn.classList.remove('selected'));

        // Update timer display based on round state
        if(data && typeof data.timer !== 'undefined') {
            timeLeft.textContent = data.timer;
            timerLabel.textContent = data.waiting ? 'Next game in' : 'Round ends in';
        }
    });

    // Vote updates
    socket.on('vote-update', (votes) => {
        Object.entries(votes).forEach(([option, count]) => {
            voteButtons[option].textContent = count;
        });
    });

    // Chat functionality
    socket.on('chat-message', (msg) => {
        const div = document.createElement('div');
        div.className = 'message';

        const userSpan = document.createElement('span');
        userSpan.className = 'user';
        const rankText = msg.rank ? msg.rank : '?';
        userSpan.textContent = `${msg.user} (${rankText})`;

        const textNode = document.createTextNode(` ${msg.text} `);

        const timeSpan = document.createElement('span');
        timeSpan.className = 'time';
        timeSpan.textContent = new Date(msg.timestamp).toLocaleTimeString();

        div.appendChild(userSpan);
        div.appendChild(textNode);
        div.appendChild(timeSpan);

        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // Timer updates
    socket.on('time-update', (data) => {
        if (typeof data === 'object') {
            timeLeft.textContent = data.time;
            timerLabel.textContent = data.waiting ? 'Next game in' : 'Round ends in';
        } else {
            timeLeft.textContent = data;
        }
    });

    const answerOverlay = document.getElementById('answer-overlay');
    const answerText = document.getElementById('answer-text');

    socket.on('answer', (correct) => {
        const isCorrect = userVote && userVote === correct;
        answerText.textContent = '';
        answerOverlay.classList.remove('flash-correct', 'flash-wrong');
        answerOverlay.classList.add(isCorrect ? 'flash-correct' : 'flash-wrong');
        answerOverlay.style.display = 'block';

        document.querySelectorAll('.vote-button').forEach(btn => {
            if(btn.dataset.option === correct) {
                btn.classList.add('correct-answer');
            } else {
                btn.classList.remove('correct-answer');
            }
        });

        setTimeout(() => {
            answerOverlay.style.display = 'none';
            answerOverlay.classList.remove('flash-correct', 'flash-wrong');
            document.querySelectorAll('.vote-button').forEach(btn => btn.classList.remove('correct-answer'));
        }, 1000);
    });

    // Event listeners
    document.querySelectorAll('.vote-button').forEach(button => {
        button.addEventListener('click', (e) => {
            handleVote(e.target.dataset.option);
        });
    });

    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if(e.key === 'Enter') sendMessage();
    });

    document.getElementById('chat-toggle').addEventListener('click', toggleChat);
});

function sendMessage() {
    const message = document.getElementById('chat-input').value.trim();
    if(message) {
        const rank = localStorage.getItem('local_rank') || '?';
        socket.emit('chat-message', { text: message, rank });
        document.getElementById('chat-input').value = '';
    }
}

function exitApp() {
    window.close();
}

function toggleChat() {
    const chat = document.getElementById('chat-container');
    const btn = document.getElementById('chat-toggle');
    if (chat.style.display === 'none') {
        chat.style.display = 'flex';
        btn.textContent = 'Hide Chat';
    } else {
        chat.style.display = 'none';
        btn.textContent = 'Show Chat';
    }
}
