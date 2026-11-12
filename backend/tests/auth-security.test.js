process.env.NODE_ENV = 'test';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { loadConfig } = require('../config/env');
const authorize = require('../middleware/authorize');
const {
  requireSameOrigin,
  requireCsrf,
} = require('../middleware/csrf');

describe('authentication security primitives', () => {
  it('rejects a request without a same-origin Origin header', () => {
    let error;
    requireSameOrigin({ get: () => undefined, secure: false }, {}, (value) => { error = value; });
    assert.equal(error.status, 403);
  });

  it('rejects a cross-origin request', () => {
    const req = {
      secure: false,
      get(name) {
        return name === 'origin' ? 'https://attacker.example' : 'localhost:3000';
      },
    };
    let error;
    requireSameOrigin(req, {}, (value) => { error = value; });
    assert.equal(error.status, 403);
  });

  it('requires matching double-submit cookie and header tokens', () => {
    const req = {
      cookies: { bms_csrf: 'a'.repeat(64) },
      get: (name) => (name === 'x-csrf-token' ? 'b'.repeat(64) : undefined),
    };
    let error;
    requireCsrf(req, {}, (value) => { error = value; });
    assert.equal(error.status, 403);
  });

  it('allows matching CSRF tokens', () => {
    const token = 'a'.repeat(64);
    const req = {
      cookies: { bms_csrf: token },
      get: (name) => (name === 'x-csrf-token' ? token : undefined),
    };
    let called = false;
    requireCsrf(req, {}, (error) => { assert.equal(error, undefined); called = true; });
    assert.equal(called, true);
  });

  it('enforces role authorization and rejects unauthenticated access', () => {
    const middleware = authorize('ADMIN');
    let unauthenticatedError;
    middleware({}, {}, (error) => { unauthenticatedError = error; });
    assert.equal(unauthenticatedError.status, 401);

    let forbiddenError;
    middleware({ auth: { role: 'USER' } }, {}, (error) => { forbiddenError = error; });
    assert.equal(forbiddenError.status, 403);

    let allowed = false;
    middleware({ auth: { role: 'ADMIN' } }, {}, (error) => { assert.equal(error, undefined); allowed = true; });
    assert.equal(allowed, true);
  });

  it('keeps JWT issuer, audience and expiry defaults aligned with approved configuration', () => {
    const { jwt: settings } = loadConfig({});
    assert.equal(settings.expiresIn, '15m');
    assert.equal(settings.issuer, 'book-my-seat');
    assert.equal(settings.audience, 'book-my-seat-client');
  });
});
