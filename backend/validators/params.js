// Input validators for route parameters and query strings. Each one either returns a clean value or throws
// AppError(400). Never trust req.params / req.query: they are plain strings (or arrays) typed by the client.

const AppError = require('../utils/AppError');

/** A positive whole number such as "7" (not "abc", "0", "-1", "1.5" or "1e3"). */
function parseId(value, name = 'id') {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value)) {
    throw new AppError(400, `${name} must be a positive whole number.`);
  }
  return Number(value);
}

/** Optional text filter such as ?search=. Missing means "no filter". Arrays (?a=1&a=2) are rejected. */
function parseOptionalText(value, name, maxLength = 100) {
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new AppError(400, `${name} must be a single text value.`);
  const text = value.trim();
  if (text.length > maxLength) throw new AppError(400, `${name} must be at most ${maxLength} characters.`);
  return text;
}

/** Optional calendar date "YYYY-MM-DD" that really exists (rejects 2026-02-31). Returns '' when missing. */
function parseOptionalDate(value, name = 'date') {
  if (value === undefined || value === '') return '';
  const match = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) throw new AppError(400, `${name} must be in the format YYYY-MM-DD.`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new AppError(400, `${name} is not a real calendar date.`);
  }
  return value;
}

module.exports = { parseId, parseOptionalText, parseOptionalDate };
