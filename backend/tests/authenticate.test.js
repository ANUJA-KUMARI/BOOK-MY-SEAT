process.env.NODE_ENV = 'test';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const authenticate = require('../middleware/authenticate');
const authService = require('../services/auth.service');
const { config } = require('../config/env');

const originalFindUserById = authService.findUserById;
let databaseRole = 'USER';
let databaseUserId = 42;

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

async function invoke(token) {
  const req = { cookies: token ? { bms_token: token } : {} };
  let error;
  let nextCalled = false;
  await new Promise((resolve) => {
    const returned = authenticate(req, {}, (value) => {
      error = value;
      if (!value) nextCalled = true;
      resolve();
    });
    // authenticate always completes through next(), including asynchronous DB lookups.
    if (returned && typeof returned.then === 'function') returned.catch(resolve);
  });
  return { req, error, nextCalled };
}

describe('Stage 4 — authentication middleware and request identity', () => {
  before(() => {
    authService.findUserById = async (id) => {
      if (id !== databaseUserId) return null;
      return { id, name: 'Test User', email: 'test@example.com', role: databaseRole };
    };
  });

  after(() => {
    authService.findUserById = originalFindUserById;
  });

  it('rejects requests without an access-token cookie', async () => {
    const result = await invoke(undefined);
    assert.equal(result.error.status, 401);
    assert.equal(result.nextCalled, false);
    assert.equal(result.req.auth, undefined);
  });

  it('accepts a valid access token and attaches the database user id and role', {
    skip: !config.jwt.secret,
  }, async () => {
    databaseRole = 'USER';
    const result = await invoke(createToken());
    assert.equal(result.error, undefined);
    assert.equal(result.nextCalled, true);
    assert.deepEqual(result.req.auth, { id: 42, role: 'USER' });
  });

  it('accepts an ADMIN role claim for later role-aware route checks', {
    skip: !config.jwt.secret,
  }, async () => {
    databaseRole = 'ADMIN';
    const result = await invoke(createToken({ role: 'ADMIN' }));
    assert.equal(result.error, undefined);
    assert.deepEqual(result.req.auth, { id: 42, role: 'ADMIN' });
  });

  it('uses the current database role rather than trusting a stale JWT role', {
    skip: !config.jwt.secret,
  }, async () => {
    databaseRole = 'USER';
    const result = await invoke(createToken({ role: 'ADMIN' }));
    assert.equal(result.error, undefined);
    assert.deepEqual(result.req.auth, { id: 42, role: 'USER' });
  });

  it('rejects expired tokens', {
    skip: !config.jwt.secret,
  }, async () => {
    const result = await invoke(createToken({}, { expiresIn: -1 }));
    assert.equal(result.error.status, 401);
    assert.equal(result.req.auth, undefined);
  });

  it('rejects tokens with the wrong issuer or audience', {
    skip: !config.jwt.secret,
  }, async () => {
    const wrongIssuer = await invoke(createToken({}, { issuer: 'another-issuer' }));
    const wrongAudience = await invoke(createToken({}, { audience: 'another-client' }));
    assert.equal(wrongIssuer.error.status, 401);
    assert.equal(wrongAudience.error.status, 401);
  });

  it('rejects a token signed with an algorithm other than HS256', {
    skip: !config.jwt.secret,
  }, async () => {
    const result = await invoke(createToken({}, { algorithm: 'HS384' }));
    assert.equal(result.error.status, 401);
    assert.equal(result.req.auth, undefined);
  });

  it('rejects malformed user identity and role claims', {
    skip: !config.jwt.secret,
  }, async () => {
    const invalidSubject = await invoke(createToken({}, { subject: 'not-a-user-id' }));
    const unsafeSubject = await invoke(createToken({}, { subject: '9007199254740992' }));
    const invalidRole = await invoke(createToken({ role: 'SUPERADMIN' }));

    assert.equal(invalidSubject.error.status, 401);
    assert.equal(unsafeSubject.error.status, 401);
    assert.equal(invalidRole.error.status, 401);
  });
});
