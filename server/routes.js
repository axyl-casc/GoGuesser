const express = require('express');
const path = require('path');

function setupRoutes(app) {
    app.get('/login', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
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
        res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    });

    app.use(express.static(path.join(__dirname, '..', 'public')));
}

module.exports = setupRoutes;
