// Tests for the MySQL settings in config/env.js and for the safety of the example files.
// No database is needed: loadConfig() is given plain objects.

process.env.NODE_ENV = 'test';

const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../config/env');

const backendDir = path.join(__dirname, '..');

describe('database settings in config/env.js', () => {
  it('uses safe defaults when nothing is set (and does not require a user or password yet)', () => {
    const { db } = loadConfig({});
    assert.equal(db.host, '127.0.0.1');
    assert.equal(db.port, 3306);
    assert.equal(db.database, 'book_my_seat');
    assert.equal(db.connectionLimit, 10);
    assert.equal(db.user, undefined);
    assert.equal(db.password, undefined);
  });

  it('reads every DB_* variable', () => {
    const { db } = loadConfig({
      DB_HOST: 'db.example', DB_PORT: '3307', DB_USER: 'bms_app', DB_PASSWORD: 'p#ss word', DB_NAME: 'other', DB_CONNECTION_LIMIT: '5',
    });
    assert.deepEqual({ ...db }, { host: 'db.example', port: 3307, user: 'bms_app', database: 'other', connectionLimit: 5 });
    assert.equal(db.password, 'p#ss word');
  });

  it('treats empty values as "not set" (defaults apply)', () => {
    const { db } = loadConfig({ DB_HOST: '', DB_PORT: '', DB_NAME: '', DB_CONNECTION_LIMIT: '' });
    assert.equal(db.host, '127.0.0.1');
    assert.equal(db.port, 3306);
    assert.equal(db.database, 'book_my_seat');
    assert.equal(db.connectionLimit, 10);
  });

  it('never lets the password leak through console.log, JSON or spreading', () => {
    const config = loadConfig({ DB_USER: 'bms_app', DB_PASSWORD: 'super-secret-123' });
    assert.ok(!JSON.stringify(config).includes('super-secret-123'));
    assert.ok(!Object.keys(config.db).includes('password'));
    assert.ok(!require('node:util').inspect(config).includes('super-secret-123'));
    assert.equal(config.db.password, 'super-secret-123'); // but it can still be read on purpose
  });

  it('rejects an invalid DB_PORT with a clear message', () => {
    for (const bad of ['abc', '0', '-1', '65536', '3.5', '33 06']) {
      assert.throws(() => loadConfig({ DB_PORT: bad }), /DB_PORT must be a whole number between 1 and 65535/, bad);
    }
  });

  it('rejects an invalid DB_CONNECTION_LIMIT with a clear message', () => {
    for (const bad of ['0', '101', 'abc', '2.5', '-3']) {
      assert.throws(() => loadConfig({ DB_CONNECTION_LIMIT: bad }), /DB_CONNECTION_LIMIT must be a whole number between 1 and 100/, bad);
    }
  });

  it('does not put the password into an error message', () => {
    assert.throws(
      () => loadConfig({ DB_PORT: 'bad', DB_PASSWORD: 'super-secret-123' }),
      (error) => !error.message.includes('super-secret-123'),
    );
  });
});

describe('example and ignore files protect the credentials', () => {
  const example = fs.readFileSync(path.join(backendDir, '.env.example'), 'utf8');

  it('.env.example lists every database variable and ships NO password', () => {
    for (const name of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_CONNECTION_LIMIT']) {
      assert.match(example, new RegExp(`^${name}=`, 'm'), `${name} is missing from .env.example`);
    }
    assert.match(example, /^DB_PASSWORD=\s*$/m, 'DB_PASSWORD must be empty in the example file');
    assert.match(example, /^DB_USER=bms_app\s*$/m, 'the example must point to the dedicated user, not root');
    assert.doesNotMatch(example, /^DB_USER=root/m);
  });

  it('.gitignore keeps .env out of Git but allows .env.example', () => {
    const ignore = fs.readFileSync(path.join(backendDir, '.gitignore'), 'utf8').split(/\r?\n/).map((l) => l.trim());
    assert.ok(ignore.includes('.env'));
    assert.ok(ignore.includes('!.env.example'));
    assert.ok(ignore.includes('node_modules/'));
  });

  it('no source file contains a hard-coded database password', () => {
    const offenders = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'tests') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.js') && /password\s*[:=]\s*['"`][^'"`]+['"`]/i.test(fs.readFileSync(full, 'utf8'))) offenders.push(path.relative(backendDir, full));
      }
    };
    walk(backendDir);
    assert.deepEqual(offenders, []);
  });
});
