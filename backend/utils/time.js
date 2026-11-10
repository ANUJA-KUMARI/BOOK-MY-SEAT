// Time helpers. THE RULE FOR THE WHOLE PROJECT:
//   * MySQL stores show times in UTC (DATETIME has no time zone, so UTC is the agreed convention).
//   * The API sends them as ISO-8601 text ending in "Z" (UTC), e.g. "2026-11-03T05:00:00.000Z".
//   * The browser turns that into the visitor's local time (India time for visitors in India), once, when it displays it.
// Nothing in the backend ever converts a show time to India time for DISPLAY. The only place India time appears is
// the optional ?date=YYYY-MM-DD filter, where the visitor means an INDIA calendar day; indiaDayRangeUtc() converts that
// day into a UTC range once, so MySQL can compare UTC with UTC.

// India Standard Time is UTC+05:30 all year (India has no daylight saving time).
const INDIA_UTC_OFFSET_MINUTES = 330;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const MYSQL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/;

/**
 * A DATETIME as text from MySQL ("2026-11-03 05:00:00", UTC, because the pool uses dateStrings) -> ISO text with "Z".
 * Throws on anything else, so a wrong value is noticed instead of silently shifting a time.
 */
function toIsoUtc(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const match = typeof value === 'string' ? MYSQL_DATETIME.exec(value) : null;
  if (!match) throw new TypeError(`Not a MySQL DATETIME value: ${String(value)}`);
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new TypeError(`Not a real date and time: ${value}`);
  }
  return date.toISOString();
}

/** A UTC moment in the text format MySQL accepts for DATETIME comparisons: "YYYY-MM-DD HH:MM:SS". */
function toMysqlUtc(milliseconds) {
  return new Date(milliseconds).toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * The India calendar day "YYYY-MM-DD" as a UTC range { from, to } (from is included, to is excluded),
 * in the text format MySQL compares with start_time. Returns null if the text is not a real calendar date.
 *   '2026-11-03'  ->  { from: '2026-11-02 18:30:00', to: '2026-11-03 18:30:00' }
 * (India's day 3 November runs from 2 November 18:30 UTC until 3 November 18:30 UTC.)
 */
function indiaDayRangeUtc(dateText) {
  const match = typeof dateText === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText) : null;
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const midnightUtc = Date.UTC(year, month - 1, day);
  const check = new Date(midnightUtc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  const from = midnightUtc - INDIA_UTC_OFFSET_MINUTES * MINUTE_MS;
  return { from: toMysqlUtc(from), to: toMysqlUtc(from + DAY_MS) };
}

module.exports = { INDIA_UTC_OFFSET_MINUTES, toIsoUtc, indiaDayRangeUtc };
