process.env.NODE_ENV = 'test';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const errorHandler = require('../middleware/errorHandler');
const AppError = require('../utils/AppError');
const { DatabaseError } = require('../config/db');

async function requestFor(error) {
  const app = express();
  app.get('/test', (_req, _res, next) => next(error));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/test`);
    return { status: response.status, body: await response.json() };
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('central error handler database availability mapping', () => {
  it('returns 503 with a safe generic message for genuine database outages', async () => {
    const secret = 'db-password-must-not-leak';
    const error = new DatabaseError({ code: 'ECONNREFUSED', message: 'driver text', hint: 'private', unavailable: true }, new Error(`SQL ${secret}`));
    const result = await requestFor(error);
    assert.equal(result.status, 503);
    assert.deepEqual(result.body, {
      success: false,
      error: { message: 'The database is temporarily unavailable. Please try again later.' },
    });
    assert.ok(!JSON.stringify(result.body).includes(secret));
  });

  it('does not misclassify non-connectivity database errors as outages', async () => {
    const error = new DatabaseError({ code: 'ER_ACCESS_DENIED_ERROR', message: 'safe internal text', hint: 'safe', unavailable: false }, new Error('driver internals'));
    const result = await requestFor(error);
    assert.equal(result.status, 500);
    assert.equal(result.body.success, false);
    assert.doesNotMatch(JSON.stringify(result.body), /driver internals|safe internal text/);
  });

  it('preserves application validation/status errors', async () => {
    const result = await requestFor(new AppError(422, 'A field is invalid.', { field: 'email' }));
    assert.equal(result.status, 422);
    assert.deepEqual(result.body, { success: false, error: { message: 'A field is invalid.', details: { field: 'email' } } });
  });

  it('keeps unexpected programming errors generic', async () => {
    const result = await requestFor(new TypeError('internal stack and SQL must not leak'));
    assert.equal(result.status, 500);
    assert.deepEqual(result.body, { success: false, error: { message: 'Something went wrong on our side. Please try again later.' } });
  });
});
