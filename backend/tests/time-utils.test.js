// Unit tests for utils/time.js (no database needed). These protect against the classic bug of shifting a time twice.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { INDIA_UTC_OFFSET_MINUTES, toIsoUtc, indiaDayRangeUtc } = require('../utils/time');

describe('toIsoUtc(): MySQL DATETIME text (UTC) to ISO text with Z', () => {
  it('only changes the format, never the time (no shifting)', () => {
    assert.equal(toIsoUtc('2026-11-03 05:00:00'), '2026-11-03T05:00:00.000Z');
    assert.equal(toIsoUtc('2026-11-03 17:15:00'), '2026-11-03T17:15:00.000Z');
    assert.equal(toIsoUtc('2026-12-31 23:59:59'), '2026-12-31T23:59:59.000Z');
    assert.equal(toIsoUtc('2028-02-29 00:00:00'), '2028-02-29T00:00:00.000Z');
  });

  it('accepts a "T" separator and fractional seconds, and a Date object', () => {
    assert.equal(toIsoUtc('2026-11-03T05:00:00'), '2026-11-03T05:00:00.000Z');
    assert.equal(toIsoUtc('2026-11-03 05:00:00.000'), '2026-11-03T05:00:00.000Z');
    assert.equal(toIsoUtc(new Date(Date.UTC(2026, 10, 3, 5, 0, 0))), '2026-11-03T05:00:00.000Z');
  });

  it('refuses anything that is not a real MySQL date and time', () => {
    for (const bad of ['', 'tomorrow', '2026-11-03', '2026-13-01 00:00:00', '2026-02-31 10:00:00', null, undefined, 42, {}, new Date(NaN)]) {
      assert.throws(() => toIsoUtc(bad), TypeError, String(bad));
    }
  });
});

describe('indiaDayRangeUtc(): an India calendar day as a UTC range', () => {
  it('India is UTC+05:30', () => {
    assert.equal(INDIA_UTC_OFFSET_MINUTES, 330);
  });

  it('a day runs from 18:30 UTC the evening before until 18:30 UTC that evening (end excluded)', () => {
    assert.deepEqual(indiaDayRangeUtc('2026-11-03'), { from: '2026-11-02 18:30:00', to: '2026-11-03 18:30:00' });
  });

  it('crosses month, year and leap-day boundaries correctly', () => {
    assert.deepEqual(indiaDayRangeUtc('2026-12-01'), { from: '2026-11-30 18:30:00', to: '2026-12-01 18:30:00' });
    assert.deepEqual(indiaDayRangeUtc('2026-01-01'), { from: '2025-12-31 18:30:00', to: '2026-01-01 18:30:00' });
    assert.deepEqual(indiaDayRangeUtc('2028-03-01'), { from: '2028-02-29 18:30:00', to: '2028-03-01 18:30:00' });
    assert.deepEqual(indiaDayRangeUtc('2028-02-29'), { from: '2028-02-28 18:30:00', to: '2028-02-29 18:30:00' });
  });

  it('the 10:30 and 22:45 India show times of a day both fall inside that day (and nothing else does)', () => {
    const { from, to } = indiaDayRangeUtc('2026-11-03');
    const utc = (text) => new Date(`${text.replace(' ', 'T')}Z`).getTime();
    const showTimes = { '10:30 IST = 05:00 UTC': '2026-11-03 05:00:00', '22:45 IST = 17:15 UTC': '2026-11-03 17:15:00' };
    for (const text of Object.values(showTimes)) assert.ok(utc(text) >= utc(from) && utc(text) < utc(to), text);
    assert.ok(utc('2026-11-02 17:15:00') < utc(from), 'the previous evening show is the previous day');
    assert.ok(utc('2026-11-03 18:30:00') >= utc(to), '00:00 IST of the next day is excluded');
  });

  it('every moment belongs to exactly the India day you get by adding 5h30m (property check)', () => {
    let seed = 12345;
    const next = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed; };
    for (let i = 0; i < 2000; i += 1) {
      const t = Date.UTC(2025, 0, 1) + (next() % (4 * 365 * 24 * 60)) * 60000; // any minute in 4 years
      const indiaDate = new Date(t + 330 * 60000).toISOString().slice(0, 10);
      const { from, to } = indiaDayRangeUtc(indiaDate);
      const ms = (text) => new Date(`${text.replace(' ', 'T')}Z`).getTime();
      assert.ok(ms(from) <= t && t < ms(to), `${new Date(t).toISOString()} in ${indiaDate}`);
    }
  });

  it('returns null for text that is not a real calendar date', () => {
    for (const bad of ['', '2026-02-31', '2026-13-01', '2026-00-10', '2026-1-1', '03-11-2026', 'tomorrow', null, undefined, 20261103]) {
      assert.equal(indiaDayRangeUtc(bad), null, String(bad));
    }
  });
});
