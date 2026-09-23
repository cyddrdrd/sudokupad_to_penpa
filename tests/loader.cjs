'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const {loadApp, fixture} = require('./harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const general = fs.readFileSync(path.join(ROOT, 'penpa/js/general.js'), 'utf8');
// Execute the production entry point, without the rest of the editor's UI code.
const bootSource = general.slice(general.indexOf('async function boot()'),
  general.indexOf('\nfunction boot_parameters()'));
const BASE = 'https://cyddrdrd.github.io/sudokupad_to_penpa/penpa/';
const PARAMS = 'm=solve&p=ab+/cd==&a=ef+/gh==';

async function boot(url, savedProgress) {
  const loaded = [], restored = [], hashed = [];
  let created = 0;
  const context = vm.createContext({
    console, location: new URL(url),
    document: {
      getElementById: () => ({appendChild() {}}),
      createElement: () => ({}),
    },
    boot_parameters() {}, init_genre_tags() {},
    set_answer_setting_table_to() {}, set_input_patterns() {},
    create() {created++;},
    load(...args) {loaded.push(args);},
    md5(value) {
      hashed.push(value);
      return createHash('md5').update(value).digest('hex');
    },
    async restoreProgress(hash) {restored.push(hash); return savedProgress;},
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'penpa/js/progress.js'), 'utf8'), context);
  vm.runInContext('PenpaProgress.tryLoad = restoreProgress;', context);
  vm.runInContext(bootSource, context, {filename: 'penpa/js/general.js'});
  await context.boot();
  return {loaded, restored, hashed, created};
}

for (const noSolutionCheck of [false, true]) {
  test(`boot loads the exact generated URL with noSolutionCheck=${noSolutionCheck}`, async () => {
    const {url} = loadApp().convertPuzzle(fixture({solution: '12345?'}), {noSolutionCheck});
    const result = await boot(url);
    assert.deepEqual(result.loaded, [[new URL(url).hash.slice(1)]]);
    assert.equal(result.created, 0);
    assert.equal(result.restored.length, 1);
  });
}

for (const [name, suffix] of [
  ['already shared 0.2.4 links', '?v=0.2.4#' + PARAMS],
  ['fragment links without a query', '#' + PARAMS],
  ['legacy query links', '?' + PARAMS],
  ['legacy query links with an unrelated fragment', '?' + PARAMS + '#rules'],
]) {
  test(`boot supports ${name} and preserves literal base64`, async () => {
    const result = await boot(BASE + suffix);
    assert.deepEqual(result.loaded, [[PARAMS]]);
    assert.deepEqual(result.hashed, ['ab+/cd']); // Keep Penpa's existing progress key.
    assert.equal(result.created, 0);
  });
}

for (const suffix of ['', '?v=0.2.4', '?v=0.2.4#rules']) {
  test(`boot opens a new editor when there is no puzzle: ${suffix || '(bare URL)'}`, async () => {
    const result = await boot(BASE + suffix);
    assert.equal(result.created, 1);
    assert.deepEqual(result.loaded, []);
    assert.deepEqual(result.hashed, []);
    assert.deepEqual(result.restored, []);
  });
}

for (const separator of ['?', '#']) {
  test(`boot still restores progress saved in a ${separator} link`, async () => {
    const saved = 'm=solve&p=saved+/progress==&l=solvedup';
    const result = await boot(BASE + '?v=0.2.4#' + PARAMS, BASE + separator + saved);
    assert.deepEqual(result.loaded, [[saved, 'localstorage', 'ab+/cd']]);
    assert.equal(result.created, 0);
  });
}
