'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const nativeCode = fs.readFileSync(path.join(__dirname, '../native.js'), 'utf8');
const pointCode = fs.readFileSync(path.join(__dirname, 'reference/penpa-surface-reference.js'), 'utf8');
const lineCode = fs.readFileSync(path.join(__dirname, 'reference/penpa-native-line-reference.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const cells = (rows = 9, cols = 9) => Array.from({length: rows}, () => Array.from({length: cols}, () => ({})));
const line = (wayPoints, color = '#F8F', extra = {}) => ({wayPoints, color, thickness: 9, ...extra});
function native() {
  const context = vm.createContext({});
  vm.runInContext(nativeCode, context);
  return context.SudokuPadNative;
}

function drawing(puzzle, plan, shade = []) {
  const events = [], context = vm.createContext({UserSettings: {show_solution: false, custom_colors_on: true},
    Color: new Proxy({}, {get: (_object, key) => key})});
  vm.runInContext(pointCode + '\n' + lineCode, context);
  const pu = new context.PenpaSurfaceReference();
  Object.assign(pu, {nx0: puzzle.cells[0].length + 4, ny0: puzzle.cells.length + 4, size: 38,
    mode: {qa: 'pu_a', grid: ['1', '2', '2']}, corner_table: [],
    pu_q: {line: plan.line, lineE: {}}, pu_a: {line: {}, lineE: {}},
    pu_q_col: {line: plan.colors, lineE: {}}, pu_a_col: {line: {}, lineE: {}}});
  pu.create_point();
  for (const name of pointCode.matchAll(/this\.(draw_\w+)\(/g)) pu[name[1]] = () => {};
  pu.draw = context.PenpaSurfaceReference.prototype.draw;
  pu.draw_line = context.PenpaNativeLineReference.prototype.draw_line;
  pu.draw_surface = layer => {if (layer === 'pu_a') for (const point of shade) events.push({kind: 'surface', point});};
  pu.draw_number = layer => events.push({kind: 'number', layer});
  let start, end;
  pu.ctx = {setLineDash() {}, beginPath() {}, moveTo(x, y) {start = [x, y];}, lineTo(x, y) {end = [x, y];},
    stroke() {events.push({kind: 'line', start, end, color: this.strokeStyle, width: this.lineWidth, cap: this.lineCap});}};
  context.pu = pu;
  pu.draw();
  return {events, pu};
}

test('native line point IDs use actual Penpa center and vertex coordinates on rectangular grids', () => {
  for (const [rows, cols] of [[2, 3], [3, 2], [9, 9]]) {
    const puzzle = {cells: cells(rows, cols), lines: [line([[.5, .5], [rows - .5, cols - .5]])]};
    const plan = native().planLines(puzzle), {pu} = drawing(puzzle, plan);
    for (const [r, c] of [[.5, .5], [rows - .5, cols - .5], [0, 0], [rows, cols]]) {
      const id = native().pointId([r, c], rows, cols);
      assert.equal(pu.point[id].x, (c + 2) * 38);
      assert.equal(pu.point[id].y, (r + 2) * 38);
    }
  }
});

test('opaque Surface fills are below native colored paths and both are below solver numbers', () => {
  const puzzle = {cells: cells(), lines: [line([[.5, .5], [1.5, 1.5], [2.5, 1.5]], '#F6B26B')]};
  const plan = native().planLines(puzzle), {events} = drawing(puzzle, plan, [28, 42]);
  const strokes = events.filter(event => event.kind === 'line');
  assert.equal(strokes.length, 2);
  assert.ok(strokes.every(event => event.color === '#F6B26B' && event.width === 5 && event.cap === 'round'));
  assert.ok(events.findLastIndex(event => event.kind === 'surface') < events.findIndex(event => event.kind === 'line'));
  assert.ok(events.findLastIndex(event => event.kind === 'line') < events.findIndex(event => event.kind === 'number'));
});

test('all colors and source paint order survive multiple joined paths and repeated edges', () => {
  const puzzle = {cells: cells(), lines: [
    line([[.5, .5], [1.5, 1.5]], '#F8F'),
    line([[1.5, 1.5], [2.5, .5]], '#6EF'),
    line([[.5, .5], [1.5, 1.5]], '#EE8'),
    line([[2.5, .5], [3.5, 1.5]], '#BA8')
  ]};
  const plan = native().planLines(puzzle), {events} = drawing(puzzle, plan);
  assert.equal(plan.lineIndices.size, 4);
  assert.deepEqual(events.filter(event => event.kind === 'line').map(event => event.color), ['#6EF', '#EE8', '#BA8']);
});

test('unsupported fills, paths, coordinates, widths and transparency remain in the artwork', () => {
  const base = line([[.5, .5], [1.5, 1.5]]);
  for (const extra of [{fill: '#CCC'}, {d: 'M0 0L64 64'}, {wayPoints: [[.65, .86], [1.13, 1.34]]},
    {wayPoints: [[.5, 1], [1.5, 1]]}, {thickness: 25}, {opacity: .5}, {'stroke-opacity': .5},
    {color: '#F8F8'}, {'stroke-linecap': 'butt'}, {'stroke-dasharray': '2 3'}, {target: 'background'}]) {
    const plan = native().planLines({cells: cells(), lines: [{...base, ...extra}]});
    assert.equal(plan.lineIndices.size, 0, JSON.stringify(extra));
    assert.deepEqual(clone(plan.line), {});
  }
});

test('later decorative masks retain priority over intersecting native candidates', () => {
  const puzzle = {cells: cells(), lines: [line([[.5, .5], [1.5, 1.5]]), line([[4.5, 4.5], [5.5, 5.5]])]};
  const plan = native().planLines(puzzle, {occlusions: [{left: 20, right: 40, top: 20, bottom: 40}]});
  assert.deepEqual(Array.from(plan.lineIndices), [1]);
});

test('a later unsupported overlapping line or polygon keeps earlier lines in their image layer', () => {
  const puzzle = {cells: cells(), lines: [line([[.5, .5], [1.5, 1.5]]),
    line([[1, 1], [1, 2], [2, 1]], '#CCC', {fill: '#CCC', thickness: 0})]};
  assert.equal(native().planLines(puzzle).lineIndices.size, 0);
  puzzle.lines.reverse();
  assert.deepEqual(Array.from(native().planLines(puzzle).lineIndices), [1]);
});

test('arrows explicitly ordered above a line keep intersecting lines in their image layer', () => {
  const puzzle = {cells: cells(), lines: [line([[.5, .5], [1.5, 1.5]])],
    arrows: [line([[1, 1], [1, 2]])], settings: {arrowsabovelines: true}};
  assert.equal(native().planLines(puzzle).lineIndices.size, 0);
  puzzle.settings.arrowsabovelines = false;
  assert.equal(native().planLines(puzzle).lineIndices.size, 1);
});

test('targeted line layers retain their rendering order regardless of array order', () => {
  const puzzle = {cells: cells(), lines: [line([[.5, .5], [1.5, 1.5]], '#000000', {target: 'cell-grids'}),
    line([[1.5, 1.5], [2.5, .5]], '#F8F')]};
  const plan = native().planLines(puzzle), {events} = drawing(puzzle, plan);
  assert.deepEqual(events.filter(event => event.kind === 'line').map(event => event.color), ['#F8F', '#000000']);
});

test('two widths painted on the same edge retain their combined appearance in the image', () => {
  const puzzle = {cells: cells(), lines: [line([[.5, .5], [1.5, 1.5]], '#F8F'),
    line([[1.5, 1.5], [.5, .5]], '#000000', {thickness: 5})]};
  assert.equal(native().planLines(puzzle).lineIndices.size, 0);
});

test('Japanese Nurikabe outer border stays complete above Surface at the closest native width', () => {
  const border = line([[16, 0], [0, 0], [0, 16], [16, 16], [16, 0]], '#000000',
    {target: 'cell-grids', thickness: 7.2});
  const puzzle = {cells: cells(16, 16), lines: [border]};
  const plan = native().planLines(puzzle), {events} = drawing(puzzle, plan, [42, 57, 342, 357]);
  const strokes = events.filter(event => event.kind === 'line');
  assert.equal(plan.lineIndices.size, 1);
  assert.equal(strokes.length, 4);
  for (const stroke of strokes) {
    assert.equal(stroke.color, '#000000');
    assert.equal(stroke.width, 5);
    assert.equal(Math.hypot(stroke.start[0] - stroke.end[0], stroke.start[1] - stroke.end[1]), 16 * 38);
    assert.ok(events.indexOf(stroke) > events.findLastIndex(event => event.kind === 'surface'));
  }
  // The approximation is limited to the actual closed grid frame.
  for (const changed of [{target: 'arrows'}, {wayPoints: border.wayPoints.slice(0, 4)},
    {wayPoints: [[1, 1], [15, 1], [15, 15], [1, 15], [1, 1]]},
    {wayPoints: [[16, 0], [0, 16], [0, 0], [16, 16], [16, 0]]}]) {
    assert.equal(native().planLines({...puzzle, lines: [{...border, ...changed}]}).lineIndices.size, 0);
  }
});

// Public reproduction: https://sudokupad.app/zyjs2yh4bp (Zodiac #30: Wreath).
test('Wreath preserves all twenty colored paths and all forty segments above Surface', () => {
  const paths = [["#F8F",[[6.5,6.5],[7.5,5.5]]],["#F8F",[[6.5,3.5],[6.5,2.5]]],["#F8F",[[7.5,8.5],[8.5,7.5],[8.5,6.5]]],["#F6B26B",[[2.5,2.5],[1.5,3.5]]],["#F6B26B",[[2.5,5.5],[2.5,6.5]]],["#F6B26B",[[8.5,1.5],[7.5,0.5],[6.5,0.5]]],["#F88",[[2.5,2.5],[3.5,2.5]]],["#F88",[[5.5,1.5],[6.5,2.5]]],["#BA8",[[2.5,6.5],[3.5,7.5]]],["#BA8",[[5.5,6.5],[6.5,6.5]]],["#EE8",[[1.5,4.5],[1.5,5.5],[2.5,6.5],[3.5,6.5],[4.5,7.5]]],["#EE8",[[0.5,7.5],[1.5,8.5],[2.5,8.5]]],["#BAD",[[1.5,4.5],[2.5,3.5],[2.5,2.5],[3.5,1.5],[4.5,1.5]]],["#6EF",[[4.5,1.5],[5.5,2.5],[6.5,2.5],[7.5,3.5],[7.5,4.5]]],["#9F9",[[4.5,7.5],[5.5,7.5],[6.5,6.5],[6.5,5.5],[7.5,4.5]]],["#9F9",[[1.5,0.5],[0.5,1.5],[0.5,2.5]]],["#F8F",[[7.5,5.5],[7.5,4.5],[6.5,3.5]]],["#F6B26B",[[1.5,3.5],[1.5,4.5],[2.5,5.5]]],["#F88",[[3.5,2.5],[4.5,1.5],[5.5,1.5]]],["#BA8",[[3.5,7.5],[4.5,7.5],[5.5,6.5]]]];
  const puzzle = {cells: cells(), lines: paths.map(([color, points]) => line(points, color))};
  const plan = native().planLines(puzzle), {events} = drawing(puzzle, plan, [28, 42, 56]);
  const strokes = events.filter(event => event.kind === 'line');
  assert.equal(plan.lineIndices.size, 20);
  assert.equal(strokes.length, 40);
  assert.deepEqual([...new Set(strokes.map(event => event.color))], ['#F8F', '#F6B26B', '#F88', '#BA8', '#EE8', '#BAD', '#6EF', '#9F9']);
  assert.deepEqual(strokes.map(event => event.color), paths.flatMap(([color, points]) => points.slice(1).map(() => color)));
  for (const stroke of strokes) {
    assert.equal(stroke.width, 5);
    assert.ok(events.indexOf(stroke) > events.findLastIndex(event => event.kind === 'surface'));
  }
});
