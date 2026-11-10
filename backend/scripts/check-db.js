// Independent database check. It does not start the web server and does not change any data (it only reads).
// Run from the backend folder:   npm run db:check          (add  -- --verbose  for technical details on errors)
//
// Exit code: 0 = connected and no check failed (warnings are allowed), 1 = could not connect / bad settings,
//            2 = connected, but a check failed.

const { config } = require('../config/env');
const { getPool, closePool, checkConnection, toDatabaseError, DbConfigError } = require('../config/db');

const VERBOSE = process.argv.includes('--verbose');

// Row counts expected right after database/seed.sql has been run.
const EXPECTED_COUNTS = [
  ['movies', 9], ['genres', 10], ['movie_genres', 18], ['cinemas', 3],
  ['screens', 19], ['seats', 1520], ['shows', 270], ['show_prices', 810],
];
// Tables that stay empty until the authentication and booking phases (information only).
const LATER_PHASE_TABLES = ['users', 'bookings', 'booking_seats'];

let warnings = 0;
let failures = 0;
const say = (text = '') => console.log(text);
function report(label, value, status = 'OK') {
  if (status === 'WARN') warnings += 1;
  if (status === 'FAIL') failures += 1;
  const tag = status === 'INFO' ? '      ' : `[${status}]`.padEnd(6);
  say(`${tag} ${label.padEnd(30, '.')} ${value}`);
}
const toDate = (mysqlDateTime) => new Date(`${mysqlDateTime.replace(' ', 'T')}Z`);
const asIst = (date) => `${new Date(date.getTime() + 330 * 60000).toISOString().replace('T', ' ').slice(0, 16)} IST`;
const asUtc = (date) => `${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`;

async function main() {
  const db = config.db;
  say('BOOK_MY_SEAT database check');
  say('===========================');
  say(`Connecting to ${db.host}:${db.port} as "${db.user || '(DB_USER not set)'}", database "${db.database}" ...`);
  say();

  const pool = getPool();
  const facts = await checkConnection(pool);

  say('1. Connection');
  report('MySQL server version', facts.version, /^8\./.test(facts.version) ? 'OK' : 'WARN');
  report('Database', facts.database_name, facts.database_name === db.database ? 'OK' : 'FAIL');
  report('Connected as', `${facts.client_user} (matched account ${facts.account})`, 'INFO');
  report('Session time zone', facts.session_time_zone, facts.session_time_zone === '+00:00' ? 'OK' : 'FAIL');
  const clockGap = Math.abs(toDate(facts.session_now) - toDate(facts.utc_now));
  report('Session clock = UTC clock', `${facts.session_now} (difference ${clockGap / 1000}s)`, clockGap <= 1000 ? 'OK' : 'FAIL');
  report('Server time zone (global)', `${facts.global_time_zone} (informational: this app forces UTC on its own connections)`, 'INFO');
  const charsetOk = facts.charset === 'utf8mb4' && facts.collation === 'utf8mb4_unicode_ci';
  report('Character set / collation', `${facts.charset} / ${facts.collation}`, charsetOk ? 'OK' : 'WARN');
  report('Pool size limit', String(db.connectionLimit), 'INFO');
  say();

  say('2. Driver data-type settings (prices must be numbers, dates must be text)');
  const [[types]] = await pool.query(
    "SELECT CAST(260.00 AS DECIMAL(8,2)) AS a_price, CAST('2026-10-09' AS DATE) AS a_date, "
    + "CAST('2026-11-02 05:00:00' AS DATETIME) AS a_datetime, CAST(3204 AS UNSIGNED) AS an_id",
  );
  report('DECIMAL price -> number', `${typeof types.a_price} ${JSON.stringify(types.a_price)}`, typeof types.a_price === 'number' ? 'OK' : 'FAIL');
  report('DATE -> text', `${typeof types.a_date} ${JSON.stringify(types.a_date)}`, types.a_date === '2026-10-09' ? 'OK' : 'FAIL');
  report('DATETIME -> text (UTC)', `${typeof types.a_datetime} ${JSON.stringify(types.a_datetime)}`, types.a_datetime === '2026-11-02 05:00:00' ? 'OK' : 'FAIL');
  report('BIGINT id -> number', `${typeof types.an_id} ${types.an_id}`, typeof types.an_id === 'number' ? 'OK' : 'FAIL');
  say();

  say('3. Tables (expected counts are for a database just seeded with database/seed.sql)');
  const [tableRows] = await pool.query("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'");
  const existing = new Set(tableRows.map((r) => String(r.name).toLowerCase()));
  const allTables = [...EXPECTED_COUNTS.map(([name]) => name), ...LATER_PHASE_TABLES];
  const missing = allTables.filter((name) => !existing.has(name));
  if (missing.length > 0) {
    report('Missing tables', missing.join(', '), 'FAIL');
    say('       Run database/schema.sql, then database/seed.sql, in MySQL Workbench.');
  }
  for (const [table, expected] of EXPECTED_COUNTS) {
    if (!existing.has(table)) continue;
    const [[row]] = await pool.query(`SELECT COUNT(*) AS n FROM \`${table}\``); // table names come from the fixed list above
    report(table, row.n === expected ? String(row.n) : `${row.n} (expected ${expected})`, row.n === expected ? 'OK' : 'WARN');
  }
  for (const table of LATER_PHASE_TABLES) {
    if (!existing.has(table)) continue;
    const [[row]] = await pool.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
    report(table, `${row.n} (information only: used from Phase 5 and 6)`, 'INFO');
  }
  say();

  say('4. Upcoming shows (status SCHEDULED and start time in the future)');
  if (existing.has('shows') && existing.has('movies')) {
    const [[shows]] = await pool.query(
      "SELECT COUNT(*) AS n, MIN(start_time) AS first_start, MAX(start_time) AS last_start FROM shows WHERE status = 'SCHEDULED' AND start_time > UTC_TIMESTAMP()",
    );
    const [[noShows]] = await pool.query(
      "SELECT COUNT(*) AS n FROM movies m WHERE m.is_active = 1 AND NOT EXISTS "
      + "(SELECT 1 FROM shows s WHERE s.movie_id = m.id AND s.status = 'SCHEDULED' AND s.start_time > UTC_TIMESTAMP())",
    );
    report('Upcoming shows', String(shows.n), shows.n > 0 ? 'OK' : 'WARN');
    if (shows.n > 0) {
      report('Next show starts', `${asUtc(toDate(shows.first_start))}  =  ${asIst(toDate(shows.first_start))}`, 'INFO');
      report('Last show starts', `${asUtc(toDate(shows.last_start))}  =  ${asIst(toDate(shows.last_start))}`, 'INFO');
    }
    report('Movies without upcoming shows', String(noShows.n), noShows.n === 0 ? 'OK' : 'WARN');
    if (shows.n === 0 || noShows.n > 0) say('       The demo shows only cover 5 days from the day seed.sql was run. Run database/seed.sql again to refresh them.');
  } else {
    report('Upcoming shows', 'skipped (tables missing)', 'WARN');
  }
  say();

  if (failures > 0) say(`RESULT: FAILED (${failures} problem${failures > 1 ? 's' : ''}, ${warnings} warning${warnings === 1 ? '' : 's'}).`);
  else if (warnings > 0) say(`RESULT: CONNECTED, with ${warnings} warning${warnings > 1 ? 's' : ''} (see [WARN] lines above).`);
  else say('RESULT: ALL CHECKS PASSED.');
  if (failures > 0) process.exitCode = 2;
}

function printFatal(error) {
  const problem = error instanceof DbConfigError ? error : toDatabaseError(error, config.db);
  say(`[FAIL] ${problem.message}`);
  if (problem.hint) say(`       ${problem.hint}`);
  if (VERBOSE) {
    const original = problem.cause || problem;
    say(`       Technical details: code=${original.code} errno=${original.errno === undefined ? 'n/a' : original.errno}`);
    if (original.message) say(`       Driver message: ${original.message}`);
  } else {
    say('       (Run "npm run db:check -- --verbose" for technical details.)');
  }
  say();
  say('RESULT: COULD NOT CHECK THE DATABASE.');
  process.exitCode = 1;
}

main()
  .catch(printFatal)
  .finally(() => closePool().catch(() => {}));
