// Small helpers for building SQL safely. Values are ALWAYS passed to MySQL as separate parameters (the "?" placeholders),
// never glued into the SQL text. This file handles the one thing placeholders do not: wildcard characters inside LIKE.

/**
 * Makes text safe to use inside a LIKE pattern, so it matches literally.
 * In LIKE, "%" means "any characters" and "_" means "any single character". Without escaping, a search for "%" would
 * match every movie. The escape character is "!" (used with  ESCAPE '!'), which avoids the confusion of backslashes
 * in JavaScript strings and in MySQL.
 *   escapeLike('100%')  ->  '100!%'
 */
function escapeLike(text) {
  return String(text).replace(/[!%_]/g, '!$&');
}

module.exports = { escapeLike };
