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

async function postLogin(payload) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: baseUrl },
    body: JSON.stringify(payload),
  });
  return { response, body: await response.json() };
}

describe('POST /api/auth/login validation', () => {
  it('rejects missing credentials with field-specific errors', async () => {
    const { response, body } = await postLogin({});
    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.ok(body.error.details.email);
    assert.ok(body.error.details.password);
    assert.equal(response.headers.get('set-cookie'), null);
  });

  it('rejects malformed email and empty password before database access', async () => {
    const { response, body } = await postLogin({
      email: 'not-an-email',
      password: '',
    });
    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.ok(body.error.details.email);
    assert.ok(body.error.details.password);
    assert.equal(response.headers.get('set-cookie'), null);
  });

  it('does not disclose submitted passwords in validation errors', async () => {
    const password = 'sensitive-password';
    const { response, body } = await postLogin({
      email: 'invalid',
      password,
    });
    assert.equal(response.status, 400);
    assert.equal(JSON.stringify(body).includes(password), false);
    assert.equal(response.headers.get('set-cookie'), null);
  });
});
