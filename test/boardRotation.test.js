const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { rotateKifu } = require('../public/boardRotation');
const { getSGFFiles, getRandomSGF } = require('../server/sgf');
const initSocket = require('../server/socketHandlers');

// Use the actual SGF parser and Go rules without creating a canvas or browser.
const context = vm.createContext({
    document: { getElementsByTagName: () => [{ src: '/wgo/wgo.js' }] },
    navigator: { userAgent: '' }
});
context.window = context;
for (const file of ['wgo.js', 'kifu.js', 'sgfparser.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/wgo', file), 'utf8'), context);
}
const { WGo } = context;
const parse = content => WGo.Kifu.fromSgf(content);
const fixture = '(;SZ[9]AB[aa][bi]AW[ic]AE[de]PL[W]LB[ca:A][dc:B][hd:C]TR[cc]C[Keep aa and Answer:B as text];W[];B[tt](;W[bc]SQ[de])(;W[ef]CR[fg]))';
const coordinates = point => [point.x, point.y];

const orientations = [
    { corner: [0, 0], label: [2, 0], branch: [1, 2] },
    { corner: [8, 0], label: [8, 2], branch: [6, 1] },
    { corner: [8, 8], label: [6, 8], branch: [7, 6] },
    { corner: [0, 8], label: [0, 6], branch: [2, 7] }
];

for (const [rotation, expected] of orientations.entries()) {
    test(`${rotation * 90}° keeps setups, labels, passes, and variations aligned`, () => {
        const kifu = rotateKifu(parse(fixture), rotation);
        assert.deepEqual(coordinates(kifu.root.setup[0]), expected.corner);
        assert.deepEqual(coordinates(kifu.root.markup[0]), expected.label);
        assert.equal(kifu.root.markup[0].text, 'A');
        assert.equal(kifu.root.comment, 'Keep aa and Answer:B as text');
        assert.equal(kifu.root.turn, WGo.W);

        const whitePass = kifu.root.children[0];
        const blackPass = whitePass.children[0];
        assert.equal(whitePass.move.pass, true);
        assert.equal(blackPass.move.pass, true);
        assert.equal('x' in whitePass.move, false);
        assert.equal('x' in blackPass.move, false);
        assert.equal(blackPass.children.length, 2);
        assert.deepEqual(coordinates(blackPass.children[0].move), expected.branch);
        assert.equal(blackPass.children[1].markup[0].type, 'CR');

        // Both variations must still be legal after the transformed setup and passes.
        for (const variation of [0, 1]) {
            const reader = new WGo.KifuReader(kifu);
            reader.next().next().next(variation);
            assert.equal(reader.path.m, 3);
            assert.equal(reader.game.turn, WGo.B);
        }
    });
}

test('four quarter turns restore the full record, including setup removals and marks', () => {
    const kifu = parse(fixture);
    const original = kifu.toJGO(true);
    for (let i = 0; i < 4; i++) rotateKifu(kifu, 1);
    assert.equal(kifu.toJGO(true), original);
});

test('an omitted rotation leaves an older server payload unchanged', () => {
    const kifu = parse(fixture);
    const original = kifu.toJGO(true);
    assert.equal(rotateKifu(kifu), kifu);
    assert.equal(kifu.toJGO(true), original);
});

const transforms = [
    (x, y, size) => [x, y],
    (x, y, size) => [size - 1 - y, x],
    (x, y, size) => [size - 1 - x, size - 1 - y],
    (x, y, size) => [y, size - 1 - x]
];

function readProblem(kifu) {
    const reader = new WGo.KifuReader(kifu);
    while (!(reader.node.markup || []).some(mark => mark.type === 'LB' && mark.text === 'A')) {
        assert.ok(reader.node.children.length, 'The record must contain a labeled problem');
        reader.next();
    }
    return reader;
}

for (const file of Array.from({ length: 12 }, (_, index) => getSGFFiles(index + 1)).flat()) {
    test(`${file.name}: all orientations preserve the playable position and answer labels`, () => {
        const content = fs.readFileSync(file.path, 'utf8');
        const original = readProblem(parse(content));
        for (let rotation = 0; rotation < 4; rotation++) {
            const rotated = readProblem(rotateKifu(parse(content), rotation));
            const size = rotated.kifu.size;
            assert.equal(rotated.game.turn, original.game.turn);
            assert.equal(rotated.path.m, original.path.m);
            assert.equal(rotated.node.comment, original.node.comment);
            assert.equal(JSON.stringify(rotated.getPosition().capCount), JSON.stringify(original.getPosition().capCount));
            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    const [rx, ry] = transforms[rotation](x, y, size);
                    assert.equal(rotated.getPosition().get(rx, ry), original.getPosition().get(x, y));
                }
            }
            for (const label of original.node.markup.filter(mark => mark.type === 'LB')) {
                const actual = rotated.node.markup.find(mark => mark.type === 'LB' && mark.text === label.text);
                assert.ok(actual, `Missing answer label ${label.text}`);
                assert.deepEqual(coordinates(actual), transforms[rotation](label.x, label.y, size));
            }
        }
    });
}

test('round selection can produce each of the four orientations without changing the answer', t => {
    let randomValue;
    t.mock.method(Math, 'random', () => randomValue);
    for (const rotation of [0, 1, 2, 3]) {
        randomValue = (rotation + 0.5) / 4;
        const problem = getRandomSGF();
        assert.equal(problem.rotation, rotation);
        assert.equal(problem.answer, problem.content.match(/Answer:([ABC])/)[1]);
    }
});

test('joining and reconnecting players receive the same orientation as the current round', () => {
    const handlers = {};
    let broadcast;
    const io = {
        use() {},
        on(event, handler) { handlers[event] = handler; },
        emit(event, data) { if (event === 'sgf-data') broadcast = data; }
    };
    const { sendNewSGF } = initSocket(io, () => {});
    sendNewSGF();
    assert.ok([0, 1, 2, 3].includes(broadcast.rotation));
    for (let connection = 0; connection < 2; connection++) {
        let received;
        handlers.connection({
            request: { session: { user: 'Rotation test' } },
            on() {},
            emit(event, data) { if (event === 'sgf-data') received = data; }
        });
        assert.equal(received.rotation, broadcast.rotation);
        assert.equal(received.content, broadcast.content);
        assert.equal(received.answer, broadcast.answer);
    }
});
