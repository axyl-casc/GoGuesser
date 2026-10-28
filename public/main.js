let socket;

document.addEventListener('DOMContentLoaded', () => {
    const urlRank = new URLSearchParams(window.location.search).get('rank');
    if (urlRank) localStorage.setItem('local_rank', urlRank);

    socket = io();
    let currentPlayer = null;
    let userVote = null;
    let currentTime = 0;
    let voteTime = 0;
    let waiting = true;
    let answerTimeout;

    const chatMessages = document.getElementById('chat-messages');
    const chatPanel = document.getElementById('chat-container');
    const timeLeft = document.getElementById('time-left');
    const timerLabel = document.getElementById('timer-label');
    const timerProgress = document.getElementById('timer-progress');
    const voteHint = document.getElementById('vote-hint');
    const scoreDisplay = document.getElementById('game-score');
    const turnDisplay = document.getElementById('turn-display');
    const answerOverlay = document.getElementById('answer-overlay');
    const answerText = document.getElementById('answer-text');
    const moveButtons = [...document.querySelectorAll('.vote-button')];

    function getGameScore() {
        return Math.max(0, parseInt(localStorage.getItem('game_score'), 10) || 0);
    }

    function setGameScore(value) {
        const normalized = Math.max(0, parseInt(value, 10) || 0);
        localStorage.setItem('game_score', normalized);
        scoreDisplay.textContent = normalized;
    }

    function setVoteIndicator(button, icon) {
        button.querySelector('use').setAttribute('href', `/assets/icons.svg#${icon}`);
    }

    function updateVoteAvailability() {
        moveButtons.forEach(button => {
            button.disabled = waiting || !socket.connected || !currentPlayer;
        });
    }

    function setConnectionStatus(label, connected) {
        document.getElementById('connection-label').textContent = label;
        document.getElementById('connection-status').classList.toggle('is-live', connected);
        document.getElementById('chat-input').disabled = !connected;
        document.getElementById('chat-send').disabled = !connected;
        updateVoteAvailability();
    }

    function updateTimer(time, isWaiting) {
        currentTime = Math.max(0, Number(time) || 0);
        waiting = Boolean(isWaiting);
        timeLeft.textContent = currentTime;
        timerLabel.textContent = waiting ? 'Next round in' : 'Round ends in';
        timerProgress.style.width = `${Math.min(100, currentTime / (waiting ? 10 : 30) * 100)}%`;
        document.getElementById('timer').classList.toggle('is-urgent', !waiting && currentTime <= 5);
        updateVoteAvailability();
    }

    function handleVote(option) {
        const button = moveButtons.find(item => item.dataset.option === option);
        if (!button || button.disabled || userVote === option) return;
        if (userVote) socket.emit('vote-remove', userVote);
        userVote = option;
        voteTime = currentTime;
        socket.emit('vote', option);
        moveButtons.forEach(item => {
            const selected = item.dataset.option === option;
            item.classList.toggle('is-selected', selected);
            item.setAttribute('aria-pressed', String(selected));
            setVoteIndicator(item, selected ? 'check' : 'arrow');
        });
        voteHint.textContent = `Move ${option} chosen. You can still change your mind.`;
    }

    function resetVoteButtons() {
        moveButtons.forEach(button => {
            button.classList.remove('is-selected', 'is-correct');
            button.setAttribute('aria-pressed', 'false');
            setVoteIndicator(button, 'arrow');
        });
        voteHint.textContent = waiting ? 'The next possibility is on its way.' : 'Choose a move. See what others are thinking.';
    }

    function updateVotes(votes) {
        ['A', 'B', 'C'].forEach(option => {
            document.getElementById(`count-${option.toLowerCase()}`).textContent = votes[option] || 0;
        });
    }

    setGameScore(getGameScore());
    setChatOpen(localStorage.getItem('chat_open') !== 'false');

    socket.on('connect', () => setConnectionStatus('LIVE PROBLEM', true));
    socket.on('disconnect', () => {
        setConnectionStatus('RECONNECTING', false);
        voteHint.textContent = 'Reconnecting to the courtyard…';
    });
    socket.on('connect_error', () => {
        setConnectionStatus('CONNECTION PAUSED', false);
        voteHint.textContent = 'Unable to connect. Please refresh to rejoin.';
    });

    socket.on('sgf-data', data => {
        const kifu = rotateKifu(WGo.Kifu.fromSgf(data.content), data.rotation);
        // Reuse the player so each new round does not register another resize listener.
        if (!currentPlayer) {
            currentPlayer = new WGo.BasicPlayer(document.getElementById('board-container'), {
                layout: {},
                board: {
                    section: { top: -0.75, right: -0.75, bottom: -0.75, left: -0.75 },
                    stoneHandler: WGo.Board.drawHandlers.REALISTIC,
                    background: '/wgo/wood_1024.jpg'
                },
                enableWheel: false,
                enableKeys: false,
                // SGF answer labels are authoritative; variation letters can duplicate A.
                displayVariations: false,
                markLastMove: true
            });
            currentPlayer.board.addCustomObject(WGo.Board.coordinates);
            currentPlayer.board.element.style.pointerEvents = 'none';
        }
        currentPlayer.loadKifu(kifu, data.move);

        userVote = null;
        voteTime = 0;
        clearTimeout(answerTimeout);
        answerOverlay.hidden = true;
        updateTimer(data.timer, data.waiting);
        resetVoteButtons();
        if (data.votes) updateVotes(data.votes);

        if (currentPlayer.kifuReader && currentPlayer.kifuReader.game) {
            const blackToPlay = currentPlayer.kifuReader.game.turn === WGo.B;
            turnDisplay.textContent = blackToPlay ? 'Black to play' : 'White to play';
            document.getElementById('turn-stone').className = `go-stone ${blackToPlay ? 'black' : 'white'}`;
            const size = currentPlayer.board.size;
            document.getElementById('board-size').textContent = `${size} × ${size} BOARD`;
            document.getElementById('board-container').setAttribute('aria-label', `${size} by ${size} Go board. ${turnDisplay.textContent}. Choose a labeled move using the A, B, or C buttons.`);
        }
    });

    socket.on('vote-update', updateVotes);
    socket.on('time-update', data => {
        if (typeof data === 'object') updateTimer(data.time, data.waiting);
        else updateTimer(data, waiting);
    });

    socket.on('answer', correct => {
        waiting = true;
        updateVoteAvailability();
        const isCorrect = userVote === correct && Boolean(userVote);
        const earned = isCorrect ? voteTime : 0;
        if (isCorrect) setGameScore(getGameScore() + earned);
        voteTime = 0;
        moveButtons.forEach(button => {
            const bestMove = button.dataset.option === correct;
            button.classList.toggle('is-correct', bestMove);
            if (bestMove) setVoteIndicator(button, 'check');
        });
        const hasAnswer = ['A', 'B', 'C'].includes(correct);
        voteHint.textContent = hasAnswer ? `Move ${correct} was the strongest. A new round begins soon.` : 'A new position is on its way.';
        answerText.textContent = isCorrect ? `Well read. Move ${correct} is best. +${earned} points.` : hasAnswer ? `A moment to learn: move ${correct} is the strongest.` : 'A fresh board. A new possibility.';
        answerOverlay.classList.toggle('is-correct', isCorrect);
        answerOverlay.hidden = false;
        clearTimeout(answerTimeout);
        answerTimeout = setTimeout(() => { answerOverlay.hidden = true; }, 4500);
    });

    socket.on('chat-message', message => {
        const nearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 40;
        const item = document.createElement('div');
        const isSystem = message.user === 'System';
        item.className = `chat-message${isSystem ? ' is-system' : ''}`;
        const heading = document.createElement('div');
        heading.className = 'chat-message-header';
        const user = document.createElement('span');
        user.className = 'chat-user';
        user.textContent = isSystem ? 'The courtyard' : `${message.user} · ${message.rank || '?'}`;
        const time = document.createElement('time');
        time.className = 'chat-time';
        time.dateTime = message.timestamp;
        time.textContent = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const content = document.createElement('p');
        content.textContent = message.text;
        heading.append(user, time);
        item.append(heading, content);
        chatMessages.appendChild(item);
        if (chatMessages.childElementCount > 200) chatMessages.firstElementChild.remove();
        if (nearBottom) chatMessages.scrollTop = chatMessages.scrollHeight;
        if (chatPanel.hidden && !isSystem) document.getElementById('chat-unread').hidden = false;
    });

    moveButtons.forEach(button => button.addEventListener('click', () => handleVote(button.dataset.option)));
    document.addEventListener('keydown', event => {
        if (event.ctrlKey || event.altKey || event.metaKey || event.repeat || event.target.closest('input, textarea, [contenteditable="true"]') || document.querySelector('dialog[open]')) return;
        const option = event.key.toUpperCase();
        if (['A', 'B', 'C'].includes(option)) handleVote(option);
    });
    document.getElementById('chat-controls').addEventListener('submit', event => {
        event.preventDefault();
        sendMessage();
    });
    document.getElementById('chat-toggle').addEventListener('click', toggleChat);
    document.getElementById('chat-close').addEventListener('click', toggleChat);
    document.querySelectorAll('[data-open-help]').forEach(button => button.addEventListener('click', () => document.getElementById('help-dialog').showModal()));

    // The host window can resize without emitting a browser resize event.
    const boardObserver = new ResizeObserver(() => {
        if (currentPlayer) currentPlayer.updateDimensions();
    });
    boardObserver.observe(document.getElementById('board-container'));
});

function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim().slice(0, 256);
    if (message && socket && socket.connected) {
        socket.emit('chat-message', { text: message, rank: localStorage.getItem('local_rank') || '?' });
        input.value = '';
    }
}

function exitApp() {
    window.close();
}

function toggleChat() {
    const chat = document.getElementById('chat-container');
    setChatOpen(chat.hidden, true);
    localStorage.setItem('chat_open', String(!chat.hidden));
}

function setChatOpen(open, moveFocus = false) {
    const chat = document.getElementById('chat-container');
    const button = document.getElementById('chat-toggle');
    const focusWasInChat = chat.contains(document.activeElement);
    chat.hidden = !open;
    document.body.classList.toggle('has-chat', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Hide courtyard chat' : 'Show courtyard chat');
    document.getElementById('chat-toggle-label').textContent = open ? 'Hide chat' : 'Show chat';
    if (open) {
        document.getElementById('chat-unread').hidden = true;
        const messages = document.getElementById('chat-messages');
        messages.scrollTop = messages.scrollHeight;
        if (moveFocus) document.getElementById('chat-input').focus();
    } else if (focusWasInChat) {
        button.focus();
    }
}
