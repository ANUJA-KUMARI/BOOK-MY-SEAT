import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, getMovies, getMovie, getMovieShows, getShowSeats, registerUser, loginUser, getCurrentUser, logoutUser } from '../js/api.js';

const originalFetch = globalThis.fetch;
const originalDocument = globalThis.document;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
});

test('getMovies requests the live API with encoded filters and same-origin credentials', async () => {
  let requestedUrl;
  let requestedOptions;
  globalThis.fetch = async (url, options) => {
    requestedUrl = url;
    requestedOptions = options;
    return { ok: true, status: 200, json: async () => ({ success: true, data: [{ id: 1, title: 'Live movie' }] }) };
  };

  const result = await getMovies({ search: '  Monsoon  ', genre: 'Drama & Romance', language: 'Hindi' });
  assert.deepEqual(result, [{ id: 1, title: 'Live movie' }]);
  assert.equal(requestedUrl, '/api/movies?search=Monsoon&genre=Drama+%26+Romance&language=Hindi');
  assert.equal(requestedOptions.credentials, 'same-origin');
  assert.equal(requestedOptions.headers.Accept, 'application/json');
});

test('getMovie requests the selected database movie id', async () => {
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = url;
    return { ok: true, status: 200, json: async () => ({ success: true, data: { id: 12, title: 'Database movie' } }) };
  };
  assert.deepEqual(await getMovie('12'), { id: 12, title: 'Database movie' });
  assert.equal(requestedUrl, '/api/movies/12');
});

test('getMovieShows requests upcoming shows and optional India-calendar date', async () => {
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = url;
    return { ok: true, status: 200, json: async () => ({ success: true, data: [{ id: 1301, movie_id: 1, prices: { STANDARD: 260 } }] }) };
  };
  const result = await getMovieShows(1, { date: '2026-11-12' });
  assert.equal(requestedUrl, '/api/movies/1/shows?date=2026-11-12');
  assert.equal(result[0].id, 1301);
});

test('invalid ids and dates are rejected before making a network request', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('fetch should not run'); };
  await assert.rejects(getMovie(0), (error) => error instanceof ApiError && error.status === 400);
  await assert.rejects(getMovieShows(1, { date: '12-11-2026' }), (error) => error instanceof ApiError && error.status === 400);
  assert.equal(calls, 0);
});

test('API errors preserve the server status and message', async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    json: async () => ({ success: false, error: { message: 'Movie not found.' } }),
  });
  await assert.rejects(getMovie(9999), (error) => error instanceof ApiError
    && error.status === 404 && error.message === 'Movie not found.');
});

test('getShowSeats requests authoritative availability for a validated show id', async () => {
  let url; let options;
  globalThis.fetch = async (requestedUrl, requestedOptions) => {
    url = requestedUrl; options = requestedOptions;
    return {
      ok: true, status: 200,
      json: async () => ({ success: true, data: {
        show: { id: 1301, movie_id: 1, movie_title: 'Midnight Monsoon' },
        prices: { STANDARD: 260, PREMIUM: 340, RECLINER: 500 },
        seats: [{ id: 2101, row_label: 'A', seat_number: 1, category: 'STANDARD', is_available: true, status: 'AVAILABLE' }],
        summary: { total: 1, available: 1, booked: 0 },
      } }),
    };
  };
  const result = await getShowSeats('1301');
  assert.equal(url, '/api/shows/1301/seats');
  assert.equal(options.credentials, 'same-origin');
  assert.equal(result.seats[0].is_available, true);
  assert.equal(result.prices.STANDARD, 260);
});

test('getShowSeats rejects invalid show ids before making a network request', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; };
  await assert.rejects(getShowSeats(0), (error) => error instanceof ApiError && error.status === 400);
  assert.equal(calls, 0);
});

test('registerUser posts registration fields to the live auth API', async () => {
  let url; let options;
  globalThis.fetch = async (requestedUrl, requestedOptions) => {
    url = requestedUrl; options = requestedOptions;
    return { ok: true, status: 201, json: async () => ({ success: true, data: { user: { id: 8, name: 'Test User' } } }) };
  };
  const result = await registerUser({ name: 'Test User', email: 'test@example.com', password: 'safe-password' });
  assert.equal(url, '/api/auth/register');
  assert.equal(options.method, 'POST');
  assert.equal(options.credentials, 'same-origin');
  assert.equal(options.headers.Accept, 'application/json');
  assert.equal(options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(options.body), { name: 'Test User', email: 'test@example.com', password: 'safe-password' });
  assert.equal(result.user.id, 8);
});

test('loginUser posts credentials and relies on same-origin session cookies', async () => {
  let options;
  globalThis.fetch = async (_url, requestedOptions) => {
    options = requestedOptions;
    return { ok: true, status: 200, json: async () => ({ success: true, data: { user: { id: 8 } } }) };
  };
  const result = await loginUser({ email: 'test@example.com', password: 'safe-password' });
  assert.equal(options.method, 'POST');
  assert.equal(options.credentials, 'same-origin');
  assert.equal(options.headers.Accept, 'application/json');
  assert.equal(JSON.parse(options.body).email, 'test@example.com');
  assert.equal(result.user.id, 8);
});

test('getCurrentUser reads the authenticated session endpoint', async () => {
  let url; let options;
  globalThis.fetch = async (requestedUrl, requestedOptions) => {
    url = requestedUrl; options = requestedOptions;
    return { ok: true, status: 200, json: async () => ({ success: true, data: { user: { id: 8, role: 'USER' } } }) };
  };
  const result = await getCurrentUser();
  assert.equal(url, '/api/auth/me');
  assert.equal(options.method, undefined);
  assert.equal(options.credentials, 'same-origin');
  assert.equal(result.user.role, 'USER');
});

test('logoutUser sends the readable double-submit CSRF cookie as a request header', async () => {
  globalThis.document = { cookie: 'theme=dark; bms_csrf=csrf-token-123' };
  let url; let options;
  globalThis.fetch = async (requestedUrl, requestedOptions) => {
    url = requestedUrl; options = requestedOptions;
    return { ok: true, status: 200, json: async () => ({ success: true, data: { message: 'You have been logged out.' } }) };
  };
  await logoutUser();
  assert.equal(url, '/api/auth/logout');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers['x-csrf-token'], 'csrf-token-123');
  assert.equal(options.credentials, 'same-origin');
});

test('logoutUser refuses to send a request when the CSRF cookie is missing', async () => {
  globalThis.document = { cookie: '' };
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; };
  await assert.rejects(logoutUser(), (error) => error instanceof ApiError && error.status === 403);
  assert.equal(calls, 0);
});
