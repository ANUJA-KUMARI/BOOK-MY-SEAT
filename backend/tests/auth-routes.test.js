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

let server;
let baseUrl;

before(async () => {
  server = await listen(app);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await closePool();
});

describe('protected authentication endpoints', () => {
  it('GET /api/auth/me rejects requests without an access cookie', async () => {
    const response = await fetch(`${baseUrl}/api/auth/me`);
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.success, false);
    assert.match(body.error.message, /Authentication is required/);
  });

  it('POST /api/auth/logout rejects requests without an access cookie', async () => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { origin: baseUrl },
    });
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.success, false);
  });

  it('POST /api/auth/logout rejects cross-origin requests before authentication', async () => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { origin: 'https://attacker.example' },
    });
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.equal(body.success, false);
  });
});
