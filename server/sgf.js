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

function findAnswer(content) {
    const match = content.match(/Answer:([ABC])/);
    return match ? match[1] : null;
}

function getRandomSGF(excludeName = null) {
    const files = getSGFFiles();
    if (!files.length) return null;

    let randomFile = files[Math.floor(Math.random() * files.length)];

    // Try to avoid returning the same file consecutively when possible
    if (excludeName && files.length > 1) {
        let attempts = 0;
        while (randomFile.name === excludeName && attempts < 10) {
            randomFile = files[Math.floor(Math.random() * files.length)];
            attempts++;
        }
    }

    const sgfContent = fs.readFileSync(randomFile.path, 'utf8');
    return {
        name: randomFile.name.split('_')[0],
        move: findPuzzleMove(sgfContent),
        content: sgfContent,
        answer: findAnswer(sgfContent)
    };
}

module.exports = { getSGFFiles, getRandomSGF };
