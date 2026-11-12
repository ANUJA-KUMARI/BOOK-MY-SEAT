process.env.NODE_ENV = 'test';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { config } = require('../config/env');
const { signAccessToken } = require('../utils/jwt');
const { AUTH_COOKIE, authCookieOptions } = require('../controllers/auth.controller');

describe('Stage 3 — login JWT and cookie contract', () => {
  it('uses the approved HttpOnly cookie attributes and 15-minute lifetime', () => {
    const options = authCookieOptions();
    assert.equal(AUTH_COOKIE, 'bms_token');
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, config.isProduction);
    assert.equal(options.sameSite, 'lax');
    assert.equal(options.path, '/');
    assert.equal(options.maxAge, 15 * 60 * 1000);
  });

  it('fails closed when the signing secret is not configured', () => {
    if (config.jwt.secret) return;
    assert.throws(
      () => signAccessToken({ id: 42, role: 'USER' }),
      /JWT_SECRET is not configured/,
    );
  });

  it('creates a verifiable HS256 token with the approved identity and claims when configured', {
    skip: !config.jwt.secret,
  }, () => {
    const token = signAccessToken({ id: 42, role: 'USER' });
    const payload = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });

    assert.equal(payload.sub, '42');
    assert.equal(payload.role, 'USER');
    assert.equal(payload.iss, 'book-my-seat');
    assert.equal(payload.aud, 'book-my-seat-client');
    assert.equal(payload.exp - payload.iat, 900);
  });

  it('rejects an expired access token', { skip: !config.jwt.secret }, () => {
    const token = jwt.sign(
      { role: 'USER' },
      config.jwt.secret,
      {
        subject: '42',
        expiresIn: -1,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
        algorithm: 'HS256',
      },
    );
    assert.throws(() => jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }), /expired/);
  });

  it('rejects a token signed with an unapproved algorithm', { skip: !config.jwt.secret }, () => {
    const token = jwt.sign(
      { role: 'USER' },
      config.jwt.secret,
      {
        subject: '42',
        expiresIn: '15m',
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
        algorithm: 'HS384',
      },
    );
    assert.throws(() => jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }));
  });
});
