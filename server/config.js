const path = require('path');

module.exports = {
    SGF_INTERVAL: 30, // seconds between SGF changes
    SGF_DIR: path.join(__dirname, '..', 'sgf')
};
