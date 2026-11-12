import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, getMovies, getMovie, getMovieShows, getShowSeats, createBooking, getUserBookings, getUserBooking } from '../js/api.js';

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


test('getShowSeats loads database-backed availability for the selected show', async () => {
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = url;
    return {
      ok: true, status: 200,
      json: async () => ({ success: true, data: { show: { id: 1301 }, prices: { STANDARD: 260 }, seats: [{ id: 1, is_available: true }] } }),
    };
  };
  const data = await getShowSeats('1301');
  assert.equal(requestedUrl, '/api/shows/1301/seats');
  assert.equal(data.seats[0].is_available, true);
});

test('createBooking posts selected IDs with same-origin credentials and CSRF header', async () => {
  globalThis.document = { cookie: 'bms_csrf=csrf-456' };
  let call;
  globalThis.fetch = async (url, options) => {
    call = { url, options };
    return { ok: true, status: 201, json: async () => ({ success: true, data: { booking: { id: 9 } } }) };
  };
  const result = await createBooking({ showId: 1301, seatIds: [4, 5] });
  assert.equal(call.url, '/api/bookings');
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.credentials, 'same-origin');
  assert.equal(call.options.headers['x-csrf-token'], 'csrf-456');
  assert.deepEqual(JSON.parse(call.options.body), { showId: 1301, seatIds: [4, 5] });
  assert.equal(result.booking.id, 9);
});

test('createBooking rejects invalid seat counts and missing CSRF before fetch', async () => {
  globalThis.document = { cookie: '' };
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; };
  await assert.rejects(createBooking({ showId: 1301, seatIds: [] }), (error) => error instanceof ApiError && error.status === 400);
  await assert.rejects(createBooking({ showId: 1301, seatIds: [1] }), (error) => error instanceof ApiError && error.status === 403);
  assert.equal(calls, 0);
});


test('getUserBookings requests the authenticated paginated booking history', async () => {
  let call;
  globalThis.fetch = async (url, options) => {
    call = { url, options };
    return { ok: true, status: 200, json: async () => ({ success: true, data: { bookings: [{ id: 9 }], pagination: { page: 2, limit: 10, total: 11, total_pages: 2 } } }) };
  };
  const result = await getUserBookings({ page: 2, limit: 10 });
  assert.equal(call.url, '/api/bookings?page=2&limit=10');
  assert.equal(call.options.credentials, 'same-origin');
  assert.equal(result.bookings[0].id, 9);
  assert.equal(result.pagination.total_pages, 2);
});

test('getUserBookings rejects invalid pagination before network access', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; };
  await assert.rejects(getUserBookings({ page: 0 }), (error) => error instanceof ApiError && error.status === 400);
  await assert.rejects(getUserBookings({ page: 1, limit: 51 }), (error) => error instanceof ApiError && error.status === 400);
  assert.equal(calls, 0);
});

test('getUserBooking requests the selected booking detail with same-origin credentials', async () => {
  let call;
  globalThis.fetch = async (url, options) => {
    call = { url, options };
    return { ok: true, status: 200, json: async () => ({ success: true, data: { booking: { id: 9, booking_ref: 'BMS-TEST' } } }) };
  };
  const result = await getUserBooking('9');
  assert.equal(call.url, '/api/bookings/9');
  assert.equal(call.options.credentials, 'same-origin');
  assert.equal(result.booking.booking_ref, 'BMS-TEST');
});

test('getUserBooking rejects malformed IDs before network access', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; };
  await assert.rejects(getUserBooking('abc'), (error) => error instanceof ApiError && error.status === 400);
  assert.equal(calls, 0);
});


test('admin show API reads, creates, reprices and changes show status with CSRF', async () => {
  globalThis.document = { cookie: 'bms_csrf=csrf-stage-five' };
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: options.method === 'POST' ? 201 : 200,
      json: async () => ({ success: true, data: { shows: [], show: { id: 7 } } }) };
  };
  const api = await import('../js/api.js');
  await api.getAdminShows();
  await api.createAdminShow({ movie_id: 2, screen_id: 4 });
  await api.updateAdminShowPrices(7, { STANDARD: 200, PREMIUM: 300, RECLINER: 500 });
  await api.updateAdminShowStatus(7, 'CANCELLED');
  assert.deepEqual(calls.map(x => x.url), ['/api/admin/shows','/api/admin/shows','/api/admin/shows/7/prices','/api/admin/shows/7/status']);
  assert.equal(calls[1].options.headers['x-csrf-token'], 'csrf-stage-five');
  assert.equal(calls[2].options.method, 'PATCH');
  assert.equal(calls[3].options.method, 'PATCH');
});
