import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, loginUser, registerUser, getCurrentUser, logoutUser } from '../js/api.js';

const originalFetch = globalThis.fetch;
const originalDocument = globalThis.document;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
});

test('registerUser posts only registration fields to the same-origin API', async () => {
  let call;
  globalThis.fetch = async (url, options) => {
    call = { url, options };
    return { ok: true, status: 201, json: async () => ({ success: true, data: { user: { id: 2 } } }) };
  };
  const data = await registerUser({ name: 'Test User', email: 'test@example.com', password: 'StrongPass123!' });
  assert.equal(call.url, '/api/auth/register');
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.credentials, 'same-origin');
  assert.equal(call.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(call.options.body), {
    name: 'Test User', email: 'test@example.com', password: 'StrongPass123!',
  });
  assert.equal(data.user.id, 2);
});

test('loginUser posts credentials and accepts the backend session-cookie response', async () => {
  let call;
  globalThis.fetch = async (url, options) => {
    call = { url, options };
    return { ok: true, status: 200, json: async () => ({ success: true, data: { user: { id: 1, role: 'USER' } } }) };
  };
  const data = await loginUser({ email: 'test@example.com', password: 'StrongPass123!' });
  assert.equal(call.url, '/api/auth/login');
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.credentials, 'same-origin');
  assert.equal(data.user.role, 'USER');
});

test('getCurrentUser returns null for an unauthenticated session', async () => {
  globalThis.fetch = async () => ({
    ok: false, status: 401,
    json: async () => ({ success: false, error: { message: 'Authentication is required.' } }),
  });
  assert.equal(await getCurrentUser(), null);
});

test('getCurrentUser returns the authenticated user', async () => {
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    json: async () => ({ success: true, data: { user: { id: 1, name: 'Test User' } } }),
  });
  assert.deepEqual(await getCurrentUser(), { id: 1, name: 'Test User' });
});

test('logoutUser sends the CSRF cookie value in the required header', async () => {
  globalThis.document = { cookie: 'other=x; bms_csrf=csrf-token-123' };
  let call;
  globalThis.fetch = async (url, options) => {
    call = { url, options };
    return { ok: true, status: 200, json: async () => ({ success: true, data: { message: 'You have been logged out.' } }) };
  };
  await logoutUser();
  assert.equal(call.url, '/api/auth/logout');
  assert.equal(call.options.headers['x-csrf-token'], 'csrf-token-123');
  assert.equal(call.options.credentials, 'same-origin');
});

test('logoutUser fails safely when the CSRF cookie is missing', async () => {
  globalThis.document = { cookie: '' };
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; };
  await assert.rejects(logoutUser(), (error) => error instanceof ApiError && error.status === 403);
  assert.equal(calls, 0);
});
