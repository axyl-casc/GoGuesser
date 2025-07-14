const bannedWords = require('profane-words');

function escapeRegex(word) {
    return word.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

const regex = new RegExp(`(?:${bannedWords.map(escapeRegex).join('|')})`, 'gi');

function filterSwears(text) {
    return text.replace(regex, match => '*'.repeat(match.length));
}

module.exports = filterSwears;
