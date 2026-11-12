process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const authService = require('../services/auth.service');
const catalogService = require('../services/admin-catalog.service');
const { config } = require('../config/env');
const { signAccessToken } = require('../utils/jwt');
const { closePool } = require('../config/db');

function listen(application) {
  return new Promise((resolve) => {
    const server = application.listen(0, '127.0.0.1', () => resolve(server));
  });
}
let server;
let base;
let originals;
before(async () => {
  originals = {
    findUserById: authService.findUserById,
    listMovies: catalogService.listMovies,
    createMovie: catalogService.createMovie,
  };
  authService.findUserById = async (id) => {
    if (id === 701) return { id, name: 'Admin Test', email: 'admin.test@example.com', role: 'ADMIN' };
    if (id === 702) return { id, name: 'User Test', email: 'user.test@example.com', role: 'USER' };
    if (id === 703) return { id, name: 'Demoted Admin', email: 'demoted@example.com', role: 'USER' };
    return null;
  };
  catalogService.listMovies = async () => [{ id: 1, title: 'Test Movie', is_active: true, genres: [] }];
  catalogService.createMovie = async (movie) => ({ id: 2, ...movie, is_active: true, genres: [] });
  server = await listen(app);
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  authService.findUserById = originals.findUserById;
  catalogService.listMovies = originals.listMovies;
  catalogService.createMovie = originals.createMovie;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await closePool();
});
function session(id, role, csrf = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef') {
  const token = signAccessToken({ id, role });
  return { cookie: 'bms_token=' + token + '; bms_csrf=' + csrf, csrf };
}
async function call(path, options = {}) {
  const response = await fetch(base + path, {
    method: options.method || 'GET',
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.csrf ? { 'x-csrf-token': options.csrf } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.mutate ? { origin: base } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  return { response, body: await response.json() };
}
describe('Phase 8 admin catalogue authorization', { skip: !config.jwt.secret }, () => {
  it('rejects requests without a login session', async () => {
    const result = await call('/api/admin/movies');
    assert.equal(result.response.status, 401);
  });
  it('rejects a normal USER account', async () => {
    const user = session(702, 'USER');
    const result = await call('/api/admin/movies', { cookie: user.cookie });
    assert.equal(result.response.status, 403);
  });
  it('uses the current database role, not a stale ADMIN claim in the JWT', async () => {
    const oldAdminToken = session(703, 'ADMIN');
    const result = await call('/api/admin/movies', { cookie: oldAdminToken.cookie });
    assert.equal(result.response.status, 403);
  });
  it('allows an ADMIN to read the movie catalogue', async () => {
    const admin = session(701, 'ADMIN');
    const result = await call('/api/admin/movies', { cookie: admin.cookie });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.data[0].title, 'Test Movie');
  });
  it('requires a valid same-origin CSRF token for admin mutations', async () => {
    const admin = session(701, 'ADMIN');
    const missingCsrf = await call('/api/admin/movies', {
      method: 'POST', cookie: admin.cookie, mutate: true,
      body: { title: 'New Film', duration_min: 120, genre_ids: [] },
    });
    assert.equal(missingCsrf.response.status, 403);
    const accepted = await call('/api/admin/movies', {
      method: 'POST', cookie: admin.cookie, csrf: admin.csrf, mutate: true,
      body: { title: 'New Film', duration_min: 120, genre_ids: [] },
    });
    assert.equal(accepted.response.status, 201);
    assert.equal(accepted.body.data.movie.title, 'New Film');
  });
});
