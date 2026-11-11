process.env.NODE_ENV = 'test';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const authenticate = require('../middleware/authenticate');
const { config } = require('../config/env');

function invoke(token) {
  const req = { cookies: token ? { bms_token: token } : {} };
  let error;
  let nextCalled = false;
  authenticate(req, {}, (value) => {
    error = value;
    if (!value) nextCalled = true;
  });
  return { req, error, nextCalled };
}

function createToken(claims = {}, overrides = {}) {
  return jwt.sign(
    { role: 'USER', ...claims },
    config.jwt.secret,
    {
      subject: '42',
      expiresIn: '15m',
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      algorithm: 'HS256',
      ...overrides,
    },
  );
}

describe('Stage 4 — authentication middleware and request identity', () => {
  it('rejects requests without an access-token cookie', () => {
    const result = invoke(undefined);
    assert.equal(result.error.status, 401);
    assert.equal(result.nextCalled, false);
    assert.equal(result.req.auth, undefined);
  });

  it('accepts a valid access token and attaches only the user id and role', {
    skip: !config.jwt.secret,
  }, () => {
    const result = invoke(createToken());
    assert.equal(result.error, undefined);
    assert.equal(result.nextCalled, true);
    assert.deepEqual(result.req.auth, { id: 42, role: 'USER' });
  });

  it('accepts an ADMIN role claim for later role-aware route checks', {
    skip: !config.jwt.secret,
  }, () => {
    const result = invoke(createToken({ role: 'ADMIN' }));
    assert.equal(result.error, undefined);
    assert.deepEqual(result.req.auth, { id: 42, role: 'ADMIN' });
  });

  it('rejects expired tokens', {
    skip: !config.jwt.secret,
  }, () => {
    const result = invoke(createToken({}, { expiresIn: -1 }));
    assert.equal(result.error.status, 401);
    assert.equal(result.req.auth, undefined);
  });

  it('rejects tokens with the wrong issuer or audience', {
    skip: !config.jwt.secret,
  }, () => {
    const wrongIssuer = invoke(createToken({}, { issuer: 'another-issuer' }));
    const wrongAudience = invoke(createToken({}, { audience: 'another-client' }));
    assert.equal(wrongIssuer.error.status, 401);
    assert.equal(wrongAudience.error.status, 401);
  });

  it('rejects a token signed with an algorithm other than HS256', {
    skip: !config.jwt.secret,
  }, () => {
    const result = invoke(createToken({}, { algorithm: 'HS384' }));
    assert.equal(result.error.status, 401);
    assert.equal(result.req.auth, undefined);
  });

  it('rejects malformed user identity claims', {
    skip: !config.jwt.secret,
  }, () => {
    const invalidSubject = invoke(createToken({}, { subject: 'not-a-user-id' }));
    const unsafeSubject = invoke(createToken({}, { subject: '9007199254740992' }));
    const invalidRole = invoke(createToken({ role: 'SUPERADMIN' }));

    assert.equal(invalidSubject.error.status, 401);
    assert.equal(unsafeSubject.error.status, 401);
    assert.equal(invalidRole.error.status, 401);
  });
});
