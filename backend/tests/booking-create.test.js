process.env.NODE_ENV = 'test';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateCreateBooking } = require('../validators/booking');
const { _internals } = require('../services/booking.service');
const AppError = require('../utils/AppError');

describe('booking request validation', () => {
  it('accepts a valid request and sorts seat IDs', () => {
    assert.deepEqual(validateCreateBooking({ showId: 12, seatIds: [9, 2, 4] }), {
      showId: 12, seatIds: [2, 4, 9],
    });
  });
  it('rejects missing, malformed and excessive seat selections', () => {
    for (const body of [
      {}, { showId: 1, seatIds: [] }, { showId: 1, seatIds: [1, 2, 3, 4, 5, 6, 7] },
      { showId: 1, seatIds: [1, 1] }, { showId: 1, seatIds: [0] },
      { showId: 1.5, seatIds: [1] }, { showId: '1', seatIds: [1] },
      { showId: 1, seatIds: '1,2' }, null, [],
    ]) assert.throws(() => validateCreateBooking(body), AppError);
  });
  it('generates unique booking references with the BMS prefix', () => {
    const first = _internals.makeBookingReference();
    const second = _internals.makeBookingReference();
    assert.match(first, /^BMS-[A-Z0-9]+-[A-F0-9]{10}$/);
    assert.notEqual(first, second);
  });
});
