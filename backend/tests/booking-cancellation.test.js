process.env.NODE_ENV = 'test';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const { closePool } = require('../config/db');
const AppError = require('../utils/AppError');
const { _internals } = require('../services/booking-cancellation.service');

let server;
let base;
before(async () => {
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  });
  await closePool();
});

describe('booking cancellation eligibility', () => {
  it('allows cancellation only for confirmed bookings outside the two-hour cutoff', () => {
    assert.equal(_internals.CANCELLATION_CUTOFF_HOURS, 2);
    assert.doesNotThrow(() => _internals.assertCancellationAllowed('CONFIRMED', false));
  });

  it('rejects cancellation at or inside the two-hour cutoff', () => {
    assert.throws(
      () => _internals.assertCancellationAllowed('CONFIRMED', true),
      (error) => error instanceof AppError && error.status === 409,
    );
  });

  it('rejects already-cancelled or otherwise non-confirmed bookings', () => {
    for (const status of ['CANCELLED', 'PENDING', 'COMPLETED']) {
      assert.throws(
        () => _internals.assertCancellationAllowed(status, false),
        (error) => error instanceof AppError && error.status === 409,
      );
    }
  });
});

describe('booking cancellation endpoint security', () => {
  it('rejects DELETE without a valid same-origin header', async () => {
    const response = await fetch(base + '/api/bookings/1', { method: 'DELETE' });
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.equal(body.error.message, 'A valid same-origin request is required.');
  });

  it('requires authentication even when the request is same-origin', async () => {
    const response = await fetch(base + '/api/bookings/1', {
      method: 'DELETE',
      headers: { Origin: base },
    });
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error.message, 'Authentication is required.');
  });
});
