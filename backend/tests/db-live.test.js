// Tests that talk to the REAL MySQL server, using the settings in backend/.env (the bms_app user, read-only).
//
// They are skipped automatically when DB_USER / DB_PASSWORD are not set, or when you set SKIP_DB_TESTS=1
// (PowerShell:  $env:SKIP_DB_TESTS = "1" ; npm test).
// If the settings ARE present but MySQL is not reachable, these tests FAIL on purpose, so a stopped MySQL is not hidden.
// They only run SELECT statements and never change any data.

process.env.NODE_ENV = 'test';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const { config } = require('../config/env');
const { getPool, closePool, checkConnection } = require('../config/db');

const skipReason = process.env.SKIP_DB_TESTS === '1'
  ? 'SKIP_DB_TESTS=1'
  : (!config.db.user || !config.db.password) && 'DB_USER / DB_PASSWORD are not set in backend/.env';

describe('live MySQL connection', { skip: skipReason }, () => {
  after(async () => { await closePool(); });

  it('connects as the configured user to the configured database', async () => {
    const facts = await checkConnection();
    assert.match(facts.version, /^8\./, 'MySQL 8.x expected');
    assert.equal(facts.database_name, config.db.database);
    assert.ok(facts.client_user.startsWith(`${config.db.user}@`), facts.client_user);
  });

  it('every pooled connection uses the UTC session time zone', async () => {
    const pool = getPool();
    // Open several connections at once so more than one pooled connection is exercised.
    const results = await Promise.all(Array.from({ length: 6 }, () => pool.query('SELECT @@session.time_zone AS tz, SLEEP(0.05) AS s')));
    for (const [[row]] of results) assert.equal(row.tz, '+00:00');
    const facts = await checkConnection();
    const gap = Math.abs(new Date(`${facts.session_now.replace(' ', 'T')}Z`) - new Date(`${facts.utc_now.replace(' ', 'T')}Z`));
    assert.ok(gap <= 1000, 'NOW() equals UTC_TIMESTAMP() in the session');
  });

  it('uses the utf8mb4 character set and the table collation', async () => {
    const facts = await checkConnection();
    assert.equal(facts.charset, 'utf8mb4');
    assert.equal(facts.collation, 'utf8mb4_unicode_ci');
  });

  it('returns prices and ids as numbers and dates as plain text', async () => {
    const [[row]] = await getPool().query(
      "SELECT CAST(260.00 AS DECIMAL(8,2)) AS price, CAST('2026-10-09' AS DATE) AS a_date, "
      + "CAST('2026-11-02 05:00:00' AS DATETIME) AS a_datetime, CAST(3204 AS UNSIGNED) AS an_id, COUNT(*) AS n FROM (SELECT 1) AS one",
    );
    assert.strictEqual(row.price, 260);
    assert.strictEqual(row.a_date, '2026-10-09');
    assert.strictEqual(row.a_datetime, '2026-11-02 05:00:00');
    assert.strictEqual(row.an_id, 3204);
    assert.strictEqual(row.n, 1);
  });

  it('parameters are sent separately from the SQL (text that looks like SQL stays plain text)', async () => {
    const evil = "O'Brien'; DROP TABLE movies; --";
    const [[viaExecute]] = await getPool().execute('SELECT ? AS value', [evil]);
    const [[viaQuery]] = await getPool().query('SELECT ? AS value', [evil]);
    assert.equal(viaExecute.value, evil);
    assert.equal(viaQuery.value, evil);
  });

  it('refuses a second statement in one query (multipleStatements is off)', async () => {
    await assert.rejects(getPool().query('SELECT 1; SELECT 2'), (error) => error.code === 'ER_PARSE_ERROR');
  });

  it('queues extra queries when all connections are busy instead of failing', async () => {
    const count = config.db.connectionLimit * 3;
    const results = await Promise.all(Array.from({ length: count }, (_, i) => getPool().query('SELECT SLEEP(0.01) AS s, ? AS i', [i])));
    assert.equal(results.length, count);
    assert.deepEqual(results.map(([[row]]) => row.i), Array.from({ length: count }, (_, i) => i));
  });

  it('the app user has no administrator privileges', async () => {
    const [rows] = await getPool().query('SHOW GRANTS FOR CURRENT_USER()');
    const grants = rows.map((r) => Object.values(r)[0]).join('\n');
    assert.doesNotMatch(grants, /ALL PRIVILEGES|GRANT OPTION|SUPER|FILE|\bON \*\.\* TO .*(?:SELECT|INSERT|UPDATE|DELETE)/i, grants);
    assert.match(grants, /GRANT USAGE ON \*\.\*/);
  });

  it('uses InnoDB and the active-seat unique key to prevent double booking', async () => {
    const pool = getPool();
    const [tables] = await pool.execute(
      `SELECT TABLE_NAME, ENGINE
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN ('bookings', 'booking_seats')
       ORDER BY TABLE_NAME`,
    );
    assert.deepEqual(tables.map((row) => [row.TABLE_NAME, row.ENGINE]), [
      ['booking_seats', 'InnoDB'],
      ['bookings', 'InnoDB'],
    ]);

    const [indexRows] = await pool.execute(
      `SELECT SEQ_IN_INDEX, COLUMN_NAME, NON_UNIQUE
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'booking_seats'
         AND INDEX_NAME = 'uq_booking_seats_show_seat_active'
       ORDER BY SEQ_IN_INDEX`,
    );
    assert.deepEqual(indexRows.map((row) => row.COLUMN_NAME), ['show_id', 'seat_id', 'active']);
    assert.ok(indexRows.every((row) => Number(row.NON_UNIQUE) === 0),
      'the (show_id, seat_id, active) index must be unique');
  });

  it('keeps released-seat history possible by allowing NULL in booking_seats.active', async () => {
    const [columns] = await getPool().execute(
      `SELECT IS_NULLABLE, COLUMN_DEFAULT
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'booking_seats'
         AND COLUMN_NAME = 'active'`,
    );
    assert.equal(columns.length, 1);
    assert.equal(columns[0].IS_NULLABLE, 'YES');
  });

  it('can close the pool and open a fresh one afterwards', async () => {
    await closePool();
    const facts = await checkConnection(); // getPool() creates a new pool
    assert.equal(facts.database_name, config.db.database);
  });
});
