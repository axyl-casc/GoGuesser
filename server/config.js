const path = require('path');

module.exports = {
    SGF_INTERVAL: 30, // seconds between SGF changes
    WAIT_INTERVAL: 15, // seconds between rounds
    SGF_DIR: path.join(__dirname, '..', 'sgf')
};
