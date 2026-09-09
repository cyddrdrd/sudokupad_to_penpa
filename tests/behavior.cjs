'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {loadApp, decodePenpa, createReference, fixture, clone} = require('./harness.cjs');

function assertNativeCheck(puzzle, values, options) {
  const app = loadApp();
  const result = app.convertPuzzle(puzzle, options);
  const decoded = decodePenpa(result.url);
  const reference = createReference({rows: decoded.rows, cols: decoded.cols});
  assert.deepEqual(decoded.answer, reference.answer(decoded.question, values),
    'The answer payload must agree with Penpa 3.2.4 make_solution(), not a reimplementation');
  return {app, result, decoded};
}

test('an included source answer produces a Penpa answer check by default', () => {
  const p = fixture({solution: '123456'});
  const {result, decoded} = assertNativeCheck(p, ['1', '2', '3', '4', '5', '6']);
  assert.equal(result.hasSolution, true);
  assert.equal(result.includedSolution, true);
  assert.equal(decoded.params.m, 'solve');
  assert.equal(decoded.settings.sol_number, true);
  assert.deepEqual(Object.keys(decoded.settings).filter(key => decoded.settings[key]), ['sol_number']);
  assert.ok(Object.values(decoded.orSettings).every(value => value === false));
});

test('No solution check removes both answer data and active checker settings', () => {
  const p = fixture({solution: '123456'});
  const result = loadApp().convertPuzzle(p, {noSolutionCheck: true});
  const decoded = decodePenpa(result.url);
  assert.equal(result.hasSolution, true);
  assert.equal(result.includedSolution, false);
  assert.equal(decoded.params.a, undefined);
  assert.equal(decoded.answer, null);
  assert.ok(Object.values(decoded.settings).every(value => value === false));
  assert.ok(Object.values(decoded.orSettings).every(value => value === false));
});

test('a source without an answer never receives an invented answer check', () => {
  const p = fixture();
  const app = loadApp();
  const unchecked = app.convertPuzzle(p);
  const checked = app.convertPuzzle(p, {noSolutionCheck: true});
  assert.equal(unchecked.hasSolution, false);
  assert.equal(unchecked.includedSolution, false);
  assert.equal(decodePenpa(unchecked.url).params.a, undefined);
  assert.equal(checked.url, unchecked.url);
});

test('single-digit values coexist with 10 and 11 in the native checker', () => {
  const values = ['7', '10', '11', '4', '5', '6'];
  const {decoded} = assertNativeCheck(fixture({solution: values}), values);
  assert.deepEqual(decoded.answer[4].map(entry => entry.slice(entry.indexOf(',') + 1)).sort(), [...values].sort());
});

for (const [name, solution, values] of [
  ['comma-separated multi-digit answer', '1,10,11,4,5,6', ['1', '10', '11', '4', '5', '6']],
  ['two-dimensional answer array', [[1, 10, 11], [4, 5, 6]], ['1', '10', '11', '4', '5', '6']],
  ['zero-valued answer cells', [0, 1, 10, 11, 4, 5], ['0', '1', '10', '11', '4', '5']],
  ['alphabet answer cells', ['A', 'B', 'c', 'D', 'E', 'F'], ['A', 'B', 'c', 'D', 'E', 'F']],
  ['unused solution cells', '..1234', ['', '', '1', '2', '3', '4']],
]) {
  test(name + ' agrees with native Penpa answer serialization', () => {
    assertNativeCheck(fixture({solution}), values);
  });
}

test('given digits remain black clues and are excluded from native answer checking', () => {
  const values = ['1', '10', '11', '4', '5', '6'];
  const p = fixture({solution: values});
  p.cells[0][0].value = 1;
  p.cells[0][1].value = '10';
  const {decoded} = assertNativeCheck(p, values);
  assert.deepEqual(Object.values(decoded.question.number), [['1', 1, '1'], ['10', 1, '1']]);
  assert.equal(decoded.answer[4].length, 4);
  for (const id of Object.keys(decoded.question.number)) {
    assert.ok(!decoded.answer[4].some(entry => entry.startsWith(id + ',')));
  }
});

test('zero-valued givens are preserved rather than treated as empty cells', () => {
  const p = fixture({solution: '012345'});
  p.cells[0][0].value = 0;
  const {decoded} = assertNativeCheck(p, ['0', '1', '2', '3', '4', '5']);
  assert.deepEqual(Object.values(decoded.question.number), [['0', 1, '1']]);
  assert.equal(decoded.answer[4].length, 5);
});

test('checked solve links start with an empty answer layer and empty histories', () => {
  const decoded = decodePenpa(loadApp().convertPuzzle(fixture({solution: '123456'})).url);
  assert.equal(decoded.answerLayer, null);
  for (const key of ['command_redo', 'command_undo', 'command_replay']) {
    assert.deepEqual(decoded.question[key], {__a: []});
  }
  assert.deepEqual(decoded.question.number, {});
  assert.deepEqual(decoded.question.numberS, {});
  assert.deepEqual(decoded.question.symbol, {});
});

test('original puzzle objects and metadata are not mutated during conversion', () => {
  const p = fixture({solution: '123456'});
  p.cages.push({cells: [[0, 0], [0, 1]], value: '3'});
  const before = clone(p);
  loadApp().convertPuzzle(p);
  assert.deepEqual(p, before);
});

test('solution metadata and legacy answer cages are never passed into artwork', () => {
  const p = fixture({solution: '123456'});
  p.solution = '123456';
  p.metaData = {solution: '123456'};
  p.cages.push({value: 'solution: 123456'}, {value: 'title: Older title'});
  p.cages.push({cells: [[0, 0]], value: '1'});
  const app = loadApp({captureArtwork: true});
  for (const noSolutionCheck of [false, true]) {
    const decoded = decodePenpa(app.convertPuzzle(p, {noSolutionCheck}).url);
    assert.ok(!decoded.svg.includes('123456'));
    assert.ok(!decoded.text.includes('solution: 123456'));
  }
  for (const visible of app.artworkInputs) {
    assert.equal(visible.solution, undefined);
    assert.equal(visible.metaData, undefined);
    assert.equal(visible.metadata.solution, undefined);
    assert.deepEqual(visible.cages, [{cells: [[0, 0]], value: '1'}]);
  }
});

test('UTF-8 title, author, rules and compression-looking text survive Penpa encoding', () => {
  const p = fixture();
  p.metadata = {title: 'Café, 数独 🧩 zN', author: '作者, Zoë', rules: 'Use zN and "number".\n规则: A=B & C,D'};
  const decoded = decodePenpa(loadApp().convertPuzzle(p).url);
  assert.equal(decoded.header[15], 'Title: Café%2C 数独 🧩 zN');
  assert.equal(decoded.header[16], 'Author: 作者%2C Zoë');
  assert.equal(decoded.header[18], 'Use zN and %2Equot;number%2Equot;.%2D规则: A%2FB %2Eamp; C%2CD');
});

test('legacy metadata cages and current metadata have deterministic precedence', () => {
  const p = fixture();
  delete p.metadata;
  p.title = 'Top-level title';
  p.cages = [{value: 'title: Cage title'}, {value: 'author: Legacy author'},
    {value: 'rules: First line\nSecond line'}, {value: 'solution: 123456'}];
  p.metaData = {title: 'Old metadata title'};
  p.metadata = {title: 'Current metadata title'};
  const {decoded} = assertNativeCheck(p, ['1', '2', '3', '4', '5', '6']);
  assert.equal(decoded.header[15], 'Title: Current metadata title');
  assert.equal(decoded.header[16], 'Author: Legacy author');
  assert.equal(decoded.header[18], 'First line%2DSecond line');
});

for (const [rows, cols] of [[2, 3], [3, 2], [3, 3], [2, 2], [4, 9], [9, 4]]) {
  test(`${rows} by ${cols} grid retains its dimensions and row-major active cells`, () => {
    const decoded = decodePenpa(loadApp().convertPuzzle(fixture({rows, cols})).url);
    assert.equal(decoded.rows, rows);
    assert.equal(decoded.cols, cols);
    const native = createReference({rows, cols});
    assert.deepEqual(decoded.centerlist, native.puzzle.centerlist);
    assert.equal(new Set(decoded.centerlist).size, rows * cols);
  });
}

test('invalid or partial stored answers fail clearly and can be omitted explicitly', () => {
  for (const solution of ['12345', '12?456', ['1', '2', {}, '4', '5', '6']]) {
    const app = loadApp();
    const p = fixture({solution});
    assert.throws(() => app.convertPuzzle(p), /stored answer|partial answer/i);
    const result = app.convertPuzzle(p, {noSolutionCheck: true});
    assert.equal(result.includedSolution, false);
    assert.equal(decodePenpa(result.url).params.a, undefined);
  }
});

test('a given conflicting with the stored answer fails unless checking is omitted', () => {
  const p = fixture({solution: '123456'});
  p.cells[0][0].value = '9';
  const app = loadApp();
  assert.throws(() => app.convertPuzzle(p), /given conflicts/i);
  const decoded = decodePenpa(app.convertPuzzle(p, {noSolutionCheck: true}).url);
  assert.deepEqual(Object.values(decoded.question.number), [['9', 1, '1']]);
  assert.equal(decoded.answer, null);
});

test('empty, malformed and ragged grids fail before producing a link', () => {
  const app = loadApp();
  for (const puzzle of [null, {}, {cells: []}, {cells: [[{}], [{}, {}]]}, {cells: [[null]]}]) {
    assert.throws(() => app.convertPuzzle(puzzle), /invalid|grid|different lengths/i);
  }
});

test('direct puzzle conversion performs no networking', () => {
  const app = loadApp();
  app.convertPuzzle(fixture({solution: '123456'}));
  assert.equal(app.network.length, 0);
});

test('Penpa payloads are literal base64 and a URI-escaped variant fails the loader contract', () => {
  const url = loadApp().convertPuzzle(fixture({solution: '123456'})).url;
  const decoded = decodePenpa(url);
  assert.match(decoded.params.p, /[+/=]/);
  const escaped = url.replace(/([#&]p=)([^&]+)/, (_, key, value) => key + encodeURIComponent(value));
  assert.throws(() => decodePenpa(escaped), /literal base64/);
});

for (const prefix of ['scl', 'ctc']) {
  for (const location of ['raw', 'path', 'query', 'legacy']) {
    test(`${prefix} ${location} full links convert offline with their existing answer`, async () => {
      const app = loadApp();
      const p = fixture({solution: '123456'});
      const data = prefix + app.LZString.compressToBase64(JSON.stringify(p));
      const input = location === 'raw' ? data : location === 'path' ? 'https://sudokupad.app/' + data :
        location === 'query' ? 'https://sudokupad.app/?puzzleid=' + data :
        'https://app.crackingthecryptic.com/sudoku/' + data;
      const result = await app.convert(input);
      const decoded = decodePenpa(result.url);
      assert.equal(result.format, 'scl');
      assert.equal(result.includedSolution, true);
      assert.deepEqual(decoded.answer, createReference().answer(decoded.question, ['1', '2', '3', '4', '5', '6']));
      assert.equal(app.network.length, 0);
    });
  }
}

test('percent-encoded embedded SudokuPad payloads preserve literal plus characters', async () => {
  const app = loadApp();
  const data = 'scl' + app.LZString.compressToBase64(JSON.stringify(fixture({solution: '123456'})));
  const a = await app.convert('https://sudokupad.app/' + data);
  const b = await app.convert('https://sudokupad.app/' + encodeURIComponent(data));
  const decodedA = decodePenpa(a.url), decodedB = decodePenpa(b.url);
  assert.equal(decodedA.header[17], 'https://sudokupad.app/' + data);
  assert.equal(decodedB.header[17], 'https://sudokupad.app/' + encodeURIComponent(data));
  assert.deepEqual(decodedA.header.filter((_, index) => index !== 17),
    decodedB.header.filter((_, index) => index !== 17));
  assert.deepEqual(decodedA.lines.slice(1), decodedB.lines.slice(1));
  assert.deepEqual(decodedA.answer, decodedB.answer);
  assert.equal(app.network.length, 0);
});

test('compact native syntax preserves blanks, shorthand colors and quoted punctuation', async () => {
  const app = loadApp();
  const compact = "{id:'compact',ce:[[,,],[,,]],metadata:{t:'Compact, café',rules:'Keep ,:{} and zN literal.',solution:'123456'},u:[{ct:[0.5,0.5],w:0.5,h:0.5,c2:00ff00,r:t}]}";
  const data = 'scl' + app.LZString.compressToBase64(compact);
  const source = await app.source.decode(data);
  assert.deepEqual(clone(source.puzzle.cells), [[{}, {}, {}], [{}, {}, {}]]);
  assert.equal(source.puzzle.underlays[0].backgroundColor, '#00ff00');
  assert.equal(source.puzzle.underlays[0].rounded, true);
  assert.equal(source.puzzle.metadata.rules, 'Keep ,:{} and zN literal.');
  const result = await app.convert(data);
  assert.equal(decodePenpa(result.url).header[15], 'Title: Compact%2C café');
  assert.equal(result.includedSolution, true);
  assert.equal(app.network.length, 0);
});

test('plain JSON parsing keeps strings and empty arrays without compact reinterpretation', () => {
  const app = loadApp();
  const value = {cages: [], cells: [[{}, {}]], metadata: {title: '123456', rules: "Braces {}, commas , and quotes ' remain text."}};
  assert.deepEqual(clone(app.source.parseData(JSON.stringify(value))), value);
});

test('puzzle data is parsed as data and cannot run JavaScript or pollute prototypes', () => {
  const app = loadApp();
  for (const input of [
    '{ce:[[{}]],x:(globalThis.pwned=true)}',
    '{"cells":[[{}]],"__proto__":{"polluted":true}}',
    '{ce:[[{}]],constructor:{prototype:{polluted:t}}}',
    '{ce:[[{}]],ce:[[{}]]}',
  ]) assert.throws(() => app.source.parseData(input), /not valid|property name/i);
  assert.equal(app.context.pwned, undefined);
  assert.equal({}.polluted, undefined);
});

for (const kind of ['fpuz', 'fpuzzles', 'f-puzzles-url']) {
  test(`${kind} full input preserves explicit mixed-digit answers and given flags`, async () => {
    const app = loadApp();
    const fp = {size: 2, title: 'F-puzzles test', author: 'Tests', ruleset: 'A synthetic encoding test.',
      grid: [[{value: 1, given: true}, {}], [{}, {}]], solution: [1, 10, 11, 4]};
    const compressed = app.LZString.compressToBase64(JSON.stringify(fp));
    const input = kind === 'f-puzzles-url' ? 'https://f-puzzles.com/?load=' + compressed :
      'https://sudokupad.app/' + kind + compressed;
    const result = await app.convert(input);
    const decoded = decodePenpa(result.url);
    assert.equal(result.format, 'fpuz');
    assert.deepEqual(decoded.answer, createReference({rows: 2, cols: 2}).answer(decoded.question, ['1', '10', '11', '4']));
    assert.deepEqual(Object.values(decoded.question.number), [['1', 1, '1']]);
    const noCheck = await app.convert(input, {noSolutionCheck: true});
    assert.equal(decodePenpa(noCheck.url).params.a, undefined);
    assert.equal(app.network.length, 0);
  });
}

test('a full F-puzzles grid can supply checking while nongiven digits remain hidden', async () => {
  const app = loadApp();
  const fp = {size: 2, grid: [[{value: 1, given: true}, {value: 2}], [{value: 2}, {value: 1}]]};
  const input = 'fpuz' + app.LZString.compressToBase64(JSON.stringify(fp));
  const result = await app.convert(input);
  const decoded = decodePenpa(result.url);
  assert.equal(result.includedSolution, true);
  assert.equal(Object.keys(decoded.question.number).length, 1);
  assert.equal(decoded.answerLayer, null);
  assert.deepEqual(decoded.answer, createReference({rows: 2, cols: 2}).answer(decoded.question, ['1', '2', '2', '1']));
});

test('an incomplete F-puzzles grid without explicit solution does not invent one', async () => {
  const app = loadApp();
  const input = 'fpuz' + app.LZString.compressToBase64(JSON.stringify({size: 2,
    grid: [[{value: 1, given: true}, {}], [{}, {}]]}));
  const result = await app.convert(input);
  assert.equal(result.hasSolution, false);
  assert.equal(decodePenpa(result.url).params.a, undefined);
});

for (const placeholder of [[], '', '0000', ['.', '.', '.', '.']]) {
  test(`F-puzzles placeholder ${JSON.stringify(placeholder)} is not mistaken for an answer`, async () => {
    const app = loadApp();
    const input = 'fpuz' + app.LZString.compressToBase64(JSON.stringify({size: 2,
      grid: [[{}, {}], [{}, {}]], solution: placeholder}));
    const result = await app.convert(input);
    assert.equal(result.hasSolution, false);
    assert.equal(decodePenpa(result.url).params.a, undefined);
  });
}

test('No solution check omits a fully populated F-puzzles answer without revealing nongivens', async () => {
  const app = loadApp({captureArtwork: true});
  const fp = {size: 2, grid: [[{value: 1, given: true}, {value: 2}], [{value: 2}, {value: 1}]]};
  const result = await app.convert('fpuz' + app.LZString.compressToBase64(JSON.stringify(fp)), {noSolutionCheck: true});
  const decoded = decodePenpa(result.url);
  assert.equal(decoded.params.a, undefined);
  assert.deepEqual(Object.values(decoded.question.number), [['1', 1, '1']]);
  assert.equal(app.artworkInputs[0].metadata.solution, undefined);
  assert.equal(app.artworkInputs[0].cells.flat().filter(cell => cell.value !== undefined).length, 1);
});

test('a malformed F-puzzles checker can be deliberately omitted without losing the puzzle', async () => {
  const app = loadApp();
  const input = 'fpuz' + app.LZString.compressToBase64(JSON.stringify({size: 2,
    grid: [[{value: 1, given: true}, {}], [{}, {}]], solution: {unsupported: true}}));
  await assert.rejects(app.convert(input), /stored answer|unsupported format/i);
  const result = await app.convert(input, {noSolutionCheck: true});
  assert.equal(result.includedSolution, false);
  assert.deepEqual(Object.values(decodePenpa(result.url).question.number), [['1', 1, '1']]);
});

test('global constraints survive native source normalization as visible rules', async () => {
  const app = loadApp();
  const p = fixture();
  p.global = ['antiknight', 'antiking', 'nonconsecutive'];
  const result = await app.convert('scl' + app.LZString.compressToBase64(JSON.stringify(p)));
  const rules = decodePenpa(result.url).header[18];
  assert.match(rules, /knight/i);
  assert.match(rules, /king/i);
  assert.match(rules, /consecutive/i);
});

test('unknown global constraints fail instead of silently disappearing', async () => {
  const app = loadApp();
  const p = fixture();
  p.global = ['unimplemented-global-rule'];
  await assert.rejects(app.convert('scl' + app.LZString.compressToBase64(JSON.stringify(p))), /Unsupported global/);
});

for (const compressed of [false, true]) {
  test(`${compressed ? 'compressed' : 'plain'} SCF input keeps givens and never invokes a solver`, async () => {
    const app = loadApp();
    const scf = '1' + '0'.repeat(80) + '*xtTesting**star*aWriter';
    const input = 'scf' + (compressed ? app.LZString.compressToBase64(scf) : scf);
    const result = await app.convert(input);
    const decoded = decodePenpa(result.url);
    assert.equal(result.format, 'scf');
    assert.equal(result.hasSolution, false);
    assert.equal(decoded.params.a, undefined);
    assert.equal(decoded.rows, 9);
    assert.deepEqual(Object.values(decoded.question.number), [['1', 1, '1']]);
    assert.equal(decoded.header[15], 'Title: Testing*star');
    assert.equal(decoded.header[16], 'Author: Writer');
    assert.equal(app.network.length, 0);
  });
}

test('short native IDs accept a plain JSON service response and retain URL display settings', async () => {
  const p = fixture({solution: '123456'});
  const app = loadApp({fetch: async () => ({ok: true, text: async () => JSON.stringify(p)})});
  const result = await app.convert('https://sudokupad.app/example-test?setting-nogrid=1');
  assert.equal(result.includedSolution, true);
  assert.equal(app.network.length, 1);
  assert.equal(app.network[0][1].credentials, 'omit');
  assert.match(app.network[0][0], /ctclegacy\/example-test$/);
  assert.match(decodePenpa(result.url).svg, /data-layer="cell-grids"><\/g>/);
});

test('short links fall back to the official legacy service after a failed first response', async () => {
  let count = 0;
  const app = loadApp({fetch: async () => ++count === 1 ?
    {ok: false, status: 404} : {ok: true, text: async () => JSON.stringify(fixture())}});
  const result = await app.convert('https://sudokupad.app/example-test');
  assert.equal(result.hasSolution, false);
  assert.equal(app.network.length, 2);
  assert.match(app.network[1][0], /firebasestorage\.googleapis\.com/);
});

test('TinyURL expansion keeps the existing worker response contract', async () => {
  let compressed;
  const app = loadApp({fetch: async url => {
    assert.match(url, /^https:\/\/tinyurl-expand\.cyddrdrd\.workers\.dev\/\?url=/);
    return {ok: true, text: async () => JSON.stringify({success: true,
      longurl: 'https://sudokupad.app/scl' + compressed})};
  }});
  compressed = app.LZString.compressToBase64(JSON.stringify(fixture({solution: '123456'})));
  const result = await app.convert('https://tinyurl.com/example-test', {noSolutionCheck: true});
  assert.equal(result.hasSolution, true);
  assert.equal(result.includedSolution, false);
  assert.equal(app.network.length, 1);
});

test('shortener redirect loops fail rather than repeatedly fetching indefinitely', async () => {
  const app = loadApp({fetch: async () => ({ok: true, text: async () => JSON.stringify({success: true,
    longurl: 'https://tinyurl.com/example-loop'})})});
  await assert.rejects(app.convert('https://tinyurl.com/example-loop'), /loop/i);
  assert.equal(app.network.length, 1);
});

test('fog and interactive puzzle data fail rather than producing a misleading static link', async () => {
  for (const extension of [{foglight: [[0, 0]]}, {fogofwar: true}, {events: [{type: 'reveal'}]}]) {
    const app = loadApp();
    const p = Object.assign(fixture(), extension);
    const input = 'scl' + app.LZString.compressToBase64(JSON.stringify(p));
    await assert.rejects(app.convert(input), /Fog of war|interactive/);
    assert.equal(app.network.length, 0);
  }
});

test('unsupported hosts and invalid source syntax do not trigger networking', async () => {
  const app = loadApp();
  for (const input of ['https://example.com/puzzle', 'https://sudokupad.app.evil.test/example',
    'https://name:secret@sudokupad.app/example', 'scl!invalid', JSON.stringify(fixture())]) {
    await assert.rejects(app.convert(input));
  }
  assert.equal(app.network.length, 0);
});

test('author labels interleaved with lines do not prevent conversion or change drawing order', () => {
  const p = fixture({solution: '123456'});
  const first = {wayPoints: [[0.5, 0.5], [0.5, 1.5]], color: '#f88', thickness: 9};
  const second = {wayPoints: [[0.5, 1.5], [1.5, 1.5]], color: '#9f9', thickness: 9};
  p.lines = ['entropic', first, 'whisper', second, '<script>not executable</script>'];
  const app = loadApp();
  for (const noSolutionCheck of [false, true]) {
    const withLabels = app.convertPuzzle(p, {noSolutionCheck});
    const withoutLabels = app.convertPuzzle({...p, lines: [first, second]}, {noSolutionCheck});
    assert.equal(withLabels.url, withoutLabels.url);
    assert.equal(withLabels.includedSolution, !noSolutionCheck);
  }
  for (const invalid of [null, 17, false, []]) {
    assert.throws(() => app.convertPuzzle({...p, lines: [invalid]}), /line must be an object/);
  }
});

test('zero-width rotated emoji overlays remain visible SVG text', () => {
  const p = fixture();
  p.overlays = [{center: [.5, .5], width: 0, height: 1.3, text: '🥚', fontSize: 46.8, angle: 19}];
  const {svg} = decodePenpa(loadApp().convertPuzzle(p).url);
  assert.match(svg, /🥚/);
  assert.match(svg, /rotate\(19/);
  assert.match(svg, /<text\b/);
});

test('drawing text is escaped instead of becoming SVG markup', () => {
  const p = fixture();
  p.overlays = [{center: [.5, .5], width: 1, height: 1, text: '<script>& 日本語 🧩', fontSize: 14}];
  const {svg} = decodePenpa(loadApp().convertPuzzle(p).url);
  assert.ok(!svg.includes('<script>'));
  assert.match(svg, /&lt;script&gt;&amp; 日本語 🧩/);
});

test('unsafe SVG attributes and remote paint references are rejected', () => {
  for (const unsafe of [{onclick: 'alert(1)'}, {href: 'https://example.com/image.svg'},
    {backgroundColor: 'url(https://example.com/pattern.svg)'}]) {
    const p = fixture();
    p.overlays = [{center: [.5, .5], width: 1, height: 1, ...unsafe}];
    assert.throws(() => loadApp().convertPuzzle(p), /unsafe|unsupported/i);
  }
});

test('valid SVG path data preserves curves, relative commands and arcs', () => {
  const p = fixture();
  p.lines = [{d: 'M0 0 L64 0 h10 v10 C64 10 64 30 50 30 s-10 10 -20 0 Q10 20 10 10 t10 -10 A5 5 0 0 1 0 0 z',
    color: '#123456', thickness: 2}];
  const {svg} = decodePenpa(loadApp().convertPuzzle(p).url);
  assert.match(svg, /d="M 0 0 L 64 0 h 10 v 10 C/);
  assert.match(svg, /A 5 5 0 0 1 0 0 z/);
});

test('malformed or unsafe raw SVG path data is rejected', () => {
  for (const d of ['M0 0 L4', 'M0 0<script/>', 'url(https://example.com)',
    'M0 0 A5 5 0 2 1 10 10', 'M0 0 L1e20 0']) {
    const p = fixture();
    p.lines = [{d, color: '#000000', thickness: 2}];
    assert.throws(() => loadApp().convertPuzzle(p), /SVG|unsupported|finite number/);
  }
});

test('drawing layer targets and alpha colors survive the embedded background', () => {
  const p = fixture();
  p.underlays = [{center: [.5, .5], width: .8, height: .1, angle: 43, backgroundColor: '#fff6'}];
  p.lines = [{wayPoints: [[0, 0], [1, 1]], target: 'overlay', color: '#12345678', thickness: 2}];
  const {svg} = decodePenpa(loadApp().convertPuzzle(p).url);
  assert.match(svg, /#fff6/);
  assert.match(svg, /#12345678/);
  assert.match(svg, /rotate\(43/);
  const overlayStart = svg.indexOf('data-layer="overlay"');
  const lineColor = svg.indexOf('#12345678');
  assert.ok(overlayStart < lineColor);
  assert.ok(svg.indexOf('data-layer="underlay"') < svg.indexOf('data-layer="cell-grids"'));
  assert.ok(svg.indexOf('data-layer="cell-grids"') < overlayStart);
});

test('hidden cages remain hidden and do not add outlines or clue numbers', () => {
  const p = fixture();
  p.cages = [{cells: [[0, 0], [0, 1]], value: '987', hidden: true, unique: true}];
  const {svg} = decodePenpa(loadApp().convertPuzzle(p).url);
  assert.ok(!svg.includes('987'));
  assert.match(svg, /data-layer="cages"><\/g>/);
});

test('standard grid suppression and dashed-grid settings are carried into Penpa', () => {
  const p = fixture();
  const app = loadApp();
  p.settings = {nogrid: true};
  const hidden = decodePenpa(app.convertPuzzle(p).url);
  assert.match(hidden.svg, /data-layer="cell-grids"><\/g>/);
  assert.equal(JSON.parse(hidden.lines[11]).grid[0], '3');
  p.settings = {dashedgrid: true};
  const dashed = decodePenpa(app.convertPuzzle(p).url);
  assert.equal(JSON.parse(dashed.lines[11]).grid[0], '2');
  assert.match(dashed.svg, /data-layer="cell-grids"><\/g>/);
});

test('concave and ring-shaped cages retain distinct outer and inner boundaries', () => {
  const p = fixture({rows: 3, cols: 3});
  p.cages = [{cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]], value: '40'}];
  const {svg} = decodePenpa(loadApp().convertPuzzle(p).url);
  const cageLayer = svg.match(/<g data-layer="cages">([\s\S]*?)<\/g>/)[1];
  const shape = cageLayer.match(/<path[^>]+d="([^"]+)"/)[1];
  assert.ok((shape.match(/M/g) || []).length >= 2, 'A ring cage needs separate exterior and hole subpaths');
  assert.match(cageLayer, />40<\/text>/);
});
