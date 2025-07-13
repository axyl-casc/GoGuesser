const fs = require('fs');
const path = require('path');
const { SGF_DIR } = require('./config');

function getSGFFiles() {
    return fs.readdirSync(SGF_DIR)
        .filter(file => path.extname(file) === '.sgf')
        .map(file => ({
            path: path.join(SGF_DIR, file),
            name: file
        }));
}

function findPuzzleMove(content) {
    const nodes = content.split(';').slice(1);
    let moves = 0;
    for (const node of nodes) {
        if (/^[BW]\[/.test(node.trim())) moves++;
        if (node.includes('LB[') && /:[ABC]/.test(node)) {
            return moves;
        }
    }
    return 0;
}

function getRandomSGF() {
    const files = getSGFFiles();
    if (!files.length) return null;
    const randomFile = files[Math.floor(Math.random() * files.length)];
    const sgfContent = fs.readFileSync(randomFile.path, 'utf8');
    return {
        name: randomFile.name.split('_')[0],
        move: findPuzzleMove(sgfContent),
        content: sgfContent
    };
}

module.exports = { getSGFFiles, getRandomSGF };
