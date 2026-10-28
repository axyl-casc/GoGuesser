const fs = require('fs');
const path = require('path');
const { SGF_DIR } = require('./config');

function getSGFFiles(month = new Date().getMonth() + 1) {
    const monthDir = path.join(SGF_DIR, String(month));
    let entries;
    try {
        entries = fs.readdirSync(monthDir, { withFileTypes: true });
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
    return entries
        .filter(file => file.isFile() && path.extname(file.name) === '.sgf')
        .map(file => ({
            path: path.join(monthDir, file.name),
            name: file.name
        }));
}

function findPuzzleMove(content) {
    const nodes = content.split(';').slice(1);
    let moves = 0;
    for (const node of nodes) {
        const moveMatches = node.match(/(?:^|[^A-Z])(?:B|W)\[[^\]]+\]/g);
        if (moveMatches) {
            moves += moveMatches.length;
        }
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
let selectedMonth = null;

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function repopulateSGFs(month) {
    remainingSGFs = shuffle(getSGFFiles(month));
    selectedMonth = month;
}

function getRandomSGF() {
    const month = new Date().getMonth() + 1;
    if (selectedMonth !== month || remainingSGFs.length === 0) {
        repopulateSGFs(month);
    }

    if (remainingSGFs.length === 0) return null;

    const randomFile = remainingSGFs.pop();

    const sgfContent = fs.readFileSync(randomFile.path, 'utf8');
    return {
        name: randomFile.name.split('_')[0],
        // Pick once per round so all players and reconnects share an orientation.
        rotation: Math.floor(Math.random() * 4),
        move: findPuzzleMove(sgfContent),
        content: sgfContent,
        answer: findAnswer(sgfContent)
    };
}

module.exports = { getSGFFiles, getRandomSGF };
