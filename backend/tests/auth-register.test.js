process.env.NODE_ENV = 'test';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const { closePool } = require('../config/db');

function listen(application) {
  return new Promise((resolve) => {
    const server = application.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function stop(server) {
  return new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  });
}

let server;
let baseUrl;

before(async () => {
  server = await listen(app);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await stop(server);
  await closePool();
});

async function postRegistration(payload) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: baseUrl },
    body: JSON.stringify(payload),
  });
  return { response, body: await response.json() };
}

describe('POST /api/auth/register validation', () => {
  it('rejects a missing or non-object body without touching the database', async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'null',
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.ok(body.error.details);
  });

  it('returns field-specific errors for invalid registration details', async () => {
    const { response, body } = await postRegistration({
      name: '',
      email: 'not-an-email',
      password: 'short',
      role: 'ADMIN',
    });
    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.deepEqual(Object.keys(body.error.details).sort(), ['email', 'name', 'password']);
  });

  it('rejects an invalid email and a password shorter than the required minimum', async () => {
    const { response, body } = await postRegistration({
      name: 'Test User',
      email: 'bad-email',
      password: '123',
    });
    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.ok(body.error.details.email);
    assert.ok(body.error.details.password);
  });
});
