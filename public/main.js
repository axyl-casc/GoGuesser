document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    let currentPlayer = null;
    let userVote = null;
    
    // DOM elements
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const timeLeft = document.getElementById('time-left');
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
            currentPlayer.board._eventListeners.click = [];
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
        div.innerHTML = `
            <span class="user">[${msg.user}]</span>
            ${msg.text}
            <span class="time">${new Date(msg.timestamp).toLocaleTimeString()}</span>
        `;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // Timer updates
    socket.on('time-update', (time) => {
        timeLeft.textContent = time;
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
});

function sendMessage() {
    const message = document.getElementById('chat-input').value.trim();
    if(message) {
        socket.emit('chat-message', message);
        document.getElementById('chat-input').value = '';
    }
}