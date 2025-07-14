const bannedWords = [
    'fuck',
    'shit',
    'damn',
    'crap',
    'bitch',
    'asshole'
];

function filterSwears(text) {
    const regex = new RegExp(`\\b(${bannedWords.join('|')})\\b`, 'gi');
    return text.replace(regex, match => '*'.repeat(match.length));
}

module.exports = filterSwears;
