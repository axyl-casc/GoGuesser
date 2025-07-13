const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');

const setupRoutes = require('./server/routes');
const initSocket = require('./server/socketHandlers');

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
setupRoutes(app);

const { sendNewSGF, startTimers, startVoteUpdates } = initSocket(io, sessionMiddleware);

server.listen(3000, () => {
    console.log('Server running on port 3000');
    sendNewSGF();
    startTimers();
    startVoteUpdates();
});