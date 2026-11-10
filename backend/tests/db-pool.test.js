// Unit tests for config/db.js and scripts/check-db.js. NO database is needed: every test either works on plain
// objects or deliberately connects to a port where nothing is listening.

process.env.NODE_ENV = 'test';

const net = require('node:net');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildPoolOptions, assertDbConfig, describeDbError, createDbPool, checkConnection, closePool,
  DbConfigError, DatabaseError,
} = require('../config/db');

const SECRET = 'secret-pw-xyz-123';
const goodDb = { host: '127.0.0.1', port: 3306, user: 'bms_app', password: SECRET, database: 'book_my_seat', connectionLimit: 7 };

// A local port where nothing is listening (so connecting is refused straight away).
function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

describe('pool options (config/db.js)', () => {
  it('uses exactly the agreed options', () => {
    const o = buildPoolOptions(goodDb);
    assert.equal(o.host, '127.0.0.1');
    assert.equal(o.port, 3306);
    assert.equal(o.user, 'bms_app');
    assert.equal(o.password, SECRET);
    assert.equal(o.database, 'book_my_seat');
    assert.equal(o.connectionLimit, 7);
    assert.equal(o.waitForConnections, true);
    assert.equal(o.queueLimit, 0);
    assert.equal(o.connectTimeout, 10000);
    assert.equal(o.timezone, 'Z');
    assert.equal(o.dateStrings, true);
    assert.equal(o.decimalNumbers, true);
    assert.equal(o.multipleStatements, false);
    assert.equal(o.charset, 'UTF8MB4_UNICODE_CI');
  });

  it('creating a pool does not connect, and closePool() is safe when nothing was created', async () => {
    const pool = createDbPool({ ...goodDb, port: await freePort() }); // would throw if it tried to connect now
    await pool.end();
    await closePool();
    await closePool();
  });
});

describe('settings checks (assertDbConfig)', () => {
  it('accepts the dedicated user with a password', () => {
    assert.doesNotThrow(() => assertDbConfig(goodDb));
  });

  it('reports which settings are missing, without printing any secret', () => {
    for (const [db, names] of [
      [{ ...goodDb, user: undefined }, ['DB_USER']],
      [{ ...goodDb, password: '' }, ['DB_PASSWORD']],
      [{ ...goodDb, user: '', password: undefined }, ['DB_USER', 'DB_PASSWORD']],
    ]) {
      assert.throws(() => assertDbConfig(db), (error) => {
        assert.ok(error instanceof DbConfigError);
        assert.equal(error.code, 'DB_CONFIG');
        assert.equal(error.unavailable, false);
        for (const name of names) assert.ok(error.message.includes(name), `mentions ${name}`);
        assert.ok(error.hint.includes('backend/.env'));
        assert.ok(!error.message.includes(SECRET) && !error.hint.includes(SECRET));
        return true;
      });
    }
  });

  it('refuses to use root in any spelling', () => {
    for (const user of ['root', 'ROOT', 'Root']) {
      assert.throws(() => assertDbConfig({ ...goodDb, user }), /must not be "root"/);
    }
  });
});

describe('plain-language error messages (describeDbError)', () => {
  const make = (code, extra = {}) => Object.assign(new Error(`driver text containing ${SECRET}`), { code, ...extra });
  const cases = [
    ['ECONNREFUSED', true, /Cannot connect to MySQL at 127\.0\.0\.1:3306/],
    ['ETIMEDOUT', true, /timed out/],
    ['EHOSTUNREACH', true, /timed out/],
    ['ENOTFOUND', true, /host name "127\.0\.0\.1" could not be found/],
    ['ECONNRESET', true, /connection to MySQL was lost/],
    ['PROTOCOL_CONNECTION_LOST', true, /connection to MySQL was lost/],
    ['ER_CON_COUNT_ERROR', true, /too many open connections/],
    ['ER_ACCESS_DENIED_ERROR', false, /rejected the user name or password for user "bms_app"/],
    ['ER_DBACCESS_DENIED_ERROR', false, /database "book_my_seat" does not exist, or user "bms_app"/],
    ['ER_BAD_DB_ERROR', false, /database "book_my_seat" does not exist/],
    ['ER_TABLEACCESS_DENIED_ERROR', false, /not allowed to read a table/],
    ['ER_NO_SUCH_TABLE', false, /table the application needs does not exist/],
    ['SOMETHING_NEW', false, /Unexpected database error \(code SOMETHING_NEW\)/],
  ];
  for (const [code, unavailable, pattern] of cases) {
    it(`${code}: clear message, ${unavailable ? 'marked unavailable' : 'not marked unavailable'}, no secret`, () => {
      const info = describeDbError(make(code), goodDb);
      assert.equal(info.code, code);
      assert.equal(info.unavailable, unavailable);
      assert.match(info.message, pattern);
      assert.ok(info.hint.length > 10);
      assert.ok(!`${info.message} ${info.hint}`.includes(SECRET), 'the driver text (and any secret in it) is never copied');
    });
  }
  it('copes with a value that is not an Error', () => {
    assert.equal(describeDbError(undefined, goodDb).code, 'UNKNOWN');
  });
});

describe('checkConnection() when MySQL cannot be reached (no database needed)', () => {
  it('throws a DatabaseError that says so, is marked unavailable, and leaks no password', async () => {
    const db = { ...goodDb, port: await freePort() };
    const pool = createDbPool(db);
    try {
      await assert.rejects(checkConnection(pool, db), (error) => {
        assert.ok(error instanceof DatabaseError);
        assert.equal(error.unavailable, true);
        assert.match(error.message, new RegExp(`Cannot connect to MySQL at 127\\.0\\.0\\.1:${db.port}`));
        assert.ok(!`${error.message} ${error.hint}`.includes(SECRET));
        assert.ok(error.cause, 'the original error is kept for debugging');
        return true;
      });
    } finally {
      await pool.end();
    }
  });
});

describe('scripts/check-db.js (run as a separate process; no database needed)', () => {
  const script = path.join(__dirname, '..', 'scripts', 'check-db.js');
  function run(env, args = []) {
    return spawnSync(process.execPath, [script, ...args], {
      env: { ...process.env, ...env }, encoding: 'utf8', timeout: 30000,
    });
  }

  it('explains incomplete settings and exits with code 1', () => {
    const result = run({ DB_USER: '', DB_PASSWORD: '' });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /Database settings are incomplete: DB_USER and DB_PASSWORD are not set/);
    assert.match(result.stdout, /RESULT: COULD NOT CHECK THE DATABASE/);
  });

  it('refuses root with exit code 1', () => {
    const result = run({ DB_USER: 'root', DB_PASSWORD: SECRET });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /must not be "root"/);
    assert.ok(!(result.stdout + result.stderr).includes(SECRET));
  });

  it('reports an unreachable MySQL clearly, exits with code 1, and never prints the password (also with --verbose)', async () => {
    const port = String(await freePort());
    for (const args of [[], ['--verbose']]) {
      const result = run({ DB_HOST: '127.0.0.1', DB_PORT: port, DB_USER: 'bms_app', DB_PASSWORD: SECRET, DB_NAME: 'book_my_seat' }, args);
      const output = result.stdout + result.stderr;
      assert.equal(result.status, 1, output);
      assert.match(result.stdout, new RegExp(`Cannot connect to MySQL at 127\\.0\\.0\\.1:${port}`));
      assert.match(result.stdout, /RESULT: COULD NOT CHECK THE DATABASE/);
      assert.ok(!output.includes(SECRET), 'the password must never appear in the output');
      if (args.length > 0) assert.match(result.stdout, /code=ECONNREFUSED/);
    }
  });
});
