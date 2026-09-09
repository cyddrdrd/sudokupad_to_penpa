'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {loadApp, decodePenpa, fixture} = require('./harness.cjs');

// Coordinates of the four point bands created by Penpa's square grid.
function penpaPoint(id, rows, cols, size) {
  const stride = cols + 4, count = stride * (rows + 4);
  assert.ok(Number.isInteger(id) && id >= 0 && id < 4 * count);
  const band = Math.floor(id / count), index = id % count;
  const offsets = [[.5, .5], [1, 1], [.5, 1], [1, .5]][band];
  return [(index % stride + offsets[0]) * size,
    (Math.floor(index / stride) + offsets[1]) * size];
}

function checkAlignment(puzzle) {
  const decoded = decodePenpa(loadApp().convertPuzzle(puzzle).url);
  const {rows, cols, header, background, svg} = decoded;
  const size = Number(header[3]), width = Number(header[7]), height = Number(header[8]);
  const [originX, originY] = /<g transform="translate\(([-\d.]+) ([-\d.]+)\)/.exec(svg).slice(1).map(Number);
  const center = penpaPoint(Number(header[9]), rows, cols, size);
  assert.equal(background.width, width);
  assert.equal(background.height, height);
  assert.equal(header[9], header[10]);
  for (const [index, id] of decoded.centerlist.entries()) {
    const native = penpaPoint(id, rows, cols, size);
    const x = native[0] + width / 2 - center[0] + .5;
    const y = native[1] + height / 2 - center[1] + .5;
    assert.ok(Math.abs(x - (originX + (index % cols + .5) * size)) < .001,
      'native cell and surface x coordinate must match the artwork');
    assert.ok(Math.abs(y - (originY + (Math.floor(index / cols) + .5) * size)) < .001,
      'native cell and surface y coordinate must match the artwork');
  }
  return {decoded, width, height, size, originX, originY};
}

for (const [rows, cols] of [[2, 3], [3, 2], [2, 2], [3, 3]]) {
  test(`an undecorated ${rows} × ${cols} grid retains its original canvas and alignment`, () => {
    const layout = checkAlignment(fixture({rows, cols}));
    assert.equal(layout.width, (cols + 1) * layout.size);
    assert.equal(layout.height, (rows + 1) * layout.size);
  });
}

for (const [side, center] of [['left', [1, -3]], ['top', [-3, 1]],
  ['right', [1, 7]], ['bottom', [7, 1]]]) {
  test(`outside artwork on the ${side} does not add matching blank space on the opposite side`, () => {
    const puzzle = fixture({rows: 4, cols: 4});
    puzzle.cells[0][0].value = '1';
    puzzle.underlays = [{center, width: 1, height: 1, backgroundColor: '#CFCFCF'}];
    const {decoded, width, height, size, originX, originY} = checkAlignment(puzzle);
    const [r, c] = center;
    assert.ok(originX + (c - .5) * size >= 0);
    assert.ok(originY + (r - .5) * size >= 0);
    assert.ok(originX + (c + .5) * size <= width);
    assert.ok(originY + (r + .5) * size <= height);
    const oppositeMargin = {left: width - originX - 4 * size, right: originX,
      top: height - originY - 4 * size, bottom: originY}[side];
    assert.ok(oppositeMargin <= size, 'the empty side should have at most one cell of normal padding');
    assert.deepEqual(Object.values(decoded.question.number), [['1', 1, '1']]);
  });
}

test('a 16 × 16 grid with six cells of top and left clues has normal right and bottom margins', () => {
  const puzzle = fixture({rows: 16, cols: 16});
  puzzle.underlays = [{center: [5, 5], width: 22, height: 22, backgroundColor: '#FFFFFF00'}];
  const {width, height, size, originX, originY} = checkAlignment(puzzle);
  assert.equal(width, 23 * size);
  assert.equal(height, 23 * size);
  assert.ok(width - originX - 16 * size < size);
  assert.ok(height - originY - 16 * size < size);
});

test('distant artwork retains valid Penpa centering points and stays inside the canvas', () => {
  for (const center of [[-12, -12], [15, 15]]) {
    const puzzle = fixture({rows: 2, cols: 3});
    puzzle.overlays = [{center, width: 1, height: 1, backgroundColor: '#CFCFCF'}];
    const {width, height, size, originX, originY} = checkAlignment(puzzle);
    assert.ok(originX + (center[1] - .5) * size >= 0);
    assert.ok(originY + (center[0] - .5) * size >= 0);
    assert.ok(originX + (center[1] + .5) * size <= width);
    assert.ok(originY + (center[0] + .5) * size <= height);
  }
});
