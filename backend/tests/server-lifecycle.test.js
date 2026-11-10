// Lifecycle tests use an isolated HTTP server and injected database functions; no real DB is touched.
process.env.NODE_ENV = 'test';

const net = require('node:net');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { createServerLifecycle, installSignalHandlers } = require('../server');

function freePort() {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });
}
const quietLogger = { log() {}, error() {} };

// Keep the HTTP listener on loopback even though application.listen(port) uses its default host.
describe('server startup and shutdown lifecycle', () => {
  it('does not accept requests until the database startup check succeeds', async () => {
    const port = await freePort();
    let releaseCheck;
    const checkGate = new Promise((resolve) => { releaseCheck = resolve; });
    const application = express();
    application.get('/probe', (_req, res) => res.json({ ok: true }));
    let checked = false;
    const lifecycle = createServerLifecycle({
      application, port,
      verifyDatabase: async () => { await checkGate; checked = true; },
      closeDatabasePool: async () => {}, logger: quietLogger,
    });

    const starting = lifecycle.start();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(checked, false);
    await assert.rejects(fetch(`http://127.0.0.1:${port}/probe`));
    releaseCheck();
    await starting;
    assert.equal((await (await fetch(`http://127.0.0.1:${port}/probe`)).json()).ok, true);
    await lifecycle.shutdown();
  });

  it('does not create an HTTP listener when the database startup check fails', async () => {
    const port = await freePort();
    let poolClosed = 0;
    const lifecycle = createServerLifecycle({
      application: express(), port,
      verifyDatabase: async () => { throw new Error('simulated unavailable database'); },
      closeDatabasePool: async () => { poolClosed += 1; }, logger: quietLogger,
    });
    await assert.rejects(lifecycle.start(), /simulated unavailable database/);
    assert.equal(lifecycle.server, null);
    await lifecycle.shutdown();
    assert.equal(poolClosed, 1);
    await assert.rejects(fetch(`http://127.0.0.1:${port}/`));
  });

  it('closes the HTTP server and pool, and repeated shutdown calls share one operation', async () => {
    const port = await freePort();
    let poolClosed = 0;
    const application = express();
    application.get('/probe', (_req, res) => res.send('ok'));
    const lifecycle = createServerLifecycle({
      application, port,
      verifyDatabase: async () => {},
      closeDatabasePool: async () => { poolClosed += 1; }, logger: quietLogger,
    });
    const server = await lifecycle.start();
    assert.equal(server.listening, true);
    const first = lifecycle.shutdown();
    const second = lifecycle.shutdown();
    assert.strictEqual(first, second);
    await Promise.all([first, second]);
    assert.equal(server.listening, false);
    assert.equal(poolClosed, 1);
    await lifecycle.shutdown();
    assert.equal(poolClosed, 1);
  });

  it('handles SIGINT and SIGTERM idempotently, including repeated signals during shutdown', async () => {
    const { EventEmitter } = require('node:events');
    const fakeProcess = new EventEmitter();
    let resolveShutdown;
    let calls = 0;
    const lifecycle = { shutdown: () => { calls += 1; return new Promise((resolve) => { resolveShutdown = resolve; }); } };
    installSignalHandlers(lifecycle, fakeProcess, quietLogger);
    fakeProcess.emit('SIGINT');
    fakeProcess.emit('SIGTERM');
    fakeProcess.emit('SIGINT');
    assert.equal(calls, 1);
    resolveShutdown();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fakeProcess.exitCode, 0);
  });

  it('sets a non-zero exit code when graceful shutdown fails', async () => {
    const { EventEmitter } = require('node:events');
    const fakeProcess = new EventEmitter();
    const lifecycle = { shutdown: async () => { throw new Error('internal pool failure'); } };
    installSignalHandlers(lifecycle, fakeProcess, quietLogger);
    fakeProcess.emit('SIGTERM');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fakeProcess.exitCode, 1);
  });

  it('exits safely with a non-zero status when MySQL is unavailable', async () => {
    const probePort = await freePort();
    const serverFile = path.join(__dirname, '..', 'server.js');
    const secret = 'never-print-this-test-password';
    const result = spawnSync(process.execPath, [serverFile], {
      cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 15000,
      env: {
        ...process.env, NODE_ENV: 'development', PORT: String(await freePort()),
        DB_HOST: '127.0.0.1', DB_PORT: String(probePort), DB_USER: 'bms_app',
        DB_PASSWORD: secret, DB_NAME: 'book_my_seat',
      },
    });
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output);
    assert.match(output, /could not start: Cannot connect to MySQL/);
    assert.ok(!output.includes(secret));
    assert.doesNotMatch(output, /password|SELECT VERSION|at Promise|node_modules/);
  });
});
