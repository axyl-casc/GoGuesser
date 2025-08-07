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
    let currentTime = 0;
    let voteTime = 0;
    
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
    const scoreDisplay = document.getElementById('game-score');

    function getGameScore() {
        const val = parseInt(localStorage.getItem('game_score'), 10);
        return isNaN(val) ? 0 : val;
    }

    function setGameScore(val) {
        const normalized = Math.max(0, parseInt(val, 10) || 0);
        localStorage.setItem('game_score', normalized);
        if (scoreDisplay) scoreDisplay.textContent = normalized;
    }

    setGameScore(getGameScore());

    // Voting system
    function handleVote(option) {
        if(userVote === option) return;

        // Remove previous vote
        if(userVote) {
            socket.emit('vote-remove', userVote);
            const prev = document.querySelector(`.vote-button[data-option="${userVote}"]`);
            prev.classList.remove('bg-blue-500', 'text-white', 'shadow');
            prev.classList.add('bg-gray-200');
        }

        // Add new vote
        userVote = option;
        voteTime = currentTime;
        socket.emit('vote', option);
        const current = document.querySelector(`.vote-button[data-option="${option}"]`);
        current.classList.remove('bg-gray-200');
        current.classList.add('bg-blue-500', 'text-white', 'shadow');
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

    function clearVoteButtons() {
        document.querySelectorAll('.vote-button').forEach(btn => {
            btn.classList.remove('bg-blue-500', 'text-white', 'shadow', 'bg-green-500');
            btn.classList.add('bg-gray-200');
        });
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

        document.querySelectorAll('.wgo-controls, .wgo-player-info').forEach(el => el.classList.add('hidden'));

        // Disable board interactions
        disableBoardInteractions();
        userVote = null;
        voteTime = 0;
        clearVoteButtons();

        // Update timer display based on round state
        if(data && typeof data.timer !== 'undefined') {
            timeLeft.textContent = data.timer;
            timerLabel.textContent = data.waiting ? 'Next game in' : 'Round ends in';
            currentTime = data.timer;
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
        div.className = 'mb-2 p-2 bg-gray-100 rounded text-sm';

        const userSpan = document.createElement('span');
        userSpan.className = 'text-gray-700 font-bold mr-2';
        const rankText = msg.rank ? msg.rank : '?';
        userSpan.textContent = `${msg.user} (${rankText})`;

        const textNode = document.createTextNode(` ${msg.text} `);

        const timeSpan = document.createElement('span');
        timeSpan.className = 'text-gray-500 text-xs float-right';
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
            currentTime = data.time;
        } else {
            timeLeft.textContent = data;
            currentTime = data;
        }
    });

    const answerOverlay = document.getElementById('answer-overlay');
    const answerText = document.getElementById('answer-text');

    socket.on('answer', (correct) => {
        const isCorrect = userVote && userVote === correct;
        if (isCorrect) {
            setGameScore(getGameScore() + voteTime);
        } else {
            setGameScore(getGameScore() + voteTime - 30);
        }
        voteTime = 0;
        answerText.textContent = '';
        answerOverlay.classList.remove('hidden', 'bg-green-500/50', 'bg-red-500/50');
        answerOverlay.classList.add(isCorrect ? 'bg-green-500/50' : 'bg-red-500/50');

        document.querySelectorAll('.vote-button').forEach(btn => {
            if (btn.dataset.option === correct) {
                btn.classList.remove('bg-blue-500', 'bg-gray-200');
                btn.classList.add('bg-green-500', 'text-white');
            } else if (userVote && btn.dataset.option === userVote) {
                btn.classList.remove('bg-gray-200', 'bg-green-500');
                btn.classList.add('bg-blue-500', 'text-white', 'shadow');
            } else {
                btn.classList.remove('bg-green-500', 'bg-blue-500', 'text-white', 'shadow');
                btn.classList.add('bg-gray-200');
            }
        });

        setTimeout(() => {
            answerOverlay.classList.add('hidden');
            answerOverlay.classList.remove('bg-green-500/50', 'bg-red-500/50');
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
    const input = document.getElementById('chat-input');
    let message = input.value.trim();
    const MAX_LENGTH = 256;
    if (message.length > MAX_LENGTH) {
        message = message.slice(0, MAX_LENGTH);
    }
    if(message) {
        const rank = localStorage.getItem('local_rank') || '?';
        socket.emit('chat-message', { text: message, rank });
        input.value = '';
    }
}

function exitApp() {
    window.close();
}

function toggleChat() {
    const chat = document.getElementById('chat-container');
    const btn = document.getElementById('chat-toggle');
    if (chat.classList.contains('hidden')) {
        chat.classList.remove('hidden');
        btn.classList.add('hidden');
        document.getElementById('chat-input').focus();
    } else {
        chat.classList.add('hidden');
        btn.classList.remove('hidden');
    }
}
