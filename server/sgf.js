const fs = require('fs');
const path = require('path');
const { SGF_DIR } = require('./config');

function getSGFFiles() {
    return fs.readdirSync(SGF_DIR)
        .filter(file => path.extname(file) === '.sgf')
        .map(file => ({
            path: path.join(SGF_DIR, file),
            name: file,
            move: parseInt(file.split('_').pop().replace('.sgf', '')) || 0
        }));
}

function getRandomSGF() {
    const files = getSGFFiles();
    if (!files.length) return null;
    const randomFile = files[Math.floor(Math.random() * files.length)];
    const sgfContent = fs.readFileSync(randomFile.path, 'utf8');
    return {
        name: randomFile.name.split('_')[0],
        move: randomFile.move,
        content: sgfContent
    };
}

module.exports = { getSGFFiles, getRandomSGF };
