// The single place where every error becomes a JSON response: { "success": false, "error": { "message": ... } }.
// Expected errors (AppError) keep their message. Unexpected errors are logged on the server and the client only
// sees a generic message, so database errors, file paths or stack traces are never leaked.

const AppError = require('../utils/AppError');
const { config } = require('../config/env');
const { DatabaseError } = require('../config/db');

// Express recognises an error handler by its four parameters, so "next" must stay even though it is unused.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = 500;
  let message = 'Something went wrong on our side. Please try again later.';
  let details = null;

  if (err instanceof DatabaseError && err.unavailable === true) {
    // A genuine connectivity outage is temporary; never send driver messages, SQL, or causes to clients.
    status = 503;
    message = 'The database is temporarily unavailable. Please try again later.';
  } else if (err instanceof AppError) {
    ({ status, message, details } = err);
  } else if (err && err.type === 'entity.parse.failed') {
    status = 400;
    message = 'The request body is not valid JSON.';
  } else if (err && err.type === 'entity.too.large') {
    status = 413;
    message = 'The request body is too large.';
  }

  if (status >= 500 && !config.isTest) {
    // DatabaseError.cause may contain driver internals. Log only safe, application-authored metadata.
    if (err instanceof DatabaseError) {
      const cause = err.cause;
      // Detailed diagnostics stay in the local server terminal; never expose SQL details to the browser.
      console.error('[DATABASE DIAGNOSTIC]', {
        code: cause?.code || err.code,
        message: cause?.sqlMessage || cause?.message || err.message,
        sqlState: cause?.sqlState || null,
        table: cause?.table || null,
      });
    } else {
      console.error('Unhandled application error:', err && err.name ? err.name : 'Error');
    }
  }

  const error = details ? { message, details } : { message };
  return res.status(status).json({ success: false, error });
}

module.exports = errorHandler;
