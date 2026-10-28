const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { SGF_DIR } = require('../server/config');

function setup(t, folders, initialMonth) {
    delete require.cache[require.resolve('../server/sgf')];
    const sgf = require('../server/sgf');
    let month = initialMonth;
    t.mock.method(Date.prototype, 'getMonth', () => month - 1);
    t.mock.method(fs, 'readdirSync', directory => {
        const files = folders[path.basename(directory)];
        if (!files) throw Object.assign(new Error('Missing month'), { code: 'ENOENT' });
        return files.map(name => ({ name, isFile: () => !name.endsWith('/') }));
    });
    t.mock.method(fs, 'readFileSync', filename => {
        assert.equal(path.dirname(filename), path.join(SGF_DIR, String(month)));
        return `(;C[${path.basename(filename)} Answer:A])`;
    });
    return {
        ...sgf,
        setMonth(value) { month = value; }
    };
}

test('lists only SGF files from the current numbered month folder', t => {
    const { getSGFFiles } = setup(t, {
        1: ['january.sgf'],
        10: ['october.sgf', 'notes.txt', 'nested.sgf/']
    }, 10);
    assert.deepEqual(getSGFFiles(), [{
        name: 'october.sgf',
        path: path.join(SGF_DIR, '10', 'october.sgf')
    }]);
});

test('uses every monthly puzzle before repeating and discards leftovers on month changes', t => {
    const { getRandomSGF, setMonth } = setup(t, {
        12: ['december-a.sgf', 'december-b.sgf'],
        1: ['january.sgf']
    }, 12);
    const firstCycle = [getRandomSGF().name, getRandomSGF().name];
    assert.deepEqual(firstCycle.sort(), ['december-a.sgf', 'december-b.sgf']);
    assert.ok(firstCycle.includes(getRandomSGF().name));
    setMonth(1);
    assert.equal(getRandomSGF().name, 'january.sgf');
});

test('missing or empty monthly folders return no puzzle and never use the previous month', t => {
    const { getRandomSGF, setMonth } = setup(t, {
        1: ['january-a.sgf', 'january-b.sgf'],
        3: []
    }, 1);
    assert.ok(getRandomSGF());
    setMonth(2);
    assert.equal(getRandomSGF(), null);
    setMonth(3);
    assert.equal(getRandomSGF(), null);
});
