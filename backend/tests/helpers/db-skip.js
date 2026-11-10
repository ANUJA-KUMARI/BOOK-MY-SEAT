// Shared by the tests that need a real MySQL connection.
// Returns a text (the reason) when those tests should be skipped, or false when they should run:
//   * SKIP_DB_TESTS=1                 -> skipped on purpose (PowerShell:  $env:SKIP_DB_TESTS = "1" ; npm test)
//   * DB_USER / DB_PASSWORD missing   -> skipped (a teammate without MySQL can still run the other tests)
// If the settings ARE present but MySQL is not reachable, the tests are NOT skipped: they fail, so a stopped
// database is never hidden.

const { config } = require('../../config/env');

const dbSkipReason = process.env.SKIP_DB_TESTS === '1'
  ? 'SKIP_DB_TESTS=1'
  : (!config.db.user || !config.db.password) && 'DB_USER / DB_PASSWORD are not set in backend/.env';

module.exports = { dbSkipReason };
