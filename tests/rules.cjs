'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {loadApp, decodePenpa, fixture} = require('./harness.cjs');

// Penpa 3.2.4 general.js reads these four delimiters before passing rules to
// DOMPurify and assigning the result to ruletext.innerHTML.
const penpaRulesHtml = header => header.replace(/%2C/g, ',').replace(/%2D/g, '<br>')
  .replace(/%2E/g, '&').replace(/%2F/g, '=');
function convertRules(rules) {
  const puzzle = fixture();
  puzzle.metadata.rules = rules;
  return penpaRulesHtml(decodePenpa(loadApp().convertPuzzle(puzzle).url).header[18]);
}

test('the reported Memories puzzle preserves all five emoji navigation links', () => {
  // Rule-link excerpt from https://sudokupad.app/k7qc98e00u?setting-nogrid.
  const links = [
    ['🔴', 'https://sudokupad.app/mhyr83irby?setting-nogrid'],
    ['⬜', 'https://sudokupad.app/0ppo0tla6w'],
    ['🟨', 'https://sudokupad.app/4hykfvlpnv'],
    ['🟦', 'https://sudokupad.app/k58fj7zxpm?setting-nogrid'],
    ['⬜', 'https://sudokupad.app/t5icydo5uv'],
  ];
  const html = convertRules(links.map(([label, url]) => `[${label}](${url})`).join('\n⠀'));
  assert.equal((html.match(/<a /g) || []).length, 5);
  for (const [label, url] of links) assert.ok(html.includes(`<a href="${url}">${label}</a>`));
  assert.equal((html.match(/<br>⠀/g) || []).length, 4);
});

test('plain rule text cannot become HTML and link labels remain text', () => {
  const html = convertRules('<img src=x onerror=alert(1)> r1c1 < r2c2 & R\n[<svg onload=alert(1)>](https://sudokupad.app/test)');
  assert.equal((html.match(/<a /g) || []).length, 1);
  assert.ok(!/<(?:img|svg)\b/.test(html));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('r1c1 &lt; r2c2 &amp; R'));
  assert.ok(html.includes('>&lt;svg onload=alert(1)&gt;</a>'));
});

test('unsafe, malformed and credential-bearing link destinations stay inert text', () => {
  for (const text of ['[run](javascript:alert(1))', '[run](data:text/html,<script>alert(1)</script>)',
    '[run](https://name:secret@example.com/)', '[run](https://)', '[run](https://example.com/\tbad)',
    '[run](https://example.com/" onmouseover="alert(1))']) {
    assert.ok(!convertRules(text).includes('<a '), text);
  }
});

test('encoded URL punctuation survives Penpa delimiter decoding without changing the destination', () => {
  const html = convertRules('[go](https://sudokupad.app/id?value=%2C%2D%2E%2F&n=1,2)\nKeep literal %2D and %2E.');
  assert.equal(html, '<a href="https://sudokupad.app/id?value=&#37;2C&#37;2D&#37;2E&#37;2F&amp;n=1,2">go</a><br>Keep literal &#37;2D and &#37;2E.');
});

test('array rules, Unicode and SudokuPad literal newline escapes are preserved', () => {
  const html = convertRules(['日本語 🧩', 'A\\nB', 'Use < and >.']);
  assert.equal(html, '日本語 🧩<br>A<br>B<br>Use &lt; and &gt;.');
});

test('Source preserves the original input URL and all query settings', async () => {
  const app = loadApp({fetch: async () => ({ok: true, text: async () => JSON.stringify(fixture())})});
  const input = 'https://sudokupad.app/k7qc98e00u?setting-nogrid.&a=1&copy=2#original';
  const result = await app.convert(input);
  assert.equal(decodePenpa(result.url).header[17], input);
});

test('Source retains a TinyURL input rather than its expanded URL or puzzle payload', async () => {
  let target;
  const input = 'https://tinyurl.com/source-test?x=1&y=2';
  const app = loadApp({fetch: async () => ({ok: true, text: async () =>
    JSON.stringify({success: true, longurl: target})})});
  target = 'https://sudokupad.app/scl' + app.LZString.compressToBase64(JSON.stringify(fixture({solution: '123456'})));
  for (const noSolutionCheck of [false, true]) {
    const result = await app.convert(input, {noSolutionCheck});
    const decoded = decodePenpa(result.url);
    assert.equal(decoded.header[17], input);
    assert.equal(decoded.answer !== null, !noSolutionCheck);
  }
});

test('Source uses a working SudokuPad URL for bare IDs and embedded puzzle data', async () => {
  const app = loadApp({fetch: async () => ({ok: true, text: async () => JSON.stringify(fixture())})});
  for (const input of ['source-test', 'scl' + app.LZString.compressToBase64(JSON.stringify(fixture()))]) {
    const result = await app.convert(input);
    assert.equal(decodePenpa(result.url).header[17], 'https://sudokupad.app/' + input);
  }
});

test('Source escapes header delimiters without damaging grid, rules or background records', () => {
  const input = 'https://sudokupad.app/test?a=1,2\n&b=<x>';
  const decoded = decodePenpa(loadApp().convertPuzzle(fixture(), {sourceUrl: input}).url);
  assert.equal(decoded.header[17], 'https://sudokupad.app/test?a=1%2C2%0A&b=%3Cx%3E');
  assert.equal(decoded.header.length, 22);
  assert.equal(decoded.lines.length, 19);
  assert.equal(decoded.rows, 2);
  assert.equal(decoded.cols, 3);
  assert.ok(decoded.svg.startsWith('<svg'));
});

test('direct conversion cannot inject an unsafe Source scheme', () => {
  for (const sourceUrl of ['javascript:alert(1)', 'data:text/html,<svg>', 'https://name:secret@example.com/']) {
    assert.throws(() => loadApp().convertPuzzle(fixture(), {sourceUrl}), /source must/i);
  }
});
