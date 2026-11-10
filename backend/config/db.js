// MySQL connection pool for the whole backend.
//
// WHAT IS A POOL? Opening a new connection to MySQL for every request would be slow. A pool keeps a few
// connections open and lends one to each query. "connectionLimit" is the maximum number of connections; if all are
// busy, further queries wait in a queue (waitForConnections) instead of failing.
//
// This file only creates and checks the pool. Nothing else in the backend uses it yet (Phase 4, Stage 3).
// All settings come from config/env.js (which reads backend/.env). No password is ever written in the source code.

const mysql = require('mysql2/promise');
const { config } = require('./env');

// ---------------------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------------------

/** Settings are missing or unsafe (for example no DB_PASSWORD, or the user is root). Nothing was sent to MySQL. */
class DbConfigError extends Error {
  constructor(message, hint) {
    super(message);
    this.name = 'DbConfigError';
    this.code = 'DB_CONFIG';
    this.hint = hint;
    this.unavailable = false;
  }
}

/**
 * A database problem translated into plain language. "message" and "hint" are written by us from the error CODE,
 * so they can never contain the password or other secrets. "unavailable" is true when the database could not be
 * reached at all (a later stage maps those to HTTP 503). The original driver error is kept in "cause".
 */
class DatabaseError extends Error {
  constructor(info, cause) {
    super(info.message);
    this.name = 'DatabaseError';
    this.code = info.code;
    this.hint = info.hint;
    this.unavailable = info.unavailable;
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------------------------------
// Configuration checks and pool options
// ---------------------------------------------------------------------------------------------------

/** Refuse to connect without a user and password, and never as root. Throws DbConfigError. */
function assertDbConfig(db = config.db) {
  const missing = [];
  if (!db.user) missing.push('DB_USER');
  if (!db.password) missing.push('DB_PASSWORD');
  if (missing.length > 0) {
    throw new DbConfigError(
      `Database settings are incomplete: ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set.`,
      `Add ${missing.length > 1 ? 'them' : 'it'} to backend/.env (copy .env.example if you have no .env yet). Use the password of the "bms_app" MySQL user. `
        + 'If the password contains a # character, wrap it in double quotes.',
    );
  }
  if (String(db.user).toLowerCase() === 'root') {
    throw new DbConfigError(
      'DB_USER must not be "root". The backend only connects with the dedicated least-privilege user.',
      'Run database/create_app_user.sql in MySQL Workbench, then set DB_USER=bms_app and its password in backend/.env.',
    );
  }
}

/** The mysql2 options for a pool. Pure function (no connection is made), so it is easy to test. */
function buildPoolOptions(db = config.db) {
  return {
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.database,
    charset: 'UTF8MB4_UNICODE_CI', // same character set and collation as the tables
    waitForConnections: true, // when all connections are busy, queue the request instead of failing
    connectionLimit: db.connectionLimit,
    queueLimit: 0, // 0 = the queue may grow without a limit
    connectTimeout: 10000, // give up connecting after 10 seconds
    enableKeepAlive: true,
    multipleStatements: false, // one statement per query: a basic protection against SQL injection
    timezone: 'Z', // JavaScript Dates are read and written as UTC
    dateStrings: true, // DATE and DATETIME columns arrive as plain strings, never as Date objects (no time-zone surprises)
    decimalNumbers: true, // DECIMAL columns (prices) arrive as numbers, not as text such as "260.00"
  };
}

/** Creates a NEW pool (not cached). Use getPool() in normal code. */
function createDbPool(db = config.db) {
  assertDbConfig(db);
  const pool = mysql.createPool(buildPoolOptions(db));
  // Every new connection switches its session time zone to UTC, so MySQL and Node agree on times
  // (the shows are stored in UTC). The command is queued before the first query that uses the connection.
  pool.pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+00:00'", (error) => {
      if (error) connection.destroy(); // never use a connection that failed to switch to UTC
    });
  });
  return pool;
}

// ---------------------------------------------------------------------------------------------------
// Error translation
// ---------------------------------------------------------------------------------------------------

const UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EAI_AGAIN',
  'ECONNRESET', 'EPIPE', 'PROTOCOL_CONNECTION_LOST', 'ER_CON_COUNT_ERROR',
]);

/** Turns a driver error into { code, message, hint, unavailable } in plain language. Never includes secrets. */
function describeDbError(error, db = config.db) {
  const code = (error && error.code) || 'UNKNOWN';
  const where = `${db.host}:${db.port}`;
  const unavailable = UNAVAILABLE_CODES.has(code);
  const make = (message, hint) => ({ code, message, hint, unavailable });

  switch (code) {
    case 'ECONNREFUSED':
      return make(`Cannot connect to MySQL at ${where}: the connection was refused.`,
        'Check that the MySQL service is running (in Windows open "Services" and start it; it is usually named MySQL80) '
        + 'and that DB_HOST and DB_PORT in backend/.env are correct.');
    case 'ETIMEDOUT':
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return make(`Cannot reach MySQL at ${where}: the connection timed out.`,
        'Check DB_HOST and DB_PORT in backend/.env, and any firewall between this computer and MySQL.');
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return make(`The MySQL host name "${db.host}" could not be found.`,
        'Use DB_HOST=127.0.0.1 for MySQL on this computer.');
    case 'ECONNRESET':
    case 'EPIPE':
    case 'PROTOCOL_CONNECTION_LOST':
      return make('The connection to MySQL was lost.',
        'MySQL may have been restarted or stopped. Start it again and retry.');
    case 'ER_CON_COUNT_ERROR':
      return make('MySQL has too many open connections.',
        'Close other programs using MySQL, or lower DB_CONNECTION_LIMIT in backend/.env.');
    case 'ER_ACCESS_DENIED_ERROR':
      return make(`MySQL rejected the user name or password for user "${db.user}".`,
        'Check DB_USER and DB_PASSWORD in backend/.env. If the password contains a # character, wrap it in double quotes. '
        + 'You can test the same login in MySQL Workbench.');
    case 'ER_DBACCESS_DENIED_ERROR':
    case 'ER_BAD_DB_ERROR':
      return make(`The database "${db.database}" does not exist, or user "${db.user}" is not allowed to use it.`,
        'Check DB_NAME in backend/.env, make sure database/schema.sql was run, and that database/create_app_user.sql was run.');
    case 'ER_TABLEACCESS_DENIED_ERROR':
      return make(`User "${db.user}" is not allowed to read a table it needs.`,
        'Run the GRANT statements in database/create_app_user.sql again.');
    case 'ER_NO_SUCH_TABLE':
      return make('A table the application needs does not exist in the database.',
        'Run database/schema.sql (and then database/seed.sql) in MySQL Workbench.');
    default:
      return make(`Unexpected database error (code ${code}).`,
        'Run "npm run db:check -- --verbose" for technical details.');
  }
}

/** Wraps any error as a DatabaseError (errors that are already ours are returned unchanged). */
function toDatabaseError(error, db = config.db) {
  if (error instanceof DatabaseError || error instanceof DbConfigError) return error;
  return new DatabaseError(describeDbError(error, db), error);
}

// ---------------------------------------------------------------------------------------------------
// The shared pool
// ---------------------------------------------------------------------------------------------------

let sharedPool = null;

/** The one pool used by the whole application. Created on first use; creating it does not connect yet. */
function getPool() {
  if (!sharedPool) sharedPool = createDbPool(config.db);
  return sharedPool;
}

/** Closes the shared pool (needed so scripts and tests can exit, and for a graceful server shutdown). Safe to call twice. */
async function closePool() {
  if (!sharedPool) return;
  const pool = sharedPool;
  sharedPool = null;
  await pool.end();
}

/**
 * Proves that MySQL can be reached with the configured settings and returns facts about the connection.
 * Throws a DatabaseError (plain-language message, no secrets) when it fails.
 */
async function checkConnection(pool = getPool(), db = config.db) {
  try {
    const [rows] = await pool.query(
      `SELECT VERSION() AS version,
              DATABASE() AS database_name,
              USER() AS client_user,
              CURRENT_USER() AS account,
              @@session.time_zone AS session_time_zone,
              @@global.time_zone AS global_time_zone,
              @@character_set_connection AS charset,
              @@collation_connection AS collation,
              DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS session_now,
              DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s') AS utc_now`,
    );
    return rows[0];
  } catch (error) {
    throw toDatabaseError(error, db);
  }
}

module.exports = {
  getPool,
  closePool,
  checkConnection,
  createDbPool,
  buildPoolOptions,
  assertDbConfig,
  describeDbError,
  toDatabaseError,
  DbConfigError,
  DatabaseError,
};
