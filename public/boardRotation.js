// Rotate a freshly parsed record before replay, including every variation.
function rotateKifu(kifu, quarterTurns = 0) {
    const turns = ((quarterTurns % 4) + 4) % 4;
    if (!Number.isInteger(turns)) throw new RangeError('Rotation must use whole quarter turns.');
    if (turns === 0) return kifu;

    function rotatePoint(point) {
        for (let turn = 0; turn < turns; turn++) {
            const x = point.x;
            point.x = kifu.size - 1 - point.y;
            point.y = x;
        }
    }

    const pending = [kifu.root];
    while (pending.length) {
        const node = pending.pop();
        if (node.move && !node.move.pass) rotatePoint(node.move);
        for (const stone of node.setup || []) rotatePoint(stone);
        for (const mark of node.markup || []) rotatePoint(mark);
        for (const child of node.children) pending.push(child);
    }
    return kifu;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { rotateKifu };
