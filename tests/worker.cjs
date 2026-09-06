'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const workerPromise = import('data:text/javascript;base64,' +
  Buffer.from(readFileSync(join(__dirname, '../worker.js'), 'utf8')).toString('base64'));
const origin = 'https://cyddrdrd.github.io';
const endpoint = 'https://sudokupad-to-penpa-log.cyddrdrd.workers.dev/log';

function event(overrides = {}) {
  return {
    eventId: 'b5fa493e-0e91-4b97-bb94-f3ca77dd673e',
    startedAt: '2026-09-06T15:23:45.123Z',
    inputUrl: 'https://sudokupad.app/k7qc98e00u?setting-nogrid.',
    outputUrl: 'https://swaroopg92.github.io/penpa-edit/#m=solve&p=example',
    noSolutionCheck: false,
    status: 'success',
    inputFormat: 'scl',
    error: null,
    version: '0.2.0',
    ...overrides
  };
}

function database() {
  const rows = new Map();
  let calls = 0;
  const DB = {
    prepare(sql) {
      assert.match(sql, /INSERT INTO conversion_events/);
      assert.equal((sql.match(/\?/g) || []).length, 10, 'Values must use SQL parameters');
      assert.match(sql, /ON CONFLICT\(event_id\) DO NOTHING/);
      return {bind(...values) {
        return {async run() {
          calls += 1;
          if (!rows.has(values[0])) rows.set(values[0], values);
          return {success: true};
        }};
      }};
    }
  };
  return {DB, rows, get calls() {return calls;}};
}

function request(value, options = {}) {
  return new Request(endpoint, {method: 'POST',
    headers: {'Content-Type': 'application/json', Origin: origin},
    body: JSON.stringify(value), ...options});
}

async function run(value, options = {}, env = {}) {
  const {default: worker} = await workerPromise;
  const db = database();
  const response = await worker.fetch(request(value, options), {DB: db.DB, ...env});
  return {response, db};
}

test('successful conversions persist URLs, options, format and both timestamps', async () => {
  const before = Date.now();
  const input = event();
  const {response, db} = await run(input);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {ok: true});
  const row = db.rows.get(input.eventId);
  assert.ok(Date.parse(row[1]) >= before && Date.parse(row[1]) <= Date.now());
  assert.deepEqual(row.slice(2), [input.startedAt, input.inputUrl, input.outputUrl,
    0, 'success', 'scl', null, '0.2.0']);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
});

test('failed and blank-input attempts are stored without a made-up output link', async () => {
  const input = event({inputUrl: '', outputUrl: null, noSolutionCheck: true,
    status: 'error', inputFormat: null, error: 'Please paste a SudokuPad link first.'});
  const {response, db} = await run(input);
  assert.equal(response.status, 201);
  assert.deepEqual(db.rows.get(input.eventId).slice(2), [input.startedAt, '', null,
    1, 'error', null, input.error, '0.2.0']);
});

test('empty optional fields are normalized to database nulls', async () => {
  const {response, db} = await run(event({inputFormat: '', error: ''}));
  assert.equal(response.status, 201);
  const row = [...db.rows.values()][0];
  assert.equal(row[7], null);
  assert.equal(row[8], null);
});

test('a retry with the same event ID does not overwrite or duplicate its record', async () => {
  const {default: worker} = await workerPromise;
  const db = database();
  assert.equal((await worker.fetch(request(event()), {DB: db.DB})).status, 201);
  assert.equal((await worker.fetch(request(event({inputUrl: 'changed'})), {DB: db.DB})).status, 201);
  assert.equal(db.rows.size, 1);
  assert.equal([...db.rows.values()][0][3], event().inputUrl);
});

test('SQL-looking input stays a bound value and unrequested personal fields are discarded', async () => {
  const input = event({inputUrl: "'; DROP TABLE conversion_events; --", ip: '192.0.2.1', cookie: 'private'});
  const {response, db} = await run(input, {headers: {
    'Content-Type': 'application/json', Origin: origin,
    'CF-Connecting-IP': '192.0.2.99', Cookie: 'session=secret', Authorization: 'private'
  }});
  assert.equal(response.status, 201);
  const row = [...db.rows.values()][0];
  assert.equal(row[3], input.inputUrl);
  assert.equal(row.length, 10);
  assert.ok(!JSON.stringify(row).includes('private'));
  assert.ok(!JSON.stringify(row).includes('192.0.2.'));
  assert.ok(!JSON.stringify(row).includes('secret'));
});

for (const caller of ['https://example.com', 'https://cyddrdrd.github.io.attacker.test', 'null', 'http://localhost:8766', null]) {
  test('rejects unapproved origin ' + caller, async () => {
    const headers = {'Content-Type': 'application/json'};
    if (caller !== null) headers.Origin = caller;
    const {response, db} = await run(event(), {headers});
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal(db.calls, 0);
  });
}

test('development accepts only the explicitly configured local origin', async () => {
  const options = {headers: {'Content-Type': 'application/json', Origin: 'http://localhost:8766'}};
  const env = {ALLOWED_ORIGINS: 'http://localhost:8766,http://127.0.0.1:8766'};
  const {response} = await run(event(), options, env);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8766');
  options.headers.Origin = 'http://localhost:8888';
  assert.equal((await run(event(), options, env)).response.status, 403);
});

test('CORS preflight permits JSON POST and rejects unrelated methods or headers', async () => {
  const {default: worker} = await workerPromise;
  const preflight = overrides => new Request(endpoint, {method: 'OPTIONS', headers: {
    Origin: origin, 'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type', ...overrides
  }});
  const response = await worker.fetch(preflight(), {});
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST');
  assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
  assert.equal(await response.text(), '');
  assert.equal((await worker.fetch(preflight({'Access-Control-Request-Method': 'GET'}), {})).status, 403);
  assert.equal((await worker.fetch(preflight({'Access-Control-Request-Headers': 'content-type,authorization'}), {})).status, 403);
});

test('there is no public route or HTTP method for reading stored events', async () => {
  const {default: worker} = await workerPromise;
  for (const path of ['/log', '/logs', '/', '/conversion_events']) {
    const response = await worker.fetch(new Request(new URL(path, endpoint), {headers: {Origin: origin}}), {});
    assert.equal(response.status, path === '/log' ? 405 : 404);
    assert.ok(!Object.hasOwn(await response.json(), 'events'));
  }
});

for (const [name, value] of [
  ['missing ID', event({eventId: undefined})],
  ['invalid timestamp', event({startedAt: 'yesterday'})],
  ['nonexistent calendar date', event({startedAt: '2026-02-30T15:23:45.123Z'})],
  ['wrong checkbox type', event({noSolutionCheck: 'false'})],
  ['missing input', event({inputUrl: null})],
  ['unknown status', event({status: 'started'})],
  ['success without output', event({outputUrl: null})],
  ['non-Penpa output', event({outputUrl: 'https://example.com/'})],
  ['error with output', event({status: 'error', error: 'failed'})],
  ['error without message', event({status: 'error', outputUrl: null})],
  ['success with error', event({error: 'failed'})],
  ['invalid version', event({version: 'latest'})],
  ['array', []],
  ['null', null],
  ['oversized URL', event({inputUrl: 'x'.repeat(900001)})]
]) {
  test('invalid payload is not stored: ' + name, async () => {
    const {response, db} = await run(value);
    assert.equal(response.status, 400);
    assert.equal(db.calls, 0);
  });
}

test('invalid JSON and content types are rejected before storage', async () => {
  assert.equal((await run(null, {body: '{broken'})).response.status, 400);
  const {response, db} = await run(event(), {headers: {'Content-Type': 'text/plain', Origin: origin}});
  assert.equal(response.status, 415);
  assert.equal(db.calls, 0);
});

test('body size is limited even when Content-Length is absent or untrustworthy', async () => {
  const huge = ' '.repeat(2 * 1024 * 1024 + 1);
  for (const headers of [
    {'Content-Type': 'application/json', Origin: origin},
    {'Content-Type': 'application/json', Origin: origin, 'Content-Length': '1'}
  ]) {
    const {response, db} = await run(null, {body: huge, headers});
    assert.equal(response.status, 413);
    assert.equal(db.calls, 0);
  }
});

test('storage errors return a retryable failure without exposing database internals', async () => {
  const {response} = await run(event(), {}, {DB: {prepare() {throw new Error('secret database details');}}});
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('secret'));
  assert.equal((await run(event(), {}, {DB: undefined})).response.status, 503);
  const failure = {prepare() {return {bind() {return {async run() {return {success: false};}};}};}};
  assert.equal((await run(event(), {}, {DB: failure})).response.status, 503);
});
