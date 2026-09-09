'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {loadApp, decodePenpa, fixture} = require('./harness.cjs');

const oracle = fs.readFileSync(path.join(__dirname, 'reference/penpa-surface-reference.js'), 'utf8');

function referenceDrawing(decoded) {
  const events = [];
  const context = vm.createContext({UserSettings: {show_solution: false},
    set_line_style(ctx, style) { ctx.style = style; }});
  vm.runInContext(oracle, context);
  const pu = new context.PenpaSurfaceReference();
  Object.assign(pu, {nx0: decoded.cols + 4, ny0: decoded.rows + 4, size: 38,
    mode: JSON.parse(decoded.lines[11]), centerlist: decoded.centerlist,
    corner_table: [], pu_q: decoded.question, pu_a: {surface: {}}, grid_is_square: () => true});
  pu.create_point();
  pu.make_frameline();
  let start, end;
  pu.ctx = {beginPath() {}, moveTo(x, y) { start = [x, y]; }, lineTo(x, y) { end = [x, y]; },
    stroke() { events.push({kind: 'frame', style: this.style, start, end}); }};
  // Run Penpa's actual square draw order and frame renderer. Drawing methods
  // unrelated to frame layering are stubs, while Surface records its draw time.
  for (const name of oracle.matchAll(/this\.(draw_\w+)\(/g)) {
    if (typeof pu[name[1]] !== 'function') pu[name[1]] = () => {};
  }
  pu.draw_surface = layer => {
    for (const id of Object.keys(pu[layer].surface)) events.push({kind: 'surface', layer, id});
  };
  return {pu, events};
}

function cellEdge(pu, id, side) {
  const vertices = pu.point[id].surround;
  return [vertices[side], vertices[(side + 1) % 4]].sort((a, b) => a - b).join(',');
}

function edgeWasDrawn(pu, events, key) {
  const [a, b] = key.split(',').map(id => pu.point[id]);
  return events.some(event => event.kind === 'frame' && event.style !== 0 &&
    ((event.start[0] === a.x && event.start[1] === a.y && event.end[0] === b.x && event.end[1] === b.y) ||
     (event.start[0] === b.x && event.start[1] === b.y && event.end[0] === a.x && event.end[1] === a.y)));
}

test('Penpa redraws the boundary between adjacent Surface fills after the fills', () => {
  const decoded = decodePenpa(loadApp().convertPuzzle(fixture({rows: 3, cols: 3})).url);
  const {pu, events} = referenceDrawing(decoded);
  pu.pu_a.surface[decoded.centerlist[0]] = 6;
  pu.pu_a.surface[decoded.centerlist[3]] = 6;
  pu.draw();
  const sharedEdge = cellEdge(pu, decoded.centerlist[0], 2);
  assert.equal(edgeWasDrawn(pu, events, sharedEdge), true);
  const lastSurface = events.findLastIndex(event => event.kind === 'surface');
  const firstFrame = events.findIndex(event => event.kind === 'frame');
  assert.ok(lastSurface >= 0 && firstFrame > lastSurface, 'native lines must be drawn above opaque cell fills');
  assert.equal(decoded.background.foreground, false, 'artwork must not paint over solver digits and lines');
});

test('a white overlay mask keeps the intersecting native grid and region edge hidden', () => {
  const p = fixture({rows: 2, cols: 2});
  p.regions = [[[0, 0]], [[0, 1]]];
  p.overlays = [{center: [.5, 1], width: .4, height: .4, rounded: true,
    backgroundColor: '#FFFFFF', borderColor: '#000000'}];
  const decoded = decodePenpa(loadApp().convertPuzzle(p).url);
  const {pu, events} = referenceDrawing(decoded);
  pu.pu_a.surface[decoded.centerlist[0]] = 6;
  pu.draw();
  const masked = cellEdge(pu, decoded.centerlist[0], 1);
  assert.ok(decoded.question.deletelineE[masked]);
  assert.equal(decoded.question.lineE[masked], undefined);
  assert.equal(edgeWasDrawn(pu, events, masked), false);
  assert.equal(edgeWasDrawn(pu, events, cellEdge(pu, decoded.centerlist[0], 3)), true);
  assert.match(decoded.svg, /fill="#FFFFFF"/);
  assert.match(decoded.svg, /data-layer="cell-grids"><path/,
    'the original edge still belongs to the image below its mask');
});

test('retargeted post-grid underlays preserve masks while normal underlays keep their grid', () => {
  const p = fixture({rows: 2, cols: 2});
  const mask = {center: [.5, 1], width: .4, height: .4, backgroundColor: '#FFFFFF'};
  p.underlays = [mask];
  let decoded = decodePenpa(loadApp().convertPuzzle(p).url);
  assert.deepEqual(decoded.question.deletelineE, {});
  p.underlays = [{...mask, target: 'overlay'}];
  decoded = decodePenpa(loadApp().convertPuzzle(p).url);
  const {pu} = referenceDrawing(decoded);
  assert.ok(decoded.question.deletelineE[cellEdge(pu, decoded.centerlist[0], 1)]);
});

test('a hidden grid stays hidden while explicit region borders remain usable with Surface', () => {
  const p = fixture({rows: 2, cols: 2});
  p.settings = {nogrid: true};
  p.regions = [[[0, 0], [0, 1]]];
  const decoded = decodePenpa(loadApp().convertPuzzle(p).url);
  const {pu, events} = referenceDrawing(decoded);
  pu.draw();
  assert.equal(events.filter(event => event.kind === 'frame' && event.style !== 0).length, 0);
  assert.equal(Object.keys(decoded.question.lineE).length, 6);
  assert.equal(decoded.question.lineE[cellEdge(pu, decoded.centerlist[0], 1)], undefined,
    'the internal edge of a region is not a thick border');
});

test('native dashed grid remains dashed without a second mismatched dash pattern in the image', () => {
  const p = fixture();
  p.settings = {dashedgrid: true};
  const decoded = decodePenpa(loadApp().convertPuzzle(p).url);
  const {pu, events} = referenceDrawing(decoded);
  pu.draw();
  const strokes = events.filter(event => event.kind === 'frame');
  assert.ok(strokes.length > 0 && strokes.every(event => event.style === 11));
  assert.doesNotMatch(decoded.svg, /stroke-dasharray="3 10"/);
});

for (const [rows, cols] of [[1, 1], [2, 3], [3, 2], [4, 4]]) {
  test(`${rows} by ${cols} region borders use real Penpa vertices and omit shared cell edges`, () => {
    const p = fixture({rows, cols});
    p.regions = [p.cells.flatMap((row, r) => row.map((_, c) => [r, c]))];
    const decoded = decodePenpa(loadApp().convertPuzzle(p).url);
    const {pu} = referenceDrawing(decoded);
    assert.equal(Object.keys(decoded.question.lineE).length, 2 * rows + 2 * cols);
    for (const key of Object.keys(decoded.question.lineE)) {
      const points = key.split(',').map(id => pu.point[id]);
      assert.ok(points.every(point => point && point.type === 1));
      assert.equal(Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), pu.size);
    }
  });
}

test('colored box borders stay in the artwork without becoming native black borders', () => {
  const p = fixture();
  p.cages = [{cells: [[0, 0], [0, 1]], style: 'box', borderColor: '#FF0000'}];
  const decoded = decodePenpa(loadApp().convertPuzzle(p).url);
  assert.deepEqual(decoded.question.lineE, {});
  assert.match(decoded.svg, /stroke="#FF0000"/);
});

test('only supported named cage styles are accepted, never inherited properties or CSS', () => {
  for (const style of ['constructor', '__proto__', 'toString', 'fill:red']) {
    const p = fixture();
    p.cages = [{cells: [[0, 0]], style}];
    assert.throws(() => loadApp().convertPuzzle(p), /unsupported cage style/);
  }
});

test('stroke-only overlay text still protects the grid it covers', () => {
  const p = fixture();
  p.overlays = [{center: [.5, 1], width: 0, height: 0, text: 'X', fontSize: 20,
    textColor: 'none', textStroke: '#FFFFFF'}];
  const decoded = decodePenpa(loadApp().convertPuzzle(p).url);
  const {pu} = referenceDrawing(decoded);
  assert.ok(decoded.question.deletelineE[cellEdge(pu, decoded.centerlist[0], 1)]);
});
