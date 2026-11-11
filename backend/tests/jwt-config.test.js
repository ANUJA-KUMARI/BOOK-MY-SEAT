// Focused tests for the JWT configuration introduced in Phase 5, Stage 1.
// These tests use loadConfig() with plain objects and do not require MySQL.

process.env.NODE_ENV = 'test';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../config/env');

describe('JWT settings in config/env.js', () => {
  it('uses the approved JWT defaults and allows the secret to be absent before auth is enabled', () => {
    const { jwt } = loadConfig({});
    assert.equal(jwt.secret, undefined);
    assert.equal(jwt.expiresIn, '15m');
    assert.equal(jwt.issuer, 'book-my-seat');
    assert.equal(jwt.audience, 'book-my-seat-client');
  });

  it('reads a configured secret and custom non-empty JWT settings', () => {
    const { jwt } = loadConfig({
      JWT_SECRET: 'a'.repeat(64),
      JWT_EXPIRES_IN: '30m',
      JWT_ISSUER: 'book-my-seat-api',
      JWT_AUDIENCE: 'book-my-seat-web',
    });
    assert.equal(jwt.secret, 'a'.repeat(64));
    assert.equal(jwt.expiresIn, '30m');
    assert.equal(jwt.issuer, 'book-my-seat-api');
    assert.equal(jwt.audience, 'book-my-seat-web');
  });

  it('keeps the signing secret out of enumerable and serialized configuration', () => {
    const config = loadConfig({ JWT_SECRET: 'a'.repeat(64) });
    assert.equal(Object.keys(config.jwt).includes('secret'), false);
    assert.equal(JSON.stringify(config).includes('a'.repeat(64)), false);
    assert.equal(config.jwt.secret, 'a'.repeat(64));
  });

  it('rejects JWT secrets shorter than 32 characters', () => {
    assert.throws(
      () => loadConfig({ JWT_SECRET: 'a'.repeat(31) }),
      /JWT_SECRET must contain at least 32 characters/,
    );
  });

  it('rejects JWT secrets with leading or trailing whitespace', () => {
    for (const secret of [' ' + 'a'.repeat(32), 'a'.repeat(32) + ' ']) {
      assert.throws(
        () => loadConfig({ JWT_SECRET: secret }),
        /JWT_SECRET must contain at least 32 characters and have no leading or trailing whitespace/,
      );
    }
  });

  it('rejects invalid JWT expiry formats', () => {
    for (const expiresIn of ['0m', '-1m', '15', '1w', '1.5h', '15M', ' 15m']) {
      assert.throws(
        () => loadConfig({ JWT_EXPIRES_IN: expiresIn }),
        /JWT_EXPIRES_IN must be a positive integer followed by s, m, h, or d/,
        expiresIn,
      );
    }
  });

  it('uses defaults for empty optional JWT settings and rejects whitespace-padded identifiers', () => {
    const defaults = loadConfig({ JWT_EXPIRES_IN: '', JWT_ISSUER: '', JWT_AUDIENCE: '' });
    assert.equal(defaults.jwt.expiresIn, '15m');
    assert.equal(defaults.jwt.issuer, 'book-my-seat');
    assert.equal(defaults.jwt.audience, 'book-my-seat-client');
    assert.throws(() => loadConfig({ JWT_ISSUER: ' issuer' }), /JWT_ISSUER must be a non-empty string/);
    assert.throws(() => loadConfig({ JWT_AUDIENCE: 'audience ' }), /JWT_AUDIENCE must be a non-empty string/);
  });
});
