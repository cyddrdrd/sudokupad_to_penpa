'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {loadApp, decodePenpa, fixture} = require('./harness.cjs');

const oracle = fs.readFileSync(path.join(__dirname, 'reference/penpa-surface-reference.js'), 'utf8');
const adapter = fs.readFileSync(path.join(__dirname, '../penpa-adapter.js'), 'utf8');
const convert = puzzle => decodePenpa(loadApp().convertPuzzle(puzzle).url);

function layer(svg, name) {
  const marker = '<g data-layer="' + name + '">', start = svg.indexOf(marker);
  assert.ok(start >= 0, 'expected SVG layer ' + name);
  const next = svg.indexOf('<g data-layer="', start + marker.length);
  return svg.slice(start + marker.length, next < 0 ? undefined : next);
}

function referenceDrawing(decoded) {
  const events = [];
  const context = vm.createContext({UserSettings: {show_solution: false},
    set_line_style(ctx, style) { ctx.style = style; }});
  vm.runInContext(oracle, context);
  const Type = context.PenpaSurfaceReference;
  // Preserve the actual square-grid draw order and frame renderer; record
  // unrelated rendering. Install the shipped adapter on the same prototype.
  for (const match of oracle.matchAll(/this\.(draw_\w+)\(/g)) {
    if (typeof Type.prototype[match[1]] !== 'function') Type.prototype[match[1]] = () => {};
  }
  Type.prototype.draw_surface = function (which) {
    for (const id of Object.keys(this[which].surface)) events.push({kind: 'surface', layer: which, id});
  };
  Type.prototype.draw_bg_image = () => events.push({kind: 'legacy-image'});
  Type.prototype.draw_number = which => events.push({kind: 'number', layer: which});
  context.Puzzle = Type;
  vm.runInContext(adapter, context);
  const pu = new Type();
  Object.assign(pu, {gridtype: 'square', nx0: decoded.cols + 4, ny0: decoded.rows + 4, size: 38,
    mode: JSON.parse(decoded.lines[11]), centerlist: decoded.centerlist,
    corner_table: [], pu_q: decoded.question, pu_a: {surface: {}}, grid_is_square: () => true,
    bg_image_data: decoded.background, bg_image: {}, bg_image_canvas: {svg: decoded.svg}});
  pu.create_point(); pu.make_frameline();
  let start, end;
  pu.ctx = {beginPath() {}, moveTo(x, y) { start = [x, y]; }, lineTo(x, y) { end = [x, y]; },
    stroke() { events.push({kind: 'frame', style: this.style, start, end}); },
    drawImage(image, ...rect) { events.push({kind: 'image', svg: image.svg, rect}); }};
  return {pu, events};
}

function noNativeArtwork(decoded) {
  assert.deepEqual(JSON.parse(decoded.lines[11]).grid, ['3', '2', '2']);
  for (const name of ['line', 'lineE', 'numberS', 'deletelineE']) assert.deepEqual(decoded.question[name], {});
}

test('complete imported grids are drawn after adjacent Surface fills and before solving numbers', () => {
  const decoded = convert(fixture({rows: 3, cols: 3}));
  const {pu, events} = referenceDrawing(decoded);
  pu.pu_a.surface[decoded.centerlist[0]] = 6;
  pu.pu_a.surface[decoded.centerlist[3]] = 6;
  pu.draw_bg_image(); pu.draw();
  noNativeArtwork(decoded);
  assert.match(layer(decoded.svg, 'cell-grids'), /M0 64 L192 64/,
    'the shared cell boundary remains in the complete drawing');
  assert.equal(events.filter(event => event.kind === 'frame' && event.style !== 0).length, 0,
    'no native frame may add a second grid over artwork masks');
  assert.equal(events.filter(event => event.kind === 'image').length, 1);
  assert.equal(events.some(event => event.kind === 'legacy-image'), false);
  const image = events.findIndex(event => event.kind === 'image');
  assert.ok(events.findLastIndex(event => event.kind === 'surface') < image);
  assert.ok(events.findIndex(event => event.kind === 'number') > image);
  assert.equal(events[image].svg, decoded.svg, 'the adapter draws the complete encoded clue layer');
  assert.equal(decoded.background.foreground, false);
});

test('white overlay masks retain their position above intersecting grid and region edges', () => {
  const p = fixture({rows: 2, cols: 2});
  p.regions = [[[0, 0]], [[0, 1]]];
  p.overlays = [{center: [.5, 1], width: .4, height: .4, rounded: true,
    backgroundColor: '#FFFFFF', borderColor: '#000000'}];
  const decoded = convert(p);
  noNativeArtwork(decoded);
  assert.match(layer(decoded.svg, 'cell-grids'), /M64 0 L64 128/);
  assert.match(layer(decoded.svg, 'cell-grids'), /stroke-width="3"/);
  assert.match(layer(decoded.svg, 'overlay'), /fill="#FFFFFF"/);
  assert.ok(decoded.svg.indexOf('data-layer="overlay"') > decoded.svg.indexOf('data-layer="cell-grids"'));
});

test('retargeted post-grid underlays keep masks above the grid; ordinary underlays stay below it', () => {
  const p = fixture({rows: 2, cols: 2});
  const mask = {center: [.5, 1], width: .4, height: .4, backgroundColor: '#FFFFFF'};
  p.underlays = [mask];
  let decoded = convert(p);
  assert.match(layer(decoded.svg, 'underlay'), /fill="#FFFFFF"/);
  assert.doesNotMatch(layer(decoded.svg, 'overlay'), /fill="#FFFFFF"/);
  p.underlays = [{...mask, target: 'overlay'}];
  decoded = convert(p);
  assert.doesNotMatch(layer(decoded.svg, 'underlay'), /fill="#FFFFFF"/);
  assert.match(layer(decoded.svg, 'overlay'), /fill="#FFFFFF"/);
  noNativeArtwork(decoded);
});

test('hidden grids stay hidden while explicitly specified region boundaries remain in the drawing', () => {
  const p = fixture({rows: 2, cols: 2});
  p.settings = {nogrid: true}; p.regions = [[[0, 0], [0, 1]]];
  const decoded = convert(p), grid = layer(decoded.svg, 'cell-grids');
  noNativeArtwork(decoded);
  assert.doesNotMatch(grid, /stroke-width="1"/);
  assert.match(grid, /stroke-width="3"/);
  assert.match(grid, /d="M0 0 L64 0 L128 0 L128 64 L64 64 L0 64 Z"/);
  assert.doesNotMatch(grid, /M64 0 L64 64/, 'the region has no internal thick edge');
});

test('dashed grids retain the source dash pattern without a competing native grid', () => {
  const p = fixture(); p.settings = {dashedgrid: true};
  const decoded = convert(p), {pu, events} = referenceDrawing(decoded);
  pu.draw(); noNativeArtwork(decoded);
  assert.equal(events.filter(event => event.kind === 'frame' && event.style !== 0).length, 0);
  assert.equal((decoded.svg.match(/stroke-dasharray="3 10"/g) || []).length, 1);
});

for (const [rows, cols] of [[1, 1], [2, 3], [3, 2], [4, 4]]) {
  test(`${rows} by ${cols} region outlines contain only their outer cell edges`, () => {
    const p = fixture({rows, cols});
    p.regions = [p.cells.flatMap((row, r) => row.map((_, c) => [r, c]))];
    const decoded = convert(p), grid = layer(decoded.svg, 'cell-grids');
    const pathData = [...grid.matchAll(/<path d="([^"]+)"[^>]*stroke-width="3"/g)].map(match => match[1]);
    assert.equal(pathData.length, 1);
    const points = [...pathData[0].matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map(match => match.slice(1).map(Number));
    assert.equal(points.length, 2 * rows + 2 * cols);
    assert.match(pathData[0], / Z$/);
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      assert.equal(Math.hypot(a[0] - b[0], a[1] - b[1]), 64);
      assert.ok(a[0] === b[0] && [0, cols * 64].includes(a[0]) ||
        a[1] === b[1] && [0, rows * 64].includes(a[1]));
    }
    noNativeArtwork(decoded);
  });
}

test('colored box borders retain their exact color and source width', () => {
  const p = fixture(); p.cages = [{cells: [[0, 0], [0, 1]], style: 'box', borderColor: '#FF0000'}];
  const decoded = convert(p); noNativeArtwork(decoded);
  assert.match(layer(decoded.svg, 'cell-grids'), /stroke="#FF0000" stroke-width="3"/);
});

test('only supported named cage styles are accepted, never inherited properties or CSS', () => {
  for (const style of ['constructor', '__proto__', 'toString', 'fill:red']) {
    const p = fixture(); p.cages = [{cells: [[0, 0]], style}];
    assert.throws(() => loadApp().convertPuzzle(p), /unsupported cage style/);
  }
});

test('stroke-only overlay text keeps its white outline above the complete grid', () => {
  const p = fixture();
  p.overlays = [{center: [.5, 1], width: 0, height: 0, text: 'X', fontSize: 20,
    textColor: 'none', textStroke: '#FFFFFF'}];
  const decoded = convert(p), text = layer(decoded.svg, 'overlay');
  noNativeArtwork(decoded);
  assert.match(text, /fill="none"/); assert.match(text, /stroke="#FFFFFF"/); assert.match(text, />X<\/text>/);
  assert.match(layer(decoded.svg, 'cell-grids'), /M64 0 L64 128/);
});

test('blank pencil marks neither remove grid edges nor create an opaque note', () => {
  const p = fixture(); p.cells[0][0].pencilMarks = [' '];
  const decoded = convert(p); noNativeArtwork(decoded);
  assert.doesNotMatch(layer(decoded.svg, 'notes'), /<text/);
  assert.match(layer(decoded.svg, 'cell-grids'), /M0 64 L192 64/);
});

test('alphabetic text above a row boundary preserves its baseline and the full grid edge', () => {
  const p = fixture();
  p.overlays = [{center: [.83, .5], width: 0, height: 0, text: 'XYZ', fontSize: 16,
    'dominant-baseline': 'alphabetic'}];
  const decoded = convert(p); noNativeArtwork(decoded);
  assert.match(layer(decoded.svg, 'cell-grids'), /M0 64 L192 64/);
  assert.match(layer(decoded.svg, 'overlay'), /dominant-baseline="alphabetic"/);
  assert.match(decoded.svg, />XYZ<\/text>/);
});

test('constraint lines stay below cage labels and their white label backgrounds', () => {
  const p = fixture();
  p.lines = [{wayPoints: [[.5, .5], [.5, 1.5]], color: '#FF00FF', thickness: 9}];
  p.cages = [{cells: [[0, 0], [0, 1]], value: '12'}];
  const decoded = convert(p); noNativeArtwork(decoded);
  assert.match(layer(decoded.svg, 'arrows'), /stroke="#FF00FF"[^>]*stroke-width="9"/);
  const cage = layer(decoded.svg, 'cages');
  assert.match(cage, />12<\/text>/); assert.match(cage, /fill="rgba\(255,255,255,0.9\)"/);
  assert.ok(decoded.svg.indexOf('stroke="#FF00FF"') < decoded.svg.indexOf('>12</text>'));
});

test('retargeted masks and arrowheads preserve their layer and source order around crossing lines', () => {
  for (const kind of ['overlays', 'underlays', 'arrows']) {
    const p = fixture({rows: 2, cols: 2});
    p.lines = [{wayPoints: [[.5, .5], [1.5, 1.5]], color: '#FF88FF', thickness: 9}];
    p[kind] = kind === 'arrows'
      ? [{wayPoints: [[.5, 1.5], [1.5, .5]], color: '#000000', thickness: 4, target: 'cell-grids'}]
      : [{center: [1, 1], width: .5, height: .5, backgroundColor: '#FFFFFF', target: 'arrows'}];
    const decoded = convert(p); noNativeArtwork(decoded);
    const lineAt = decoded.svg.indexOf('stroke="#FF88FF"');
    if (kind === 'arrows') {
      assert.match(layer(decoded.svg, 'cell-grids'), /stroke-width="4"/);
      assert.ok(lineAt < decoded.svg.indexOf('data-layer="cell-grids"'));
    } else {
      const fillAt = decoded.svg.indexOf('fill="#FFFFFF"');
      assert.ok(kind === 'overlays' ? fillAt > lineAt : fillAt < lineAt,
        'source order within the arrows layer must not change during conversion');
    }
  }
});

test('outside clue typography and the exact Japanese Nurikabe frame width survive together', () => {
  const p = fixture({rows: 16, cols: 16});
  p.lines = [{target: 'cell-grids', thickness: 7.2, color: '#000000',
    wayPoints: [[16, 0], [0, 0], [0, 16], [16, 16], [16, 0]]}];
  p.overlays = [{'stroke-width': 0, 'dominant-baseline': 'alphabetic',
    fontSize: 34.4, text: '??', center: [1.7, -.5], height: 0, width: 0}];
  for (const style of [{}, {'font-weight': 'bold'}, {'font-style': 'italic'}, {'font-family': 'Courier New'}]) {
    const decoded = convert({...p, overlays: [{...p.overlays[0], ...style}]});
    noNativeArtwork(decoded);
    assert.match(decoded.svg, />\?\?<\/text>/);
    assert.match(layer(decoded.svg, 'cell-grids'), /stroke-width="7.2"/);
    for (const [name, value] of Object.entries(style)) assert.ok(decoded.svg.includes(name + '="' + value + '"'));
  }
});

test('filled octagons and colored paths remain complete objects above Surface shading', () => {
  const p = fixture({rows: 3, cols: 3});
  p.lines = [{fill: '#CFCFCF', color: '#CFCFCF', thickness: 0,
    wayPoints: [[1.1, 1.3], [1.1, 1.7], [1.3, 1.9], [1.7, 1.9], [1.9, 1.7], [1.9, 1.3], [1.7, 1.1], [1.3, 1.1]]},
    {wayPoints: [[.5, .5], [1.5, 1.5], [2.5, .5]], color: '#FA7', thickness: 9}];
  const decoded = convert(p), {pu, events} = referenceDrawing(decoded);
  pu.pu_a.surface[decoded.centerlist[4]] = 6; pu.draw();
  const image = events.find(event => event.kind === 'image');
  assert.match(image.svg, /fill="#CFCFCF"/);
  assert.match(image.svg, /stroke="#FA7"[^>]*stroke-width="9"/);
  assert.ok(image.svg.indexOf('fill="#CFCFCF"') < image.svg.indexOf('stroke="#FA7"'));
  assert.ok(events.indexOf(image) > events.findIndex(event => event.kind === 'surface'));
  noNativeArtwork(decoded);
});

test('given cell colors use native Surface entries and are omitted from the artwork layer', () => {
  const p = fixture();
  p.cells[0][0].backgroundColor = '#AABBCC'; p.cells[0][1].color = '#DDEEFF';
  const decoded = convert(p), colors = JSON.parse(decoded.lines[14]);
  assert.equal(Object.keys(decoded.question.surface).length, 2);
  assert.equal(colors.surface[decoded.centerlist[0]], '#AABBCC');
  assert.equal(colors.surface[decoded.centerlist[1]], '#DDEEFF');
  assert.equal(decoded.lines[13], '1', 'Penpa must enable the exact custom surface colors');
  assert.doesNotMatch(layer(decoded.svg, 'cell-colors'), /<rect/,
    'solver shading must cover given cell colors without a duplicate image repaint');
  const {pu, events} = referenceDrawing(decoded);
  pu.pu_a.surface[decoded.centerlist[0]] = 6; pu.draw();
  assert.deepEqual(events.filter(event => event.kind === 'surface').map(event => event.layer), ['pu_q', 'pu_q', 'pu_a']);
  assert.ok(events.findIndex(event => event.kind === 'image') > events.findLastIndex(event => event.kind === 'surface'));
});
