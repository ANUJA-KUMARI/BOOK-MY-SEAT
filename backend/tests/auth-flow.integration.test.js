process.env.NODE_ENV = 'test';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const authService = require('../services/auth.service');
const { config } = require('../config/env');
const { closePool } = require('../config/db');

const testUser = {
  id: 987654,
  name: 'Integration Test User',
  email: 'integration.user@example.com',
  role: 'USER',
};

function listen(application) {
  return new Promise((resolve) => {
    const server = application.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function cookiesFrom(response) {
  const headers = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie') || ''];
  return headers.filter(Boolean).map((value) => value.split(';', 1)[0]);
}

let server;
let baseUrl;
let originals;

before(async () => {
  originals = {
    registerUser: authService.registerUser,
    loginUser: authService.loginUser,
    findUserById: authService.findUserById,
  };
  authService.registerUser = async ({ name, email }) => ({
    ...testUser,
    name: name.trim(),
    email: email.trim().toLowerCase(),
  });
  authService.loginUser = async () => ({ ...testUser });
  authService.findUserById = async (id) => (id === testUser.id ? { ...testUser } : null);

  server = await listen(app);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  authService.registerUser = originals.registerUser;
  authService.loginUser = originals.loginUser;
  authService.findUserById = originals.findUserById;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await closePool();
});

async function request(path, { method = 'GET', body, cookie, csrf } = {}) {
  const headers = { origin: baseUrl };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  if (csrf) headers['x-csrf-token'] = csrf;
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe('Stage 6 — end-to-end authentication flow', () => {
  it('completes register → login → current user → CSRF-protected logout', {
    skip: !config.jwt.secret,
  }, async () => {
    const registration = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: testUser.name,
        email: testUser.email,
        password: 'valid-password-123',
        role: 'ADMIN',
      },
    });
    const registrationBody = await registration.json();

    assert.equal(registration.status, 201);
    assert.equal(registrationBody.success, true);
    assert.equal(registrationBody.data.user.role, 'USER');
    assert.equal(JSON.stringify(registrationBody).includes('password_hash'), false);
    assert.equal(registration.headers.get('set-cookie'), null);

    const login = await request('/api/auth/login', {
      method: 'POST',
      body: { email: testUser.email, password: 'valid-password-123' },
    });
    const loginBody = await login.json();
    const issuedCookies = cookiesFrom(login);
    const authCookie = issuedCookies.find((value) => value.startsWith('bms_token='));
    const csrfCookie = issuedCookies.find((value) => value.startsWith('bms_csrf='));

    assert.equal(login.status, 200);
    assert.equal(loginBody.success, true);
    assert.equal(loginBody.data.user.role, 'USER');
    assert.ok(authCookie);
    assert.ok(csrfCookie);
    assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
    assert.match(login.headers.get('set-cookie'), /SameSite=Lax/i);

    const sessionCookie = [authCookie, csrfCookie].join('; ');
    const me = await request('/api/auth/me', { cookie: sessionCookie });
    const meBody = await me.json();

    assert.equal(me.status, 200);
    assert.deepEqual(meBody.data.user, testUser);
    assert.equal(JSON.stringify(meBody).includes('password_hash'), false);

    const csrfToken = csrfCookie.slice('bms_csrf='.length);
    const logout = await request('/api/auth/logout', {
      method: 'POST',
      cookie: sessionCookie,
      csrf: csrfToken,
    });
    const logoutBody = await logout.json();
    const clearedCookies = typeof logout.headers.getSetCookie === 'function'
      ? logout.headers.getSetCookie()
      : [logout.headers.get('set-cookie') || ''];

    assert.equal(logout.status, 200);
    assert.equal(logoutBody.success, true);
    assert.ok(clearedCookies.some((value) => /^bms_token=;/i.test(value)));
    assert.ok(clearedCookies.some((value) => /^bms_csrf=;/i.test(value)));

    const afterLogout = await request('/api/auth/me');
    assert.equal(afterLogout.status, 401);
  });
});
