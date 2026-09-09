'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {fixture, createReference, clone} = require('./harness.cjs');
const {planClues} = require('../clue-native.js');

function label(text, row, col, fontSize = 34.4, extra = {}) {
  return {text, center: [row, col], fontSize, width: 0, height: 0,
    'stroke-width': 0, 'dominant-baseline': 'alphabetic', ...extra};
}

function drawing(puzzle, plan) {
  const events = [];
  const context = vm.createContext({UserSettings: {show_solution: false, check_pencil_marks: false},
    set_line_style() {}, set_circle_style() {},
    set_font_style(ctx, size, style) { ctx.fontSize = size; ctx.style = style; }});
  for (const file of ['penpa-surface-reference.js', 'penpa-clues-reference.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'reference', file), 'utf8'), context);
  }
  const pu = new context.PenpaSurfaceReference();
  for (const method of ['draw_number', 'draw_number_circle', 'draw_numbercircle']) {
    pu[method] = context.PenpaClueReference.prototype[method];
  }
  const rows = puzzle.cells.length, cols = puzzle.cells[0].length;
  const ref = createReference({rows, cols});
  Object.assign(pu, {nx0: cols + 4, ny0: rows + 4, size: 38, corner_table: [],
    centerlist: ref.puzzle.centerlist, pu_q: {...clone(ref.puzzle.pu_q), ...plan.question},
    pu_a: {...clone(ref.puzzle.pu_a), surface: {[ref.puzzle.centerlist[0]]: 6}},
    mode: {qa: 'pu_a'}, grid_is_square: () => true});
  pu.create_point();
  pu.ctx = {text(value, x, y, width) {
    events.push({kind: 'text', value, x, y: y + .28 * this.fontSize, width, font: this.fontSize, style: this.style});
  }};
  pu.draw_circle = () => events.push({kind: 'circle'});
  pu.draw_polygon = () => events.push({kind: 'polygon'});
  // All unrelated drawing is stubbed. Run the actual Penpa draw order with
  // real number and numberS rendering, including its E point aliases.
  const order = fs.readFileSync(path.join(__dirname, 'reference/penpa-surface-reference.js'), 'utf8');
  for (const match of order.matchAll(/this\.(draw_\w+)\(/g)) {
    if (!['draw_number', 'draw_number_circle', 'draw_numbercircle'].includes(match[1])) pu[match[1]] = () => {};
  }
  pu.draw_surface = layer => {
    if (Object.keys(pu[layer].surface).length) events.push({kind: 'surface'});
  };
  pu.draw();
  return {pu, events};
}

test('plain large clues use real Penpa text above Surface without becoming givens', () => {
  const p = fixture({rows: 2, cols: 2, solution: '1234'});
  p.overlays = [label('23', .7, .5)];
  const plan = planClues(p), ref = createReference({rows: 2, cols: 2});
  const question = {...clone(ref.puzzle.pu_q), ...plan.question};
  const answers = ref.answer(question, ['1', '2', '3', '4']);
  assert.equal(answers[4].length, 4, 'a sum clue must never make Penpa skip the actual answer in that cell');
  const {pu, events} = drawing(p, plan);
  const printed = events.find(event => event.kind === 'text');
  const cell = pu.point[ref.puzzle.centerlist[0]];
  assert.equal(printed.value, '23');
  assert.equal(printed.x, cell.x);
  assert.ok(Math.abs(printed.y - (cell.y + .2 * pu.size)) < .005 * pu.size);
  assert.ok(Math.abs(printed.font - .6 * pu.size) < 1e-9);
  assert.ok(events.findIndex(event => event.kind === 'text') > events.findIndex(event => event.kind === 'surface'));
  assert.equal(events.some(event => ['circle', 'polygon'].includes(event.kind)), false,
    'native clue text must not add a white circle or square');
});

test('Penpa renders corner and compass clues at their source positions', () => {
  const p = fixture({rows: 2, cols: 2});
  p.overlays = [label('??', .36, .25, 15.2), label('1?', .86, .75, 15.2),
    label('2?', 1.31, 1.5, 15.2)];
  const plan = planClues(p), {pu, events} = drawing(p, plan);
  assert.equal(plan.count, 3);
  assert.equal(Object.keys(plan.question.numberS).length, 3);
  const origin = pu.point[pu.centerlist[0]];
  const texts = events.filter(event => event.kind === 'text');
  for (let index = 0; index < texts.length; index++) {
    const source = p.overlays[index], actual = texts[index];
    assert.equal(actual.value, source.text);
    assert.ok(Math.abs(actual.x - (origin.x + (source.center[1] - .5) * pu.size)) < 1e-9);
    assert.ok(Math.abs(actual.y - (origin.y + (source.center[0] - .5) * pu.size)) < .012 * pu.size);
    assert.equal(actual.font, .32 * pu.size);
  }
  assert.ok(events.filter(event => event.kind === 'text').length === 3);
  assert.equal(events.some(event => ['circle', 'polygon'].includes(event.kind)), false);
});

test('outside labels and unsupported typography remain in the image', () => {
  const p = fixture({rows: 2, cols: 2});
  p.overlays = [label('12', -.3, .5), label('13', .7, 2.5),
    label('14', .7, .5, 34.4, {angle: 45}),
    label('15', .7, .5, 34.4, {textColor: '#FF0000'}),
    label('16', .7, .5, 34.4, {'font-weight': 'bold'}),
    label('17', .7, .5, 34.4, {'font-family': 'serif'}),
    label('18', .7, .5, 34.4, {opacity: .5}),
    label('19', .7, .5, 34.4, {textAnchor: 'start'}),
    label('20', .7, .5, 34.4, {textStroke: '#FF0000'}),
    label('a', .7, .5), label('21', .7, .5, 22), label('123', .7, .5)];
  const before = clone(p), plan = planClues(p);
  assert.equal(plan.count, 0);
  assert.deepEqual(p, before);
});

test('only text is selected for promotion and shape properties remain unchanged', () => {
  const p = fixture();
  p.underlays = [label('?', .7, .5, 34.4, {target: 'overlay', backgroundColor: '#FFFFFF', width: .6, height: 0})];
  const before = clone(p), plan = planClues(p);
  assert.deepEqual(plan.underlayIndices, [0]);
  assert.deepEqual(plan.overlayIndices, []);
  assert.deepEqual(p, before);
});

test('multiple labels never overwrite one native text slot', () => {
  const p = fixture();
  p.overlays = [label('12', .7, .5), label('34', .7, .5)];
  const plan = planClues(p);
  assert.equal(plan.count, 0);
  assert.deepEqual(plan.question.number, {});
});

test('actual underlays stay below later artwork while overlay-targeted text remains eligible', () => {
  const p = fixture();
  p.underlays = [label('12', .7, .5)];
  assert.equal(planClues(p).count, 0);
  p.underlays[0].target = 'overlay';
  assert.equal(planClues(p).count, 1);
  p.overlays = [{center: [.5, .5], width: 1, height: 1, backgroundColor: '#FFFFFF'}];
  assert.equal(planClues(p).count, 0);
});

test('a later opaque mask or label keeps the text it covers in its original image layer', () => {
  const p = fixture();
  const clue = label('12', .7, .5);
  const mask = {center: [.5, .5], width: 1, height: 1, backgroundColor: '#FFFFFF'};
  p.overlays = [clue, mask];
  assert.equal(planClues(p).count, 0);
  p.overlays = [mask, clue];
  assert.equal(planClues(p).count, 1, 'a mask below the text does not hide it');
  p.overlays = [clue, {...mask, backgroundColor: '#FFFFFF00'}];
  assert.equal(planClues(p).count, 1, 'an invisible rectangle cannot hide text');
  p.overlays = [clue, label('X', .7, .5)];
  assert.equal(planClues(p).count, 0);
  p.overlays = [{...mask, target: 'notes'}, clue];
  assert.equal(planClues(p).count, 0, 'notes are above overlays irrespective of input order');
});

test('real cell notes and givens cannot collide with promoted clue slots', () => {
  const p = fixture();
  p.overlays = [label('12', .7, .5)];
  for (const key of ['pencilMarks', 'centremarks', 'candidates']) {
    p.cells[0][0] = {[key]: ['1']};
    assert.equal(planClues(p).count, 0);
    p.cells[0][0] = {[key]: [' ']};
    assert.equal(planClues(p).count, 1, 'blank source notes are not visible clues');
  }
  p.cells[0][0] = {value: 0};
  assert.equal(planClues(p).count, 0);
});

test('a line above the source text keeps its original order', () => {
  const p = fixture();
  p.overlays = [label('12', .7, .5)];
  const line = {wayPoints: [[.5, 0], [.5, 1]], color: '#000000', thickness: 2};
  p.lines = [{...line, target: 'notes'}];
  assert.equal(planClues(p).count, 0);
  p.lines = [line];
  assert.equal(planClues(p).count, 1);
  p.underlays = [{...p.overlays[0], target: 'overlay'}];
  p.overlays = [];
  p.lines = [{...line, target: 'overlay'}];
  assert.equal(planClues(p).count, 0);
});
