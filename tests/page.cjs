'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {randomUUID} = require('node:crypto');

const INPUT = 'https://sudokupad.app/k7qc98e00u?setting-nogrid.';
const OUTPUT = 'https://swaroopg92.github.io/penpa-edit/#m=solve&p=fixture';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}

async function flush() {
  for (let i = 0; i < 15; i++) await Promise.resolve();
}

function page(options = {}) {
  const controls = Object.fromEntries([
    'inputUrl', 'outputUrl', 'noSolutionCheck', 'status',
    'convertOpenButton', 'convertButton', 'copyButton'
  ].map(id => [id, {
    value: '', checked: false, disabled: false, readOnly: false,
    textContent: '', className: '', listeners: {},
    addEventListener(event, listener) {this.listeners[event] = listener;}
  }]));
  controls.inputUrl.value = options.input === undefined ? INPUT : options.input;
  controls.noSolutionCheck.checked = !!options.noSolutionCheck;
  const requests = [], conversions = [], popups = [], warnings = [];
  const timers = new Map();
  const events = {};
  let timerId = 0;
  const context = vm.createContext({
    TextEncoder, AbortController, Date,
    crypto: {randomUUID},
    console: {warn(...message) {warnings.push(message);}},
    document: {
      getElementById(id) {assert.ok(controls[id], 'Unexpected page element: ' + id); return controls[id];},
      addEventListener(event, listener) {events[event] = listener;}
    },
    window: {open(url, target) {
      const popup = {url, target, closed: false, opener: {},
        close() {this.closed = true;},
        location: {replace(destination) {popup.url = destination;}}
      };
      popups.push(popup);
      return options.popupBlocked ? null : popup;
    }},
    navigator: {clipboard: {async writeText() {}}},
    setTimeout(callback, delay) {timers.set(++timerId, {callback, delay}); return timerId;},
    clearTimeout(id) {timers.delete(id);},
    async fetch(url, init) {
      const request = {url, init, event: JSON.parse(init.body)};
      requests.push(request);
      if (options.fetch) return options.fetch(request, requests.length);
      return {ok: true, status: 201};
    },
    async convertSudokuPadUrlDetailed(input, settings) {
      conversions.push({input, settings: {...settings}});
      if (options.convert) return options.convert(input, settings);
      return {url: OUTPUT, format: 'scl', includedSolution: !settings.noSolutionCheck, warnings: []};
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../page.js'), 'utf8'), context, {filename: 'page.js'});
  events.DOMContentLoaded();
  return {controls, requests, conversions, popups, warnings, timers,
    click(id = 'convertButton') {return controls[id].listeners.click();},
    async nextTimer() {
      assert.ok(timers.size, 'A retry or timeout should have been scheduled');
      const [id, timer] = [...timers].sort((a, b) => a[1].delay - b[1].delay)[0];
      timers.delete(id);
      timer.callback();
      await flush();
    }
  };
}

for (const noSolutionCheck of [false, true]) {
  test('successful conversion records the exact URLs and checkbox=' + noSolutionCheck, async () => {
    const app = page({input: '  ' + INPUT + '  ', noSolutionCheck});
    assert.equal(await app.click(), OUTPUT);
    await flush();
    assert.deepEqual(app.conversions, [{input: INPUT, settings: {noSolutionCheck}}]);
    assert.equal(app.controls.outputUrl.value, OUTPUT);
    assert.equal(app.requests.length, 1);
    const {url, init, event} = app.requests[0];
    assert.equal(url, 'https://sudokupad-to-penpa-log.cyddrdrd.workers.dev/log');
    assert.equal(init.method, 'POST');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.equal(init.keepalive, true);
    assert.deepEqual({...event, eventId: undefined, startedAt: undefined}, {
      eventId: undefined, startedAt: undefined, inputUrl: INPUT, noSolutionCheck,
      outputUrl: OUTPUT, inputFormat: 'scl', error: null, version: '0.2.1', status: 'success'
    });
    assert.match(event.eventId, /^[a-f0-9-]{36}$/);
    assert.equal(new Date(event.startedAt).toISOString(), event.startedAt);
    assert.equal(app.controls.convertButton.disabled, false);
    assert.equal(app.controls.inputUrl.readOnly, false);
    assert.equal(app.controls.noSolutionCheck.disabled, false);
    assert.match(app.controls.status.textContent, noSolutionCheck ? /No solution check included/ : /Answer check included/);
    assert.equal(app.timers.size, 0);
  });
}

test('conversion failures record an error and clear any older successful output', async () => {
  const app = page({noSolutionCheck: true, convert() {throw new Error('Unsupported puzzle feature');}});
  app.controls.outputUrl.value = 'stale result';
  assert.equal(await app.click(), null);
  await flush();
  assert.equal(app.controls.outputUrl.value, '');
  assert.match(app.controls.status.textContent, /Unsupported puzzle feature/);
  assert.equal(app.controls.convertButton.disabled, false);
  assert.equal(app.requests.length, 1);
  const event = app.requests[0].event;
  assert.equal(event.status, 'error');
  assert.equal(event.error, 'Unsupported puzzle feature');
  assert.equal(event.outputUrl, null);
  assert.equal(event.inputFormat, null);
  assert.equal(event.noSolutionCheck, true);
  assert.equal(event.inputUrl, INPUT);
});

test('empty input is a recorded failed attempt without running the converter', async () => {
  const app = page({input: ' \n ', noSolutionCheck: true});
  assert.equal(await app.click(), null);
  await flush();
  assert.equal(app.conversions.length, 0);
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].event.inputUrl, '');
  assert.equal(app.requests[0].event.status, 'error');
  assert.equal(app.requests[0].event.noSolutionCheck, true);
  assert.equal(app.requests[0].event.error, app.controls.status.textContent);
  assert.equal(app.requests[0].event.outputUrl, null);
});

test('Convert and Open opens the converted puzzle and records only one attempt', async () => {
  const app = page();
  await app.click('convertOpenButton');
  await flush();
  assert.equal(app.conversions.length, 1);
  assert.equal(app.requests.length, 1);
  assert.equal(app.popups.length, 1);
  assert.equal(app.popups[0].url, OUTPUT);
  assert.equal(app.popups[0].opener, null);
  assert.equal(app.popups[0].closed, false);
});

test('a failed Convert and Open closes its blank window and logs one failure', async () => {
  const app = page({convert() {throw new Error('Could not download puzzle');}});
  await app.click('convertOpenButton');
  await flush();
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].event.status, 'error');
  assert.equal(app.popups[0].closed, true);
  assert.equal(app.controls.outputUrl.value, '');
});

test('repeated button clicks during one conversion do not create extra attempts or windows', async () => {
  const pending = deferred();
  const app = page({convert: () => pending.promise});
  const first = app.click('convertOpenButton');
  assert.equal(app.controls.convertButton.disabled, true);
  assert.equal(app.controls.noSolutionCheck.disabled, true);
  assert.equal(await app.click(), null);
  await app.click('convertOpenButton');
  assert.equal(app.conversions.length, 1);
  assert.equal(app.popups.length, 1);
  assert.equal(app.requests.length, 0);
  pending.resolve({url: OUTPUT, format: 'fpuz', includedSolution: false});
  await first;
  await flush();
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].event.inputFormat, 'fpuz');
  assert.equal(app.controls.convertButton.disabled, false);
});

test('separate completed conversions have distinct IDs even with identical input', async () => {
  const app = page();
  await app.click();
  await app.click();
  await flush();
  assert.equal(app.requests.length, 2);
  assert.notEqual(app.requests[0].event.eventId, app.requests[1].event.eventId);
});

test('temporary logging failures retry the same event without repeating conversion', async () => {
  const app = page({fetch(request, attempt) {
    if (attempt === 1) return {ok: false, status: 503};
    if (attempt === 2) throw new Error('network unavailable');
    return {ok: true, status: 201};
  }});
  assert.equal(await app.click(), OUTPUT);
  await flush();
  await app.nextTimer();
  await app.nextTimer();
  assert.equal(app.requests.length, 3);
  assert.equal(new Set(app.requests.map(request => request.init.body)).size, 1);
  assert.equal(app.conversions.length, 1);
  assert.equal(app.controls.outputUrl.value, OUTPUT);
  assert.match(app.controls.status.textContent, /Converted successfully/);
  assert.equal(app.warnings.length, 0);
  assert.equal(app.timers.size, 0);
});

test('rate limiting can retry, while an invalid event response does not keep retrying', async () => {
  const retry = page({fetch(request, attempt) {return attempt === 1 ? {ok: false, status: 429} : {ok: true, status: 201};}});
  await retry.click();
  await flush();
  await retry.nextTimer();
  assert.equal(retry.requests.length, 2);
  const invalid = page({fetch() {return {ok: false, status: 400};}});
  await invalid.click();
  await flush();
  assert.equal(invalid.requests.length, 1);
  assert.equal(invalid.timers.size, 0);
});

test('stalled logging cannot delay the result, keep controls busy or prevent opening Penpa', async () => {
  const never = deferred();
  const app = page({fetch: () => never.promise});
  const completion = app.click('convertOpenButton').then(() => 'completed');
  const winner = await Promise.race([completion, new Promise(resolve => setImmediate(() => resolve('blocked')))]);
  assert.equal(winner, 'completed');
  assert.equal(app.controls.outputUrl.value, OUTPUT);
  assert.equal(app.controls.convertButton.disabled, false);
  assert.equal(app.controls.inputUrl.readOnly, false);
  assert.equal(app.popups[0].url, OUTPUT);
  assert.equal(app.popups[0].closed, false);
  never.resolve({ok: true, status: 201});
  await flush();
});

test('an exhausted logging retry does not replace a successful conversion with an error', async () => {
  const app = page({fetch() {throw new Error('offline');}});
  await app.click('convertOpenButton');
  await flush();
  await app.nextTimer();
  await app.nextTimer();
  assert.equal(app.requests.length, 3);
  assert.equal(app.warnings.length, 1);
  assert.equal(app.controls.outputUrl.value, OUTPUT);
  assert.match(app.controls.status.textContent, /Converted successfully/);
  assert.equal(app.popups[0].closed, false);
  assert.equal(app.timers.size, 0);
});

test('large decorated output URLs avoid the browser keepalive body quota', async () => {
  const output = OUTPUT + 'A'.repeat(70000);
  const app = page({convert() {return {url: output, format: 'scl', includedSolution: false};}});
  assert.equal(await app.click(), output);
  await flush();
  assert.equal(app.requests[0].init.keepalive, false);
  assert.equal(app.requests[0].event.outputUrl, output);
});

test('keepalive sizing counts UTF-8 bytes rather than characters', async () => {
  const app = page({input: INPUT + '#' + 'é'.repeat(31000)});
  await app.click();
  await flush();
  assert.ok(app.requests[0].init.body.length < 60000);
  assert.ok(Buffer.byteLength(app.requests[0].init.body, 'utf8') > 60000);
  assert.equal(app.requests[0].init.keepalive, false);
});

test('page success and failure events satisfy the deployed worker storage contract', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../worker.js'), 'utf8');
  const worker = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).default;
  const rows = [];
  const env = {DB: {prepare() {return {bind(...values) {return {async run() {rows.push(values); return {success: true};}};}};}}};
  const pending = [];
  const fetch = request => {
    const result = worker.fetch(new Request(request.url, {...request.init,
      headers: {...request.init.headers, Origin: 'https://cyddrdrd.github.io'}}), env);
    pending.push(result);
    return result;
  };
  const success = page({fetch});
  const failure = page({fetch, convert() {throw new Error('Puzzle cannot be converted');}});
  const blank = page({fetch, input: ''});
  await success.click();
  await failure.click();
  await blank.click();
  const responses = await Promise.all(pending);
  assert.deepEqual(responses.map(response => response.status), [201, 201, 201]);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(row => row[6]), ['success', 'error', 'error']);
});
