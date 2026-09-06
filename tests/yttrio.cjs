'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {loadApp, decodePenpa, fixture} = require('./harness.cjs');

// These use synthetic puzzle contents. Real author fixtures and their stored
// answers stay outside the published repository.
for (const input of [
  'https://sudokupad.app/test-author/test-puzzle',
  'https://sudokupad.app/test-author%2Ftest-puzzle',
  'https://app.crackingthecryptic.com/sudoku/test-author/test-puzzle',
  'https://sudokupad.app/?puzzleid=test-author%2Ftest-puzzle',
]) {
  test('creator-named link preserves service path separators: ' + input, async () => {
    const p = fixture({solution: '123456'});
    const app = loadApp({fetch: async url => {
      assert.equal(url, 'https://sudokupad.svencodes.com/ctclegacy/test-author/test-puzzle');
      return {ok: true, text: async () => JSON.stringify(p)};
    }});
    const result = await app.convert(input);
    assert.equal(app.network.length, 1);
    assert.equal(result.includedSolution, true);
    assert.equal(decodePenpa(result.url).answer[4].length, 6);
  });
}

test('creator-named IDs remain one encoded Firebase object key on fallback', async () => {
  const app = loadApp({fetch: async url => {
    if (url === 'https://sudokupad.svencodes.com/ctclegacy/test-author/test-puzzle') {
      return {ok: false, status: 404};
    }
    assert.equal(url, 'https://firebasestorage.googleapis.com/v0/b/sudoku-sandbox.appspot.com/o/test-author%2Ftest-puzzle?alt=media');
    return {ok: true, text: async () => JSON.stringify(fixture())};
  }});
  const result = await app.convert('https://sudokupad.app/test-author/test-puzzle');
  assert.equal(app.network.length, 2);
  assert.equal(result.includedSolution, false);
});

test('the answer-check opt-out also works for creator-named short links', async () => {
  const app = loadApp({fetch: async () => ({ok: true,
    text: async () => JSON.stringify(fixture({solution: '123456'}))})});
  const result = await app.convert('https://sudokupad.app/test-author/test-puzzle', {noSolutionCheck: true});
  assert.equal(result.hasSolution, true);
  assert.equal(result.includedSolution, false);
  assert.equal(decodePenpa(result.url).params.a, undefined);
});

test('creator path support does not permit encoded traversal or foreign hosts', async () => {
  for (const input of [
    'https://sudokupad.app/test-author%2F..%2Ftest-puzzle',
    'https://unrelated.example/test-author/test-puzzle',
  ]) {
    const app = loadApp();
    await assert.rejects(app.convert(input));
    assert.equal(app.network.length, 0);
  }
});
