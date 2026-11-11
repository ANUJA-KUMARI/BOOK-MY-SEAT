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

async function post(path, payload) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: baseUrl },
    body: JSON.stringify(payload),
  });
}

describe('Stage 5 — authentication abuse controls', () => {
  it('limits login attempts to five per 15-minute window', async () => {
    const statuses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await post('/api/auth/login', {});
      statuses.push(response.status);
      await response.arrayBuffer();
    }

    assert.deepEqual(statuses, [400, 400, 400, 400, 400, 429]);
  });

  it('limits registration attempts to five per one-hour window', async () => {
    const statuses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await post('/api/auth/register', {});
      statuses.push(response.status);
      await response.arrayBuffer();
    }

    assert.deepEqual(statuses, [400, 400, 400, 400, 400, 429]);
  });
});
