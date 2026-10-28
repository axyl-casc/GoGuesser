const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { getSGFFiles } = require('../server/sgf');

function createClient() {
    const handlers = {};
    const elements = new Map();
    const players = [];
    let ready;
    const element = () => ({
        style: {},
        classList: { toggle() {}, remove() {} },
        addEventListener() {},
        setAttribute() {},
        contains() { return false; }
    });
    const context = vm.createContext({
        document: {
            body: element(),
            getElementsByTagName: () => [{ src: '/wgo/wgo.min.js' }],
            getElementById(id) {
                if (!elements.has(id)) elements.set(id, element());
                return elements.get(id);
            },
            querySelectorAll: () => [],
            addEventListener(event, handler) {
                if (event === 'DOMContentLoaded') ready = handler;
            }
        },
        navigator: { userAgent: '' },
        location: { search: '', hash: '' },
        addEventListener() {},
        localStorage: { getItem() { return null; }, setItem() {} },
        URLSearchParams,
        clearTimeout,
        ResizeObserver: class { observe() {} },
        io: () => ({ connected: true, on(event, handler) { handlers[event] = handler; } })
    });
    context.window = context;
    for (const file of ['wgo/wgo.min.js', 'wgo/wgo.player.min.js', 'boardRotation.js', 'main.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../public', file), 'utf8'), context);
    }

    // Keep the shipped parser, replay, and markup renderer; replace only the canvas UI.
    const { WGo } = context;
    WGo.BasicPlayer = function(container, config) {
        const player = Object.create(WGo.Player.prototype);
        player.config = Object.assign({}, WGo.Player.default, config);
        player.element = container;
        player.board = {
            element: container,
            theme: {},
            setSize(size) { this.size = size; },
            addEventListener() {},
            addCustomObject() {},
            removeAllObjects() {},
            removeObject() {},
            addObject() {},
            update() {}
        };
        player.init();
        players.push(player);
        return player;
    };
    ready();

    return {
        show(content, rotation) {
            const reader = new WGo.KifuReader(WGo.Kifu.fromSgf(content));
            while (!(reader.node.markup || []).some(mark => mark.type === 'LB')) reader.next();
            handlers['sgf-data']({ content, rotation, move: reader.path.m, timer: 30, waiting: false });
            const player = players[0];
            const labels = Array.from(player.temp_marks).filter(mark => mark.type === 'LB');
            assert.deepEqual(labels.map(mark => mark.text).sort(), ['A', 'B', 'C']);
            assert.deepEqual(labels, Array.from(player.kifuReader.node.markup).filter(mark => mark.type === 'LB'));
            assert.equal(players.length, 1, 'Rounds must reuse the same player');
        }
    };
}

test('puzzle choices exclude automatic variation letters across rotations and rounds', () => {
    const client = createClient();
    // The first variation is a game continuation outside the three puzzle choices.
    const content = '(;SZ[9]LB[aa:A][ba:B][ca:C]C[Answer:B](;B[dd])(;B[aa])(;B[ba])(;B[ca]))';
    for (let rotation = 0; rotation < 4; rotation++) client.show(content, rotation);
});

test('every bundled puzzle displays exactly one A, B, and C in every orientation', () => {
    const client = createClient();
    for (const file of Array.from({ length: 12 }, (_, index) => getSGFFiles(index + 1)).flat()) {
        const content = fs.readFileSync(file.path, 'utf8');
        for (let rotation = 0; rotation < 4; rotation++) {
            assert.doesNotThrow(() => client.show(content, rotation), `${file.name}, rotation ${rotation}`);
        }
    }
});
