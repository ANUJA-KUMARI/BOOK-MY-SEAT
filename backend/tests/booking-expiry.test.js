process.env.NODE_ENV = 'test';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { _internals: expiry } = require('../services/booking-expiry.service');
const { _internals: booking } = require('../services/booking.service');
const { _internals: cancellation } = require('../services/booking-cancellation.service');
const fs = require('node:fs');
const path = require('node:path');

describe('10-minute reservation hold configuration', () => {
  it('uses the approved 10-minute duration', () => {
    assert.equal(booking.HOLD_DURATION_MINUTES, 10);
  });
});

describe('expiry worker batch validation', () => {
  it('accepts bounded batch sizes', () => {
    assert.equal(expiry.validateBatchSize(1), 1);
    assert.equal(expiry.validateBatchSize(100), 100);
    assert.equal(expiry.validateBatchSize(500), 500);
  });
  it('rejects invalid or unbounded batch sizes', () => {
    for (const value of [0, -1, 501, 1.5, '100', null]) {
      assert.throws(() => expiry.validateBatchSize(value), TypeError);
    }
  });
});

describe('cancellation transition rules', () => {
  it('allows pending cancellation without applying the confirmed-show cutoff', () => {
    assert.doesNotThrow(() => cancellation.assertCancellationAllowed('PENDING', true));
  });
  it('keeps the two-hour cutoff for confirmed bookings', () => {
    assert.doesNotThrow(() => cancellation.assertCancellationAllowed('CONFIRMED', false));
    assert.throws(() => cancellation.assertCancellationAllowed('CONFIRMED', true), { status: 409 });
  });
  it('does not allow cancellation of expired or already-cancelled bookings', () => {
    for (const status of ['EXPIRED', 'CANCELLED']) {
      assert.throws(() => cancellation.assertCancellationAllowed(status, false), { status: 409 });
    }
  });
});

describe('forward-only migration safety', () => {
  it('adds lifecycle fields without dropping or rewriting existing booking rows', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../../database/migrations/20261120_booking_lifecycle.sql'), 'utf8');
    assert.match(sql, /ALTER TABLE bookings/i);
    assert.match(sql, /PENDING/);
    assert.match(sql, /EXPIRED/);
    assert.match(sql, /ADD COLUMN expires_at/i);
    assert.match(sql, /ADD COLUMN confirmed_at/i);
    assert.match(sql, /ADD KEY idx_bookings_expiry/i);
    assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DELETE FROM|UPDATE bookings/i);
  });
});
