process.env.NODE_ENV = 'test';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const { closePool } = require('../config/db');
const { dbSkipReason } = require('./helpers/db-skip');
const seatService = require('../services/seat.service');

function listen(application) {
  return new Promise((resolve) => {
    const server = application.listen(0, '127.0.0.1', () => resolve(server));
  });
}
const stop = (server) => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); });
let server;
let base;
async function call(path) {
  const res = await fetch(base + path);
  return { res, body: await res.json() };
}
before(async () => {
  server = await listen(app);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await stop(server);
  await closePool();
});

describe('seat map transformation', () => {
  it('marks only active reservations as booked and preserves numeric prices and seat IDs', () => {
    const result = seatService._internals.buildSeatMap([
      { id: 11, row_label: 'A', seat_number: 1, category: 'STANDARD', active_booking_id: null },
      { id: 12, row_label: 'A', seat_number: 2, category: 'PREMIUM', active_booking_id: 99 },
    ], [
      { category: 'STANDARD', price: '220.00' },
      { category: 'PREMIUM', price: '320.00' },
      { category: 'RECLINER', price: '520.00' },
    ]);
    assert.deepEqual(result.seats.map((s) => [s.id, s.is_available, s.status]), [
      [11, true, 'AVAILABLE'], [12, false, 'BOOKED'],
    ]);
    assert.deepEqual(result.prices, { STANDARD: 220, PREMIUM: 320, RECLINER: 520 });
  });
});

describe('GET /api/shows/:id/seats input validation', () => {
  it('rejects malformed show IDs before querying MySQL', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '1e3', '07', '99999999999999999999']) {
      const { res, body } = await call(`/api/shows/${id}/seats`);
      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.equal(typeof body.error.message, 'string');
    }
  });
});

describe('GET /api/shows/:id/seats with MySQL', { skip: dbSkipReason }, () => {
  it('returns the screen seat map, authoritative prices and consistent availability counts', async () => {
    const showsResult = await call('/api/movies/1/shows');
    assert.equal(showsResult.res.status, 200);
    assert.ok(showsResult.body.data.length > 0, 'seed data must contain an upcoming show');
    const showId = showsResult.body.data[0].id;
    const { res, body } = await call(`/api/shows/${showId}/seats`);
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    const data = body.data;
    assert.equal(data.show.id, showId);
    assert.ok(data.show.screen.id > 0);
    assert.ok(data.seats.length > 0);
    assert.deepEqual(Object.keys(data.prices).sort(), ['PREMIUM', 'RECLINER', 'STANDARD']);
    assert.equal(data.summary.total, data.seats.length);
    assert.equal(data.summary.available + data.summary.booked, data.summary.total);
    assert.equal(data.seats.length, new Set(data.seats.map((seat) => seat.id)).size);
    for (const seat of data.seats) {
      assert.ok(['STANDARD', 'PREMIUM', 'RECLINER'].includes(seat.category));
      assert.equal(typeof seat.is_available, 'boolean');
      assert.equal(seat.status, seat.is_available ? 'AVAILABLE' : 'BOOKED');
    }
    // The database may contain intentional live test bookings from earlier stages.\n    // Validate the availability contract without assuming every seeded seat is free.\n    assert.ok(data.summary.available >= 0);\n    assert.ok(data.summary.booked >= 0);\n    assert.ok(data.seats.some((seat) => seat.status === 'AVAILABLE'), 'show should expose available seats');
  });

  it('returns 404 for a show that does not exist', async () => {
    const { res, body } = await call('/api/shows/9999999999/seats');
    assert.equal(res.status, 404);
    assert.deepEqual(body, { success: false, error: { message: 'Show not found.' } });
  });
});
