process.env.NODE_ENV = 'test';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const authController = require('../controllers/auth.controller');
const {
  CSRF_COOKIE,
  cookieOptions,
  requireSameOrigin,
  requireCsrf,
} = require('../middleware/csrf');
const { config } = require('../config/env');

function responseRecorder() {
  return {
    cookies: [],
    cleared: [],
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
    clearCookie(name, options) {
      this.cleared.push({ name, options });
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('Stage 5 — CSRF and logout security controls', () => {
  it('sets CSRF cookie attributes suitable for the double-submit pattern', () => {
    const options = cookieOptions();
    assert.equal(CSRF_COOKIE, 'bms_csrf');
    assert.equal(options.httpOnly, false);
    assert.equal(options.secure, config.isProduction);
    assert.equal(options.sameSite, 'lax');
    assert.equal(options.path, '/');
    assert.equal(options.maxAge, 15 * 60 * 1000);
  });

  it('rejects missing, unequal-length and mismatched CSRF tokens', () => {
    const cases = [
      { cookies: {}, header: undefined },
      { cookies: { bms_csrf: 'abc' }, header: 'ab' },
      { cookies: { bms_csrf: 'a'.repeat(64) }, header: 'b'.repeat(64) },
    ];

    for (const item of cases) {
      let error;
      requireCsrf(
        { cookies: item.cookies, get: () => item.header },
        {},
        (value) => { error = value; },
      );
      assert.equal(error.status, 403);
    }
  });

  it('accepts only matching same-origin protocol, host and port', () => {
    const valid = {
      secure: false,
      get(name) {
        return name === 'origin' ? 'http://localhost:3000' : 'localhost:3000';
      },
    };
    let allowed = false;
    requireSameOrigin(valid, {}, (error) => { assert.equal(error, undefined); allowed = true; });
    assert.equal(allowed, true);

    const wrongProtocol = {
      secure: false,
      get(name) {
        return name === 'origin' ? 'https://localhost:3000' : 'localhost:3000';
      },
    };
    let error;
    requireSameOrigin(wrongProtocol, {}, (value) => { error = value; });
    assert.equal(error.status, 403);
  });

  it('logout clears both authentication and CSRF cookies with matching scope/security attributes', async () => {
    const res = responseRecorder();
    await authController.logout({}, res);

    assert.deepEqual(res.cleared.map((entry) => entry.name).sort(), ['bms_csrf', 'bms_token']);
    for (const entry of res.cleared) {
      assert.equal(entry.options.path, '/');
      assert.equal(entry.options.sameSite, 'lax');
      assert.equal(entry.options.secure, config.isProduction);
    }
    assert.equal(res.body.success, true);
  });
});
