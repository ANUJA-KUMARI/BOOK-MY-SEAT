process.env.NODE_ENV = 'test';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { mapAdminBookings, buildFilters } = require('../services/admin-bookings.service');
const { _internals } = require('../controllers/admin-bookings.controller');

describe('Phase 8 Stage 6 admin booking service helpers', () => {
  it('builds parameterized search and status filters', () => {
    const result = buildFilters({ search: 'BMS-ABC', status: 'CONFIRMED' });
    assert.equal(result.sql, ' WHERE b.status = ? AND (b.booking_ref LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
    assert.deepEqual(result.values, ['CONFIRMED', '%BMS-ABC%', '%BMS-ABC%', '%BMS-ABC%']);
  });

  it('does not add a filter for the all status option', () => {
    assert.deepEqual(buildFilters({ search: '', status: 'all' }), { sql: '', values: [] });
  });

  it('maps customer, show, timestamps and historical seat prices without leaking credentials', () => {
    const booking = mapAdminBookings([{
      id: 12, booking_ref: 'BMS-TEST', status: 'CANCELLED', total_amount: 540,
      created_at: '2026-11-10 10:00:00', cancelled_at: '2026-11-10 11:00:00',
      user_id: 5, customer_name: 'Test Customer', customer_email: 'test@example.com',
      show_id: 8, show_start_time: '2026-11-20 14:30:00', show_status: 'SCHEDULED',
      movie_id: 2, movie_title: 'Test Film', poster_url: null,
      cinema_id: 3, cinema_name: 'Test Cinema', cinema_city: 'New Delhi',
      screen_id: 4, screen_name: 'Screen 1',
    }], [{
      booking_id: 12, seat_id: 90, row_label: 'A', seat_number: 1,
      category: 'STANDARD', price_snapshot: 220, active: null,
    }])[0];

    assert.equal(booking.customer.email, 'test@example.com');
    assert.equal(booking.show.movie.title, 'Test Film');
    assert.equal(booking.seats[0].price, 220);
    assert.equal(booking.seats[0].active, false);
    assert.equal(booking.created_at, '2026-11-10T10:00:00.000Z');
    assert.equal(Object.hasOwn(booking, 'password_hash'), false);
  });

  it('validates positive pagination values and rejects malformed values', () => {
    assert.equal(_internals.parsePage('3', 'page', 1, 100), 3);
    assert.throws(() => _internals.parsePage('0', 'page', 1, 100), { status: 400 });
    assert.throws(() => _internals.parsePage('1.5', 'page', 1, 100), { status: 400 });
    assert.throws(() => _internals.parsePage('101', 'limit', 20, 100), { status: 400 });
  });
});
