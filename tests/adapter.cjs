'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createReference, loadApp, decodePenpa, fixture} = require('./harness.cjs');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const adapterCode = read('../penpa-adapter.js');
const drawCode = read('reference/penpa-surface-reference.js');
const backgroundCode = read('reference/penpa-background-reference.js');
const resizeCode = read('reference/penpa-resize-reference.js');
const clone = value => JSON.parse(JSON.stringify(value));
const marker = () => ({version: 1, anchor: 28, offsetX: -.75, offsetY: -1.25,
  widthCells: 10.5, heightCells: 11.5});

function setup(options = {}) {
  const events = [];
  const settings = {show_solution: Boolean(options.showSolution)};
  const context = vm.createContext({UserSettings: settings,
    panel_pu: {draw_panel() {}}, console: {error(error) {throw error;}}});
  vm.runInContext(drawCode + '\n' + backgroundCode + '\n' + resizeCode, context);
  class Puzzle extends context.PenpaSurfaceReference {}
  for (const match of drawCode.matchAll(/this\.(draw_\w+)\(/g)) {
    const method = match[1];
    Puzzle.prototype[method] = function (...args) {events.push({kind: method, args});};
  }
  Puzzle.prototype.draw_bg_image = context.PenpaBackgroundReference.prototype.draw_bg_image;
  Puzzle.prototype.redraw = context.PenpaBackgroundReference.prototype.redraw;
  for (const method of ['resize_board', 'make_resize_point_translator', 'translate_puzzle_elements']) {
    Puzzle.prototype[method] = context.PenpaResizeReference.prototype[method];
  }
  const answerReference = createReference();
  Puzzle.prototype.checkall_status = answerReference.puzzle.checkall_status;
  Puzzle.prototype.make_solution = options.answer ? function () {return clone(options.answer);} : answerReference.puzzle.make_solution;
  Puzzle.prototype.flushcanvas = function (svg) {events.push({kind: 'flush', svg});};
  Puzzle.prototype.check_solution = function () {events.push({kind: 'check_solution'});};
  Puzzle.prototype.set_redoundocolor = function () {};
  context.Puzzle = Puzzle;
  vm.runInContext(adapterCode, context);
  const puzzle = new Puzzle();
  Object.assign(puzzle, {gridtype: 'square', size: 38, point: {[28]: {x: 123, y: 172}},
    mode: {qa: options.qa || 'pu_a', grid: ['3', '2', '2']},
    bg_image: {width: 399, height: 437}, bg_image_canvas: {id: 'decoded-artwork'},
    bg_image_data: {x: 7, y: 11, width: 399, height: 437, foreground: Boolean(options.foreground),
      opacity: 100, mask_white: false,
      ...(options.marked === false ? {} : {sudokupad_artwork: marker()})},
    ctx: {drawImage(image, ...rect) {events.push({kind: 'image', image, rect});}}});
  return {puzzle, events, context, settings, Puzzle};
}

function setupResize({rows = 9, cols = 9} = {}) {
  const fixture = setup(), {puzzle, context} = fixture;
  Object.assign(puzzle, {nx: cols, ny: rows, nx0: cols + 4, ny0: rows + 4, corner_table: [],
    space: [0, 0, 0, 0], theta: 0, reflect: [1, 1],
    width_c: cols + 1, height_c: rows + 1, canvasx: (cols + 1) * 38, canvasy: (rows + 1) * 38,
    cursol: 28, cursolS: 28, freelinecircle_g: [-1, -1], selection: [], conflict_cells: [],
    centerlist: Array.from({length: rows * cols}, (_, index) =>
      (2 + Math.floor(index / cols)) * (cols + 4) + 2 + index % cols),
    get_orientation() {return 0;},
    search_center() {this.center_n = this.centerlist[Math.floor(this.centerlist.length / 2)];},
    canvasxy_update() {this.canvasx = this.width_c * this.size; this.canvasy = this.height_c * this.size;},
    canvas_size_setting() {},
    point_move(x, y) {for (const point of this.point) {point.x += x; point.y += y;}},
    grid_is_square() {return true;}
  });
  for (const layer of ['pu_q', 'pu_a', 'pu_q_col', 'pu_a_col']) {
    puzzle[layer] = {number: {}, surface: {},
      command_undo: {__a: []}, command_redo: {__a: []}, command_replay: {__a: []}};
  }
  puzzle.create_point();
  context.pu = puzzle;
  context.document = {getElementById() {return {getElementsByClassName() {return [];}};}};
  return fixture;
}

function setupConverted(source) {
  const decoded = decodePenpa(loadApp().convertPuzzle(source).url);
  const result = setupResize({rows: decoded.rows, cols: decoded.cols});
  const {puzzle} = result;
  puzzle.centerlist = decoded.centerlist.slice();
  puzzle.bg_image_data = clone(decoded.background);
  puzzle.pu_q = clone(decoded.question);
  puzzle.solution = JSON.stringify(decoded.answer);
  for (const entry of decoded.answer[4]) {
    const [id, value] = entry.split(',');
    puzzle.pu_a.number[id] = [value, 2, '1'];
  }
  return {...result, decoded};
}

test('actual Penpa draw order puts imported clue artwork above both Surface layers and below solving tools', () => {
  const {puzzle, events} = setup();
  puzzle.redraw();
  const image = events.findIndex(event => event.kind === 'image');
  assert.equal(events.filter(event => event.kind === 'image').length, 1);
  assert.deepEqual(events.filter(event => event.kind === 'draw_surface').map(event => event.args[0]), ['pu_q', 'pu_a']);
  assert.ok(events.findLastIndex(event => event.kind === 'draw_surface') < image);
  for (const method of ['draw_symbol', 'draw_line', 'draw_number', 'draw_cage', 'draw_selection']) {
    assert.ok(events.findIndex(event => event.kind === method) > image, method + ' remains over the artwork');
  }
  assert.equal(events.filter(event => event.kind === 'check_solution').length, 1);
});

test('question-only display inserts artwork after given surfaces; showing solutions inserts after answer surfaces', () => {
  for (const showSolution of [false, true]) {
    const {puzzle, events} = setup({qa: 'pu_q', showSolution});
    puzzle.redraw();
    const image = events.findIndex(event => event.kind === 'image');
    assert.equal(events.filter(event => event.kind === 'image').length, 1);
    assert.equal(events[image - 1].kind, 'draw_surface');
    assert.equal(events[image - 1].args[0], showSolution ? 'pu_a' : 'pu_q');
    assert.ok(events.findIndex(event => event.kind === 'draw_number') > image);
  }
});

test('artwork tracks both cell-size changes and board translation without changing stored puzzle data', () => {
  const {puzzle, events} = setup();
  const saved = clone(puzzle.bg_image_data);
  for (const [size, x, y] of [[38, 123, 172], [56, 218, 311], [24, 70, 90], [38, 123, 172]]) {
    puzzle.size = size;
    Object.assign(puzzle.point[28], {x, y});
    puzzle.redraw();
    assert.deepEqual(events.findLast(event => event.kind === 'image').rect,
      [x - .75 * size, y - 1.25 * size, 10.5 * size, 11.5 * size]);
    assert.deepEqual(puzzle.bg_image_data, saved);
  }
});

test('ordinary Penpa background and foreground links preserve their existing draw position and dimensions', () => {
  for (const foreground of [false, true]) {
    const {puzzle, events} = setup({marked: false, foreground});
    puzzle.redraw();
    const image = events.findIndex(event => event.kind === 'image');
    assert.equal(events.filter(event => event.kind === 'image').length, 1);
    assert.deepEqual(events[image].rect, [7, 11, 399, 437]);
    if (foreground) assert.ok(image > events.findLastIndex(event => event.kind === 'draw_number'));
    else assert.ok(image < events.findIndex(event => event.kind === 'draw_surface'));
  }
});

test('an imported marker overrides the legacy foreground flag without placing artwork over entered digits', () => {
  const {puzzle, events} = setup({foreground: true});
  puzzle.redraw();
  assert.equal(events.filter(event => event.kind === 'image').length, 1);
  assert.ok(events.findIndex(event => event.kind === 'image') < events.findIndex(event => event.kind === 'draw_number'));
});

test('invalid markers safely fall back to ordinary Penpa image drawing', () => {
  for (const mutation of [
    puzzle => {puzzle.bg_image_data.sudokupad_artwork.version = 2;},
    puzzle => {puzzle.bg_image_data.sudokupad_artwork.anchor = '__proto__';},
    puzzle => {puzzle.bg_image_data.sudokupad_artwork.anchor = 9999;},
    puzzle => {puzzle.bg_image_data.sudokupad_artwork.widthCells = -1;},
    puzzle => {puzzle.bg_image_data.sudokupad_artwork.offsetX = Infinity;},
    puzzle => {puzzle.bg_image_data.sudokupad_artwork.offsetY = '0';},
    puzzle => {puzzle.point[28].x = NaN;},
    puzzle => {puzzle.size = 0;},
    puzzle => {puzzle.gridtype = 'hex';}
  ]) {
    const {puzzle, events} = setup();
    mutation(puzzle);
    puzzle.redraw();
    const image = events.findIndex(event => event.kind === 'image');
    assert.equal(events.filter(event => event.kind === 'image').length, 1);
    assert.deepEqual(events[image].rect, [7, 11, 399, 437]);
    assert.ok(image < events.findIndex(event => event.kind === 'draw_surface'));
  }
});

test('reinstalling the adapter does not duplicate artwork; loading the image later triggers a normal complete render', () => {
  const {puzzle, events, context, Puzzle} = setup();
  const originalMethod = Puzzle.prototype.draw_surface;
  assert.equal(context.PenpaSudokuPadAdapter.install(Puzzle), true);
  vm.runInContext(adapterCode, context);
  assert.equal(Puzzle.prototype.draw_surface, originalMethod);
  const canvas = puzzle.bg_image_canvas;
  puzzle.bg_image_canvas = null;
  puzzle.redraw();
  assert.equal(events.filter(event => event.kind === 'image').length, 0);
  puzzle.bg_image_canvas = canvas;
  puzzle.redraw();
  assert.equal(events.filter(event => event.kind === 'image').length, 1);
});

test('export redraws use the same imported artwork layer and retain the no-answer-check option', () => {
  const {puzzle, events} = setup();
  puzzle.redraw(true, false);
  assert.equal(events[0].svg, true);
  assert.equal(events.filter(event => event.kind === 'check_solution').length, 0);
  assert.equal(events.filter(event => event.kind === 'image').length, 1);
  assert.ok(events.findLastIndex(event => event.kind === 'draw_surface') < events.findIndex(event => event.kind === 'image'));
});

test('a single-cell partial Surface repaint does not draw an entire artwork layer over other solver marks', () => {
  const {puzzle, events} = setup();
  puzzle.draw_surface('pu_a', 28);
  assert.equal(events.filter(event => event.kind === 'image').length, 0);
  assert.equal(events.filter(event => event.kind === 'draw_surface').length, 1);
});

test('actual Penpa structural resize keeps the artwork anchor aligned with givens, surfaces and the embedded answer', () => {
  for (const side of ['t', 'b', 'l', 'r']) {
    const {puzzle, events} = setupResize();
    puzzle.pu_q.number[28] = ['4', 1, '1'];
    puzzle.pu_a.surface[28] = 6;
    puzzle.solution = JSON.stringify([[], [], [], [], ['28,4'], []]);
    for (const sign of [1, 1, -1, -1]) {
      const saved = clone(puzzle.bg_image_data.sudokupad_artwork);
      puzzle.resize_board(side, sign);
      const nativeGiven = Number(Object.keys(puzzle.pu_q.number)[0]);
      assert.equal(puzzle.bg_image_data.sudokupad_artwork.anchor, nativeGiven);
      assert.deepEqual(Object.keys(puzzle.pu_a.surface), [String(nativeGiven)]);
      assert.equal(JSON.parse(puzzle.solution)[4][0], nativeGiven + ',4');
      assert.equal(puzzle.bg_image_data.sudokupad_artwork.offsetX, saved.offsetX);
      assert.equal(puzzle.bg_image_data.sudokupad_artwork.offsetY, saved.offsetY);
      puzzle.redraw(false, false);
      const point = puzzle.point[nativeGiven];
      assert.deepEqual(events.findLast(event => event.kind === 'image').rect,
        [point.x + saved.offsetX * puzzle.size, point.y + saved.offsetY * puzzle.size,
          saved.widthCells * puzzle.size, saved.heightCells * puzzle.size]);
    }
    assert.equal(puzzle.bg_image_data.sudokupad_artwork.anchor, 28);
    assert.equal(puzzle.nx, 9);
    assert.equal(puzzle.ny, 9);
  }
});

test('repeated structural cropping past the original anchor keeps artwork aligned using a remaining grid point', () => {
  for (const side of ['t', 'l']) {
    const {puzzle, events} = setupResize();
    for (let deleted = 1; deleted <= 7; deleted++) {
      puzzle.resize_board(side, -1);
      const marker = puzzle.bg_image_data.sudokupad_artwork;
      assert.equal(puzzle.point[marker.anchor].type, 0);
      assert.ok(marker.anchor % puzzle.nx0 >= 1);
      assert.ok(Math.floor(marker.anchor / puzzle.nx0) >= 1);
      puzzle.redraw(false, false);
      const image = events.findLast(event => event.kind === 'image');
      const newFirstCell = puzzle.point[2 * puzzle.nx0 + 2];
      assert.equal(image.rect[0] - newFirstCell.x, (-.75 - (side === 'l' ? deleted : 0)) * puzzle.size);
      assert.equal(image.rect[1] - newFirstCell.y, (-1.25 - (side === 't' ? deleted : 0)) * puzzle.size);
    }
  }
});

test('an actual converted checked puzzle accepts outside annotations while still rejecting an incorrect grid digit', () => {
  const source = fixture({rows: 2, cols: 2, solution: '1234'});
  source.overlays = [{center: [-3.5, .5], text: '4', fontSize: 24, width: 0, height: 0}];
  const decoded = decodePenpa(loadApp().convertPuzzle(source).url);
  const {puzzle} = setupResize();
  puzzle.centerlist = decoded.centerlist;
  puzzle.bg_image_data = decoded.background;
  puzzle.pu_q = decoded.question;
  for (const entry of decoded.answer[4]) {
    const [id, value] = entry.split(',');
    puzzle.pu_a.number[id] = [value, 2, '1'];
  }
  const outside = decoded.centerlist[0] - (decoded.cols + 4);
  puzzle.pu_a.number[outside] = ['9', 2, '1'];
  assert.deepEqual(clone(puzzle.make_solution()), decoded.answer);
  puzzle.pu_a.number[decoded.centerlist[0]][0] = '8';
  assert.notDeepEqual(clone(puzzle.make_solution()), decoded.answer);
  assert.ok(puzzle.make_solution()[4].includes(decoded.centerlist[0] + ',8'));

  // Ordinary Penpa links keep their original checker behavior.
  delete puzzle.bg_image_data.sudokupad_artwork;
  assert.ok(puzzle.make_solution()[4].includes(outside + ',9'));
});

test('outside-number filtering preserves other solution channels and skips multiple-solution puzzles', () => {
  const answer = [['15'], ['15,16,1'], ['15,28,1'], ['15,16'], ['15,9', '28,4'], ['15,1A']];
  const {puzzle} = setup({answer});
  puzzle.centerlist = [28];
  assert.deepEqual(puzzle.make_solution(), [answer[0], answer[1], answer[2], answer[3], ['28,4'], answer[5]]);
  puzzle.multisolution = true;
  assert.deepEqual(puzzle.make_solution(), answer);
});

test('outside annotation filtering follows the current centre list after structural resize', () => {
  const {puzzle} = setupResize();
  puzzle.pu_a.number[28] = ['4', 2, '1'];
  puzzle.pu_a.number[15] = ['9', 2, '1'];
  assert.deepEqual(clone(puzzle.make_solution()[4]), ['28,4']);
  puzzle.resize_board('t', 1, 'white');
  const movedInside = Number(Object.keys(puzzle.pu_a.number).find(id => puzzle.pu_a.number[id][0] === '4'));
  const movedOutside = Number(Object.keys(puzzle.pu_a.number).find(id => puzzle.pu_a.number[id][0] === '9'));
  assert.ok(puzzle.centerlist.includes(movedInside));
  assert.ok(!puzzle.centerlist.includes(movedOutside));
  assert.deepEqual(clone(puzzle.make_solution()[4]), [movedInside + ',4']);
});

test('partial checking accepts empty or arbitrary wildcard values, but rejects wrong or missing checked values', () => {
  const {puzzle, decoded} = setupConverted(fixture({solution: '1?3?56'}));
  const [first, wildcard, , otherWildcard] = decoded.centerlist;
  const before = clone(puzzle.bg_image_data);
  for (const value of [null, '0', '12', 'A']) {
    if (value === null) delete puzzle.pu_a.number[wildcard];
    else puzzle.pu_a.number[wildcard] = [value, 2, '1'];
    puzzle.pu_a.number[otherWildcard] = ['99', 2, '1'];
    assert.deepEqual(clone(puzzle.make_solution()), decoded.answer);
  }
  assert.deepEqual(puzzle.bg_image_data, before);
  assert.deepEqual(puzzle.pu_a.number[wildcard], ['A', 2, '1']);
  assert.deepEqual(puzzle.pu_a.number[otherWildcard], ['99', 2, '1']);
  puzzle.pu_a.number[first] = ['9', 2, '1'];
  assert.notDeepEqual(clone(puzzle.make_solution()), decoded.answer);
  delete puzzle.pu_a.number[first];
  assert.notDeepEqual(clone(puzzle.make_solution()), decoded.answer);
});

test('required blank cells remain checked when the same puzzle also contains wildcards', () => {
  const {puzzle, decoded} = setupConverted(fixture({solution: '1?.456'}));
  const [, wildcard, blank] = decoded.centerlist;
  puzzle.pu_a.number[wildcard] = ['8', 2, '1'];
  assert.deepEqual(clone(puzzle.make_solution()), decoded.answer);
  puzzle.pu_a.number[blank] = ['8', 2, '1'];
  assert.notDeepEqual(clone(puzzle.make_solution()), decoded.answer);
  delete puzzle.pu_a.number[blank];
  assert.deepEqual(clone(puzzle.make_solution()), decoded.answer);
});

test('11 by 11 partial checks retain all 103 specified cells and ignore only 18 wildcards', () => {
  const values = Array.from({length: 121}, (_, i) => i < 18 ? '?' : String(i % 9 + 1));
  const {puzzle, decoded} = setupConverted(fixture({rows: 11, cols: 11, solution: values}));
  assert.equal(decoded.answer[4].length, 103);
  for (const id of decoded.centerlist.slice(0, 18)) puzzle.pu_a.number[id] = ['12', 2, '1'];
  assert.deepEqual(clone(puzzle.make_solution()), decoded.answer);
  for (const id of decoded.centerlist.slice(18)) {
    const saved = puzzle.pu_a.number[id];
    puzzle.pu_a.number[id] = ['99', 2, '1'];
    assert.notDeepEqual(clone(puzzle.make_solution()), decoded.answer);
    puzzle.pu_a.number[id] = saved;
  }
});

test('wildcard positions follow native structural resize on every side and survive reserialization', () => {
  for (const side of ['t', 'b', 'l', 'r']) {
    const {puzzle} = setupConverted(fixture({rows: 3, cols: 3, solution: '1?34?6789'}));
    const originalMask = clone(puzzle.bg_image_data.sudokupad_artwork.uncheckedCells);
    for (const id of originalMask) puzzle.pu_a.number[id] = ['99', 2, '1'];
    for (const sign of [1, 1, -1, -1]) {
      puzzle.resize_board(side, sign, 'white');
      // Penpa saves the entire background object in both links and progress.
      puzzle.bg_image_data = clone(puzzle.bg_image_data);
      const moved = Object.keys(puzzle.pu_a.number).filter(id => puzzle.pu_a.number[id][0] === '99').map(Number);
      assert.deepEqual(puzzle.bg_image_data.sudokupad_artwork.uncheckedCells, moved);
      assert.equal(JSON.stringify(puzzle.make_solution()), puzzle.solution);
      const checked = Number(JSON.parse(puzzle.solution)[4][0].split(',')[0]);
      const saved = puzzle.pu_a.number[checked];
      puzzle.pu_a.number[checked] = ['99', 2, '1'];
      assert.notEqual(JSON.stringify(puzzle.make_solution()), puzzle.solution);
      puzzle.pu_a.number[checked] = saved;
    }
    assert.deepEqual(puzzle.bg_image_data.sudokupad_artwork.uncheckedCells, originalMask);
  }
});

test('wildcard filtering leaves ordinary Penpa and multiple-solution checks unchanged', () => {
  const answer = [[], [], [], [], ['28,4', '29,8'], []];
  const {puzzle} = setup({answer});
  puzzle.centerlist = [28, 29];
  puzzle.bg_image_data.sudokupad_artwork.uncheckedCells = [29];
  assert.deepEqual(puzzle.make_solution()[4], ['28,4']);
  puzzle.multisolution = true;
  assert.deepEqual(puzzle.make_solution(), answer);
  puzzle.multisolution = false;
  delete puzzle.bg_image_data.sudokupad_artwork;
  assert.deepEqual(puzzle.make_solution(), answer);
});

test('malformed wildcard masks do not disable checking', () => {
  for (const mask of [null, {}, '28', [28, '29'], [NaN], [1.5]]) {
    const {puzzle} = setup({answer: [[], [], [], [], ['28,4'], []]});
    puzzle.centerlist = [28];
    puzzle.bg_image_data.sudokupad_artwork.uncheckedCells = mask;
    assert.deepEqual(puzzle.make_solution()[4], ['28,4']);
  }
});
