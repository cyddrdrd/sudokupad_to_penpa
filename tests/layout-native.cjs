'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {fixture, clone, createReference} = require('./harness.cjs');
const {create} = require('../layout.js');

function reference(layout) {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'reference/penpa-surface-reference.js'), 'utf8'), context);
  const pu = new context.PenpaSurfaceReference();
  Object.assign(pu, {nx0: layout.cols + 4, ny0: layout.rows + 4, size: 38,
    corner_table: [], mode: {grid: ['1', '2', '2']}, grid_is_square: () => true,
    centerlist: Array.from({length: layout.sourceRows * layout.sourceCols}, (_, i) =>
      layout.cellId(Math.floor(i / layout.sourceCols), i % layout.sourceCols))});
  pu.create_point(); pu.make_frameline();
  return pu;
}

test('undecorated puzzles and paths on the outer grid border need no extra cells', () => {
  const p = fixture({rows: 4, cols: 5});
  p.lines = [{wayPoints: [[0, 0], [0, 5], [4, 5], [4, 0], [0, 0]]}];
  const layout = create(p);
  assert.deepEqual(layout.space, [0, 0, 0, 0]);
  assert.equal(layout.rows, 4); assert.equal(layout.cols, 5);
  assert.equal(layout.cellId(0, 0), 20);
});

test('five top and six left clue rows have real independent interaction cells without outside frame edges', () => {
  const p = fixture({rows: 16, cols: 16});
  p.overlays = [];
  // The reported puzzle uses these same baseline/centre coordinates. Cover
  // every outside cell rather than depending on a private puzzle payload.
  for (let r = -5; r < 0; r++) for (let c = 0; c < 16; c++) p.overlays.push({center: [r + .7, c + .5], text: '?'});
  for (let r = 0; r < 16; r++) for (let c = -6; c < 0; c++) p.overlays.push({center: [r + .7, c + .5], text: '??'});
  const before = clone(p), layout = create(p), pu = reference(layout);
  assert.deepEqual(layout.space, [5, 0, 6, 0]);
  assert.equal(layout.rows, 21); assert.equal(layout.cols, 22);
  assert.equal(pu.centerlist.length, 256);
  const origin = pu.point[layout.cellId(0, 0)], seen = new Set();
  for (const label of p.overlays) {
    const r = Math.floor(label.center[0]), c = Math.floor(label.center[1]);
    const id = layout.cellId(r, c), point = pu.point[id];
    assert.equal(point.use, 1, 'each outside clue has a usable real Penpa cell');
    assert.equal(point.type, 0);
    assert.equal(point.x, origin.x + c * pu.size); assert.equal(point.y, origin.y + r * pu.size);
    assert.equal(pu.centerlist.includes(id), false);
    assert.equal(seen.has(id), false); seen.add(id);
  }
  assert.equal(seen.size, 176);
  assert.equal(Object.keys(pu.frame).length, 16 * 17 * 2);
  for (const edge of Object.keys(pu.frame)) for (const id of edge.split(',').map(Number)) {
    const point = pu.point[id];
    assert.ok(point.x >= origin.x - pu.size / 2 && point.x <= origin.x + 15.5 * pu.size);
    assert.ok(point.y >= origin.y - pu.size / 2 && point.y <= origin.y + 15.5 * pu.size);
  }
  assert.deepEqual(p, before);
});

test('right and bottom clue objects allocate margins independently', () => {
  const p = fixture({rows: 4, cols: 5});
  p.overlays = [{center: [6.5, 7.5], width: 1, height: 1}];
  p.lines = [{wayPoints: [[0, 0], [-2, 0]]}];
  const layout = create(p);
  assert.deepEqual(layout.space, [2, 3, 0, 3]);
  const pu = reference(layout);
  assert.equal(pu.point[layout.cellId(6, 7)].use, 1);
  assert.equal(pu.point[layout.cellId(-2, 0)].use, 1);
});

test('optional raw-path bounds reserve points without changing the source dimensions', () => {
  const layout = create(fixture({rows: 2, cols: 3}), {bounds: {left: -384, top: -320, right: 192, bottom: 128}});
  assert.deepEqual(layout.space, [5, 0, 6, 0]);
  assert.equal(layout.sourceRows, 2); assert.equal(layout.sourceCols, 3);
  assert.equal(Object.hasOwn(layout, 'width'), false, 'margin allocation must not add canvas whitespace');
});

test('all twelve native point bands retain their exact relative positions', () => {
  const p = fixture({rows: 2, cols: 3}), original = create(p), before = reference(original);
  p.overlays = [{center: [-3.3, -4.5], text: '?'}];
  const layout = create(p), after = reference(layout);
  const dx = layout.left * before.size, dy = layout.top * before.size;
  for (let id = 0; id < before.point.length; id++) {
    const moved = after.point[layout.pointId(id)];
    assert.equal(moved.type, before.point[id].type);
    assert.ok(Math.abs(moved.x - before.point[id].x - dx) < 1e-9);
    assert.ok(Math.abs(moved.y - before.point[id].y - dy) < 1e-9);
  }
  assert.equal(layout.pointId('16E'), layout.pointId(16) + 'E');
  assert.equal(layout.pointId(-1), -1);
});

test('half-cell canvas centres retain alignment after adding margins', () => {
  const p = fixture({rows: 2, cols: 3});
  p.overlays = [{center: [-3.3, -4.5], text: '?'}];
  const layout = create(p), pu = reference(layout), origin = pu.point[layout.cellId(0, 0)];
  for (const x of [-2.5, 0, .5, 1]) for (const y of [-2, 0, .5, 1]) {
    const center = pu.point[layout.centerId(x, y)];
    assert.equal(center.x - origin.x, (x - .5) * pu.size);
    assert.equal(center.y - origin.y, (y - .5) * pu.size);
  }
  assert.throws(() => layout.centerId(.2, 0), /half-cell/);
});

test('native drawings and stored answer values keep their relationships after remapping', () => {
  const p = fixture({rows: 2, cols: 3}), old = create(p), ref = createReference({rows: 2, cols: 3});
  p.overlays = [{center: [-2.3, -3.5], text: '?'}];
  const layout = create(p), a = old.cellId(0, 0), b = old.cellId(0, 1);
  const q = clone(ref.puzzle.pu_q);
  q.number[a] = ['12', 1, '1']; q.number[b + 'E'] = ['23', 1, '10'];
  q.line[a + ',' + b] = 2; q.thermo = [[a, b]];
  const moved = layout.remapLayer(q);
  assert.deepEqual(moved.number[layout.cellId(0, 0)], ['12', 1, '1']);
  assert.deepEqual(moved.number[layout.cellId(0, 1) + 'E'], ['23', 1, '10']);
  assert.equal(moved.line[layout.cellId(0, 0) + ',' + layout.cellId(0, 1)], 2);
  assert.deepEqual(moved.thermo, [[layout.cellId(0, 0), layout.cellId(0, 1)]]);
  const answer = [[String(a), [b, 6]], [a + ',' + b + ',1'], [], [a + ',' + b], [b + ',123'], [a + ',1A']];
  const actual = layout.remapAnswer(answer);
  assert.ok(actual[0].some(entry => Array.isArray(entry) && entry[0] === layout.cellId(0, 1) && entry[1] === 6));
  assert.deepEqual(actual[1], [layout.cellId(0, 0) + ',' + layout.cellId(0, 1) + ',1']);
  assert.deepEqual(actual[4], [layout.cellId(0, 1) + ',123']);
  assert.deepEqual(actual[5], [layout.cellId(0, 0) + ',1A']);
});

test('hidden objects do not reserve invisible margins and excessive extents are rejected', () => {
  const p = fixture();
  p.overlays = [{center: [-500, -500], hidden: true}, {center: [500, 500], opacity: 0}];
  assert.deepEqual(create(p).space, [0, 0, 0, 0]);
  p.overlays.push({center: [-101, 0]});
  assert.throws(() => create(p), /100 × 100/);
});
