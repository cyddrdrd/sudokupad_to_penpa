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

const adminToken = 'test-only-admin-token';
const logColumns = ['event_id', 'received_at', 'started_at', 'input_url', 'output_url',
  'no_solution_check', 'status', 'input_format', 'error', 'version'];

function logRow(overrides = {}) {
  return {event_id: 'test-event-00000001', received_at: '2026-09-06T15:24:00.000Z',
    started_at: '2026-09-06T15:23:45.123Z', input_url: event().inputUrl,
    output_url: event().outputUrl, no_solution_check: 0, status: 'success',
    input_format: 'scl', error: null, version: '0.2.0', ...overrides};
}

function adminDatabase(rows = [logRow()]) {
  const limits = [];
  return {limits, DB: {prepare(sql) {
    const selected = /SELECT\s+([\s\S]+?)\s+FROM conversion_events/.exec(sql);
    assert.ok(selected, 'Read from the usage table with explicit columns');
    assert.deepEqual(selected[1].split(',').map(column => column.trim()), logColumns);
    assert.match(sql, /ORDER BY received_at DESC, rowid DESC/);
    assert.match(sql, /LIMIT \?/);
    assert.equal((sql.match(/\?/g) || []).length, 1);
    return {bind(...values) {
      assert.equal(values.length, 1);
      assert.ok(Number.isInteger(values[0]) && values[0] >= 1 && values[0] <= 500);
      limits.push(values[0]);
      return {async all() {return {success: true, results: rows.slice(0, values[0])};}};
    }};
  }}};
}

function adminRequest(path = '/admin/logs', parameters = {}, options = {}) {
  const url = new URL(path, endpoint);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return new Request(url, options);
}

function checkAdminHeaders(response) {
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal([...response.headers.keys()].some(key => key.startsWith('access-control-')), false);
}

test('the private JSON viewer works as a top-level navigation and returns the stored fields', async () => {
  const {default: worker} = await workerPromise;
  const rows = [logRow(), logRow({event_id: 'test-event-00000002', received_at: '2026-09-06T15:20:00.000Z',
    input_url: '', output_url: null, no_solution_check: 1, status: 'error', input_format: null,
    error: 'Please paste a SudokuPad link first.'})];
  const db = adminDatabase(rows);
  const response = await worker.fetch(adminRequest('/admin/logs', {token: adminToken}),
    {ADMIN_TOKEN: adminToken, DB: db.DB});
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type'), /^application\/json/);
  assert.deepEqual(await response.json(), {success: true, count: 2, logs: rows});
  assert.deepEqual(db.limits, [100]);
  checkAdminHeaders(response);
});

for (const path of ['/admin/logs', '/admin/logs.csv']) {
  test(path + ' rejects absent, wrong, or unconfigured tokens without touching storage', async () => {
    const {default: worker} = await workerPromise;
    const DB = {prepare() {assert.fail('Unauthorized requests must not query the database');}};
    for (const [configured, supplied] of [
      [adminToken, undefined], [adminToken, ''], [adminToken, 'incorrect'],
      [undefined, adminToken], ['', ''], ['   ', '   '], [null, 'null']
    ]) {
      const response = await worker.fetch(adminRequest(path, supplied === undefined ? {} : {token: supplied}),
        {ADMIN_TOKEN: configured, DB});
      assert.equal(response.status, 401);
      assert.equal(await response.text(), path.endsWith('.csv') ? 'Unauthorized' :
        JSON.stringify({success: false, error: 'Unauthorized'}));
      checkAdminHeaders(response);
    }
  });

  test(path + ' supports Bearer authentication without granting CORS access', async () => {
    const {default: worker} = await workerPromise;
    const db = adminDatabase();
    const response = await worker.fetch(adminRequest(path, {}, {headers: {
      Authorization: 'Bearer ' + adminToken, Origin: origin
    }}), {ADMIN_TOKEN: adminToken, DB: db.DB});
    assert.equal(response.status, 200);
    checkAdminHeaders(response);
    for (const authorization of ['Bearer incorrect', 'Basic ' + adminToken, 'Bearer', 'Bearer ' + adminToken + ' extra']) {
      const rejected = await worker.fetch(adminRequest(path, {}, {headers: {Authorization: authorization}}),
        {ADMIN_TOKEN: adminToken, DB: db.DB});
      assert.equal(rejected.status, 401);
      checkAdminHeaders(rejected);
    }
    assert.deepEqual(db.limits, [100]);
  });

  test(path + ' never reads or grants preflight access through another HTTP method', async () => {
    const {default: worker} = await workerPromise;
    const DB = {prepare() {assert.fail('Only authenticated GET may query the database');}};
    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD']) {
      const response = await worker.fetch(adminRequest(path, {token: adminToken}, {method,
        headers: {Origin: origin, 'Access-Control-Request-Method': 'GET'}}), {ADMIN_TOKEN: adminToken, DB});
      assert.equal(response.status, 405);
      assert.equal(response.headers.get('Allow'), 'GET');
      checkAdminHeaders(response);
    }
  });
}

test('admin limits are bounded integers passed as SQL parameters', async () => {
  const {default: worker} = await workerPromise;
  for (const [value, expected] of [['1', 1], ['500', 500], ['999999', 500], ['0', 1], ['-5', 1],
    ['3.8', 3], ['', 100], ['Infinity', 100], ['NaN', 100], ['100; DROP TABLE conversion_events', 100]]) {
    const db = adminDatabase();
    const response = await worker.fetch(adminRequest('/admin/logs', {token: adminToken, limit: value}),
      {ADMIN_TOKEN: adminToken, DB: db.DB});
    assert.equal(response.status, 200);
    assert.deepEqual(db.limits, [expected]);
  }
});

test('CSV exports preserve commas, quotes, line breaks, nulls and download metadata', async () => {
  const {default: worker} = await workerPromise;
  const row = logRow({input_url: 'https://sudokupad.app/puzzle?text="hello, world"',
    output_url: null, status: 'error', error: 'Line 1\nLine 2, "quoted"'});
  const response = await worker.fetch(adminRequest('/admin/logs.csv', {token: adminToken}),
    {ADMIN_TOKEN: adminToken, DB: adminDatabase([row]).DB});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'text/csv; charset=utf-8');
  assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename=sudokupad_to_penpa_logs.csv');
  const text = await response.text();
  assert.ok(text.startsWith(logColumns.join(',') + '\r\n'));
  assert.ok(text.includes('"https://sudokupad.app/puzzle?text=""hello, world"""'));
  assert.ok(text.includes(',"","0","error",'));
  assert.ok(text.includes('"Line 1\nLine 2, ""quoted"""'));
  checkAdminHeaders(response);
});

test('CSV neutralizes spreadsheet formula prefixes while JSON preserves exact stored values', async () => {
  const {default: worker} = await workerPromise;
  const values = ['=HYPERLINK("https://example.com")', '+1+1', '-2+3', '@SUM(1)',
    '\t=1+1', '\r=1+1', '\n=1+1', '  =1+1', '\uFEFF=1+1'];
  for (const value of values) {
    const row = logRow({input_url: value});
    const DB = adminDatabase([row]).DB;
    const response = await worker.fetch(adminRequest('/admin/logs.csv', {token: adminToken}), {ADMIN_TOKEN: adminToken, DB});
    assert.ok((await response.text()).includes('"\'' + value.replaceAll('"', '""') + '"'));
    const json = await worker.fetch(adminRequest('/admin/logs', {token: adminToken}), {ADMIN_TOKEN: adminToken, DB});
    assert.equal((await json.json()).logs[0].input_url, value);
  }
});

test('empty private logs retain a valid JSON result and CSV header', async () => {
  const {default: worker} = await workerPromise;
  const env = {ADMIN_TOKEN: adminToken, DB: adminDatabase([]).DB};
  const json = await worker.fetch(adminRequest('/admin/logs', {token: adminToken}), env);
  assert.deepEqual(await json.json(), {success: true, count: 0, logs: []});
  const csv = await worker.fetch(adminRequest('/admin/logs.csv', {token: adminToken}), env);
  assert.equal(await csv.text(), logColumns.join(','));
});

test('private reader storage failures never expose details or authentication tokens', async () => {
  const {default: worker} = await workerPromise;
  const failingDBs = [undefined, {prepare() {throw new Error('database secret ' + adminToken);}},
    {prepare() {return {bind() {return {async all() {return {success: false, results: []};}};}};}}];
  for (const path of ['/admin/logs', '/admin/logs.csv']) {
    for (const DB of failingDBs) {
      const response = await worker.fetch(adminRequest(path, {token: adminToken}), {ADMIN_TOKEN: adminToken, DB});
      assert.equal(response.status, 503);
      const text = await response.text();
      assert.ok(!text.includes(adminToken));
      assert.ok(!text.includes('database secret'));
      assert.ok(!text.includes('logs'));
      checkAdminHeaders(response);
    }
  }
});
