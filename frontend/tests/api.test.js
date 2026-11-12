import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, getMovies, getMovie, getMovieShows } from '../js/api.js';

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
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
