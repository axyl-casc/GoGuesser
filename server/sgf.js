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

// Keep a shuffled list of SGF files to ensure each puzzle is used once
let remainingSGFs = [];

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function repopulateSGFs() {
    remainingSGFs = shuffle(getSGFFiles());
}

function getRandomSGF() {
    if (remainingSGFs.length === 0) {
        repopulateSGFs();
    }

    if (remainingSGFs.length === 0) return null;

    const randomFile = remainingSGFs.pop();

    const sgfContent = fs.readFileSync(randomFile.path, 'utf8');
    return {
        name: randomFile.name.split('_')[0],
        move: findPuzzleMove(sgfContent),
        content: sgfContent,
        answer: findAnswer(sgfContent)
    };
}

module.exports = { getSGFFiles, getRandomSGF };
