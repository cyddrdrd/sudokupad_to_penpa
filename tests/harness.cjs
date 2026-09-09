'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const AND_OPTIONS = ['surface_exact', 'surface', 'number', 'loopline_exact', 'loopline',
  'ignoreloopline', 'loopedge_exact', 'loopedge', 'ignoreborder', 'wall', 'square',
  'circle', 'tri', 'arrow', 'math', 'battleship', 'tent', 'star', 'akari', 'mine'];
const OR_OPTIONS = AND_OPTIONS.filter(name => !['ignoreloopline', 'ignoreborder'].includes(name));
const clone = value => JSON.parse(JSON.stringify(value));
const inflate = value => zlib.inflateRawSync(Buffer.from(value, 'base64')).toString('utf8');

function createReference(options = {}) {
  const controls = {};
  const and = AND_OPTIONS.map(name => controls['sol_' + name] = {
    id: 'sol_' + name, checked: (options.settings || ['number']).includes(name),
  });
  const or = OR_OPTIONS.map(name => controls['sol_or_' + name] = {
    id: 'sol_or_' + name, checked: false,
  });
  controls.canvas = {getContext: () => ({})};
  controls.dvique = {};
  controls.answersetting = {getElementsByClassName: name => name === 'solcheck' ? and : or};
  const context = vm.createContext({
    console,
    document: {getElementById: id => controls[id] || {checked: false, value: ''}, addEventListener() {}},
    Conflicts: function Conflicts() {},
    UserSettings: {draw_edges: true, tab_settings: [], custom_colors_on: false,
      shorten_links: false, ignore_line_style: false},
    $: () => ({select2: () => []}),
    location: {href: 'https://swaroopg92.github.io/penpa-edit/#m=edit', hash: '#m=edit'},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'reference/penpa-reference.js'), 'utf8'), context);
  const puzzle = new context.PenpaReference.Puzzle('square');
  for (const layer of ['pu_q', 'pu_a', 'pu_q_col', 'pu_a_col']) puzzle.reset_puzzle(layer);
  const rows = options.rows || 2, cols = options.cols || 3;
  Object.assign(puzzle, {nx: cols, ny: rows, nx0: cols + 4, ny0: rows + 4, size: 38,
    centerlist: Array.from({length: rows * cols}, (_, i) =>
      (Math.floor(i / cols) + 2) * (cols + 4) + (i % cols) + 2),
    cellsoutsideFrame: [], frame: {}, space: [0, 0, 0, 0]});
  return {
    puzzle,
    expand(text) {
      for (const [plain, short] of [...context.PenpaReference.COMPRESS_SUB].reverse()) {
        text = text.split(short).join(plain);
      }
      return text;
    },
    answer(question, values) {
      puzzle.pu_q = clone(question);
      puzzle.reset_puzzle('pu_a');
      for (let i = 0; i < values.length; i++) {
        if (values[i] !== '' && values[i] !== '.' && values[i] !== null) {
          puzzle.pu_a.number[puzzle.centerlist[i]] = [String(values[i]), 2, '1'];
        }
      }
      return clone(puzzle.make_solution());
    },
  };
}

function decodePenpa(url) {
  const parsed = new URL(url);
  // Penpa reads these values literally: URLSearchParams would convert '+' to a
  // space and decodeURIComponent would conceal wrongly percent-encoded output.
  const params = Object.fromEntries(parsed.hash.slice(1).split('&').map(part => {
    const split = part.indexOf('=');
    return [part.slice(0, split), part.slice(split + 1)];
  }));
  for (const name of ['p', 'a']) {
    if (params[name] !== undefined && !/^[A-Za-z0-9+/]+={0,2}$/.test(params[name])) {
      throw new Error('Penpa requires literal base64 for ' + name + ', without URI escaping.');
    }
  }
  const raw = inflate(params.p);
  const text = createReference().expand(raw);
  const lines = text.split('\n');
  const header = lines[0].split(',');
  const background = JSON.parse(inflate(header[21]));
  const svg = Buffer.from(background.url.split(',')[1], 'base64').toString('utf8');
  const deltas = JSON.parse(lines[5]);
  let current = 0;
  return {url, params, raw, text, lines, header, background, svg,
    question: JSON.parse(lines[3]), answerLayer: lines[4] ? JSON.parse(lines[4]) : null,
    answer: params.a ? JSON.parse(inflate(params.a)) : null,
    settings: JSON.parse(lines[7]), orSettings: JSON.parse(lines[16]),
    centerlist: deltas.map(delta => current += delta),
    rows: Number(header[2]), cols: Number(header[1])};
}

function loadApp(options = {}) {
  const network = [], artworkInputs = [];
  const context = vm.createContext({
    console, TextEncoder, TextDecoder, Uint8Array, URL, URLSearchParams,
    AbortController, setTimeout, clearTimeout,
    atob: value => atob(value), btoa: value => btoa(value),
    fetch: async (...args) => {
      network.push(args);
      if (options.fetch) return options.fetch(...args);
      throw new Error('Unexpected network request during offline conversion');
    },
  });
  const files = ['vendor/lz-string.min.js', 'vendor/pako.min.js', 'vendor/fpuzzlesdecoder.js',
    'source.js', 'artwork.js', 'converter.js'];
  for (const file of files) {
    if (!fs.existsSync(path.join(ROOT, file))) continue;
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, {filename: file});
  }
  if (options.captureArtwork || options.renderer) {
    const actual = context.SudokuPadArtwork;
    context.SudokuPadArtwork = {...actual, render(puzzle, renderOptions) {
      artworkInputs.push(clone(puzzle));
      return options.renderer ? options.renderer(puzzle, renderOptions) : actual.render(puzzle, renderOptions);
    }};
  }
  return {context, network, artworkInputs,
    convertPuzzle: (puzzle, opts) => context.SudokuPadToPenpa.convertPuzzle(puzzle, opts),
    convert: (input, opts) => context.convertSudokuPadUrlDetailed(input, opts),
    source: context.SudokuPadSource,
    LZString: context.LZString,
    hasSource: Boolean(context.SudokuPadSource),
  };
}

function fixture(options = {}) {
  const rows = options.rows || 2, cols = options.cols || 3;
  const puzzle = {id: 'synthetic-test',
    cells: Array.from({length: rows}, () => Array.from({length: cols}, () => ({}))),
    regions: [], cages: [], metadata: {title: 'Synthetic puzzle', author: 'Converter tests',
      rules: 'This small grid is a serialization test.'}};
  if (options.solution !== undefined) puzzle.metadata.solution = options.solution;
  return puzzle;
}

module.exports = {loadApp, decodePenpa, createReference, fixture, clone, inflate, AND_OPTIONS, OR_OPTIONS};
