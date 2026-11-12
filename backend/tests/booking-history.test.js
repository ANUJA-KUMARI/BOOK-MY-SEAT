process.env.NODE_ENV = 'test';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { _internals } = require('../services/booking-read.service');
const AppError = require('../utils/AppError');
const { parseId } = require('../validators/params');

describe('booking history response mapping', () => {
  it('maps booking, show, cinema, screen and historical seat price snapshot fields', () => {
    const rows = [{
      id: 7, booking_ref: 'BMS-TEST-1234567890', status: 'CONFIRMED', total_amount: 260,
      created_at: '2026-11-12 08:20:00', cancelled_at: null,
      show_id: 1301, show_start_time: '2026-11-12 08:15:00', show_status: 'SCHEDULED',
      movie_id: 1, movie_title: 'Midnight Monsoon', poster_url: null,
      cinema_id: 2, cinema_name: 'Lotus Multiplex', cinema_city: 'Delhi', cinema_address: 'Delhi',
      screen_id: 3, screen_name: 'Screen 1',
    }];
    const seats = [{
      booking_id: 7, seat_id: 2101, row_label: 'A', seat_number: 1,
      category: 'STANDARD', price_snapshot: 260,
    }];
    const [booking] = _internals.mapBookingRows(rows, seats);
    assert.equal(booking.id, 7);
    assert.equal(booking.show.movie.title, 'Midnight Monsoon');
    assert.equal(booking.show.cinema.name, 'Lotus Multiplex');
    assert.deepEqual(booking.seats, [{
      id: 2101, row_label: 'A', seat_number: 1, category: 'STANDARD', price: 260,
    }]);
    assert.equal(booking.total_amount, 260);
    assert.equal(booking.cancelled_at, null);
    assert.match(booking.created_at, /Z$/);
  });

  it('keeps a booking with no seat rows and returns an empty seats array', () => {
    const row = {
      id: 8, booking_ref: 'BMS-TEST-ABCDEFGHIJ', status: 'CANCELLED', total_amount: 0,
      created_at: '2026-11-12 08:20:00', cancelled_at: '2026-11-12 09:00:00',
      show_id: 1301, show_start_time: '2026-11-12 08:15:00', show_status: 'SCHEDULED',
      movie_id: 1, movie_title: 'Midnight Monsoon', poster_url: null,
      cinema_id: 2, cinema_name: 'Lotus Multiplex', cinema_city: 'Delhi', cinema_address: 'Delhi',
      screen_id: 3, screen_name: 'Screen 1',
    };
    const [booking] = _internals.mapBookingRows([row], []);
    assert.deepEqual(booking.seats, []);
    assert.equal(booking.status, 'CANCELLED');
    assert.match(booking.cancelled_at, /Z$/);
  });
});

describe('booking detail ID validation', () => {
  it('rejects malformed booking IDs before database access', () => {
    for (const id of ['abc', '0', '-1', '1.5', '1e3', '07', '99999999999999999999']) {
      assert.throws(() => parseId(id, 'booking id'), AppError);
    }
  });
});
