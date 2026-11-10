// Automated API tests. Run from the backend folder with:  npm test
// They start the real Express app on a random free port and call it with fetch (built into Node 22).
// No database or extra test library is needed in Phase 3.

process.env.NODE_ENV = 'test'; // must be set before the app is loaded (silences logging, see config/env.js)

const fs = require('node:fs');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const app = require('../app');
const errorHandler = require('../middleware/errorHandler');
const { loadConfig, config } = require('../config/env');
const { closePool } = require('../config/db');
const { dbSkipReason } = require('./helpers/db-skip');

// ---------- helpers ----------
function listen(application) {
  return new Promise((resolve) => {
    const server = application.listen(0, '127.0.0.1', () => resolve(server));
  });
}
const baseUrl = (server) => `http://127.0.0.1:${server.address().port}`;
const stop = (server) => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); });

let server;
let base;
async function call(path, options) {
  const res = await fetch(base + path, options);
  const type = res.headers.get('content-type') || '';
  const body = type.includes('json') ? await res.json() : await res.text();
  return { res, body };
}

before(async () => { server = await listen(app); base = baseUrl(server); });
after(async () => { await stop(server); await closePool(); }); // closing the MySQL pool lets the test process exit

function assertError(result, status) {
  assert.equal(result.res.status, status);
  assert.equal(result.body.success, false);
  assert.equal(typeof result.body.error.message, 'string');
  assert.ok(result.body.error.message.length > 0);
}

// ---------- tests ----------
describe('health', () => {
  it('GET /api/health returns ok in the standard format', async () => {
    const { res, body } = await call('/api/health');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'ok');
    assert.equal(typeof body.data.uptime_seconds, 'number');
  });
});

// Input validation happens before the database is used, so these run even without MySQL.
describe('GET /api/movies input validation', () => {
  it('rejects repeated or oversized filters with 400', async () => {
    assertError(await call('/api/movies?search=a&search=b'), 400);
    assertError(await call(`/api/movies?search=${'x'.repeat(101)}`), 400);
    assertError(await call(`/api/movies?genre=${'x'.repeat(51)}`), 400);
  });
});

// These tests read the movies from MySQL, so they are skipped when there are no DB credentials (see tests/helpers/db-skip.js).
describe('GET /api/movies', { skip: dbSkipReason }, () => {
  it('returns all 9 movies with the fields the frontend uses', async () => {
    const { res, body } = await call('/api/movies');
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 9);
    for (const m of body.data) {
      for (const key of ['id', 'title', 'description', 'language', 'duration_min', 'certificate', 'release_date', 'poster_url', 'genres']) {
        assert.ok(key in m, `movie ${m.id} has ${key}`);
      }
      assert.ok(Array.isArray(m.genres));
    }
  });

  it('filters by search (case-insensitive), genre and language, and combinations', async () => {
    assert.equal((await call('/api/movies?search=monsoon')).body.data.length, 1);
    assert.equal((await call('/api/movies?search=MONSOON')).body.data.length, 1);
    assert.equal((await call('/api/movies?search=zzzz')).body.data.length, 0);
    const drama = (await call('/api/movies?genre=drama')).body.data;
    assert.ok(drama.length >= 3 && drama.every((m) => m.genres.includes('Drama')));
    const tamil = (await call('/api/movies?language=Tamil')).body.data;
    assert.deepEqual(tamil.map((m) => m.title), ['Kaveri Express']);
    const both = (await call('/api/movies?genre=Drama&language=Hindi')).body.data;
    assert.ok(both.length >= 1 && both.every((m) => m.language === 'Hindi' && m.genres.includes('Drama')));
  });

  it('treats SQL-looking input as plain text (no results, no error)', async () => {
    const { res, body } = await call(`/api/movies?search=${encodeURIComponent("' OR 1=1 --")}`);
    assert.equal(res.status, 200);
    assert.equal(body.data.length, 0);
  });

  it('keeps numbers as numbers, uses plain-text dates, an empty poster_url and alphabetical genres', async () => {
    const { body } = await call('/api/movies');
    for (const m of body.data) {
      assert.equal(typeof m.id, 'number');
      assert.equal(typeof m.duration_min, 'number');
      assert.match(m.release_date, /^\d{4}-\d{2}-\d{2}$/);
      assert.strictEqual(m.poster_url, '');
      assert.deepEqual(m.genres, [...m.genres].sort());
    }
    assert.deepEqual(body.data.map((m) => m.id), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('a genre filter still returns every genre of each movie, and "%" does not act as a wildcard', async () => {
    const thriller = (await call('/api/movies?genre=thriller')).body.data;
    assert.deepEqual(thriller.map((m) => m.id), [2, 3, 7]);
    assert.deepEqual(thriller.find((m) => m.id === 2).genres, ['Drama', 'Thriller']);
    assert.deepEqual((await call('/api/movies?search=%25')).body.data, []);
  });
});

// The id is validated before the database is used, so these run even without MySQL.
describe('GET /api/movies/:id input validation', () => {
  it('returns 400 for ids that are not positive whole numbers', async () => {
    for (const bad of ['abc', '0', '-1', '1.5', '1e3', '07', '99999999999999999999', '%20', '1%20OR%201']) {
      assertError(await call(`/api/movies/${bad}`), 400);
    }
  });
});

// These tests read the movie from MySQL, so they are skipped when there are no DB credentials (see tests/helpers/db-skip.js).
describe('GET /api/movies/:id', { skip: dbSkipReason }, () => {
  it('returns one movie', async () => {
    const { res, body } = await call('/api/movies/1');
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.id, 1);
    assert.equal(body.data.title, 'Midnight Monsoon');
  });

  it('returns exactly the same object as the movie list, for every movie (all genres included)', async () => {
    const list = (await call('/api/movies')).body.data;
    assert.equal(list.length, 9);
    for (const movie of list) {
      const { res, body } = await call(`/api/movies/${movie.id}`);
      assert.equal(res.status, 200, `movie ${movie.id}`);
      assert.deepEqual(body.data, movie, `movie ${movie.id}`);
    }
  });

  it('keeps the property names and types, and lists every genre alphabetically', async () => {
    const { body } = await call('/api/movies/2');
    assert.deepEqual(Object.keys(body.data).sort(), ['certificate', 'description', 'duration_min', 'genres', 'id', 'language', 'poster_url', 'release_date', 'title']);
    assert.strictEqual(typeof body.data.id, 'number');
    assert.strictEqual(body.data.duration_min, 124);
    assert.strictEqual(body.data.release_date, '2026-10-16');
    assert.strictEqual(body.data.poster_url, '');
    assert.deepEqual(body.data.genres, ['Drama', 'Thriller']);
  });

  it('returns the standard 404 for a movie that does not exist', async () => {
    for (const id of ['10', '999', '4294967297', '9999999999']) {
      const result = await call(`/api/movies/${id}`);
      assertError(result, 404);
      assert.deepEqual(result.body, { success: false, error: { message: 'Movie not found.' } });
    }
  });

  it('treats SQL-looking text in the URL as an invalid id (400), never as SQL', async () => {
    assertError(await call(`/api/movies/${encodeURIComponent("1; DROP TABLE movies")}`), 400);
    assertError(await call(`/api/movies/${encodeURIComponent("1' OR '1'='1")}`), 400);
    assert.equal((await call('/api/movies')).body.data.length, 9);
  });
});

// Id and date are validated before the database is used, so these run even without MySQL.
describe('GET /api/movies/:id/shows input validation', () => {
  it('rejects bad dates, a repeated date and a bad id with 400', async () => {
    for (const bad of ['30-10-2026', '2026-13-01', '2026-02-31', 'tomorrow', '2026-1-1']) {
      assertError(await call(`/api/movies/1/shows?date=${bad}`), 400);
    }
    assertError(await call('/api/movies/1/shows?date=2026-10-30&date=2026-10-31'), 400);
    assertError(await call('/api/movies/abc/shows'), 400);
    assertError(await call('/api/movies/0/shows'), 400);
    assertError(await call('/api/movies/999/shows?date=2026-02-31'), 400); // validated before the movie is looked up
  });
});

// These tests read the shows from MySQL, so they are skipped when there are no DB credentials (see tests/helpers/db-skip.js).
describe('GET /api/movies/:id/shows', { skip: dbSkipReason }, () => {
  it('returns upcoming shows, earliest first, with cinema, screen and prices (all numbers)', async () => {
    const { res, body } = await call('/api/movies/1/shows');
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.length > 0, 'no upcoming shows: run database/seed.sql again (it creates shows for 5 days)');
    const now = Date.now();
    body.data.forEach((s, i) => {
      assert.deepEqual(Object.keys(s), ['id', 'movie_id', 'start_time', 'status', 'cinema', 'screen', 'prices']);
      assert.equal(s.movie_id, 1);
      assert.equal(s.status, 'SCHEDULED');
      assert.ok(new Date(s.start_time).getTime() > now, 'only future shows');
      if (i > 0) assert.ok(new Date(body.data[i - 1].start_time) <= new Date(s.start_time), 'sorted');
      assert.ok(s.cinema.name && s.screen.name);
      for (const value of [s.id, s.movie_id, s.cinema.id, s.screen.id, s.prices.STANDARD, s.prices.PREMIUM, s.prices.RECLINER]) assert.strictEqual(typeof value, 'number');
      assert.match(s.start_time, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/);
    });
    assert.equal(new Set(body.data.map((s) => s.id)).size, body.data.length, 'unique show ids');
  });

  it('uses the cinema-specific prices (Aurora, Lotus, Starline) for every show of every movie', async () => {
    const expected = {
      'Aurora Cinemas': { STANDARD: 220, PREMIUM: 320, RECLINER: 520 },
      'Lotus Multiplex': { STANDARD: 260, PREMIUM: 380, RECLINER: 620 },
      'Starline Screens': { STANDARD: 200, PREMIUM: 290, RECLINER: 470 },
    };
    const seen = new Set();
    for (let id = 1; id <= 9; id += 1) {
      for (const s of (await call(`/api/movies/${id}/shows`)).body.data) {
        assert.deepEqual(s.prices, expected[s.cinema.name], `${s.cinema.name} show ${s.id}`);
        assert.equal(Math.floor(s.id / 1000), id);
        seen.add(s.cinema.name);
      }
    }
    assert.equal(seen.size, 3);
  });

  it('show times are UTC: in India time they land exactly on the five show slots', async () => {
    const slots = ['10:30', '13:45', '17:00', '20:15', '22:45'];
    for (const s of (await call('/api/movies/3/shows')).body.data) {
      const india = new Date(new Date(s.start_time).getTime() + 330 * 60000).toISOString().slice(11, 16);
      assert.ok(slots.includes(india), `${s.start_time} -> ${india}`);
    }
  });

  it('filters by an INDIA calendar day and returns only that day', async () => {
    const indiaDay = (ms) => new Date(ms + 330 * 60000).toISOString().slice(0, 10);
    const key = indiaDay(Date.now() + 24 * 3600 * 1000); // tomorrow in India
    const { res, body } = await call(`/api/movies/1/shows?date=${key}`);
    assert.equal(res.status, 200);
    assert.ok(body.data.length > 0);
    assert.ok(body.data.every((s) => indiaDay(new Date(s.start_time).getTime()) === key));
    const all = (await call('/api/movies/1/shows')).body.data;
    assert.deepEqual(body.data, all.filter((s) => indiaDay(new Date(s.start_time).getTime()) === key));
    const none = await call('/api/movies/1/shows?date=2020-01-01');
    assert.equal(none.res.status, 200);
    assert.deepEqual(none.body.data, []);
  });

  it('returns the standard 404 for a movie that does not exist', async () => {
    for (const id of ['10', '999', '9999999999']) {
      const result = await call(`/api/movies/${id}/shows`);
      assertError(result, 404);
      assert.deepEqual(result.body, { success: false, error: { message: 'Movie not found.' } });
    }
    assertError(await call('/api/movies/999/shows?date=2026-11-03'), 404);
  });
});

describe('errors and middleware', () => {
  it('unknown /api routes return a JSON 404', async () => {
    assertError(await call('/api/nope'), 404);
    assertError(await call('/api/movies/1/unknown'), 404);
  });

  it('methods that a route does not support return the JSON 404 (POST /api/movies)', async () => {
    assertError(await call('/api/movies', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }), 404);
  });

  it('invalid JSON bodies return 400 and oversized bodies return 413', async () => {
    const headers = { 'content-type': 'application/json' };
    assertError(await call('/api/health', { method: 'POST', headers, body: '{"broken": ' }), 400);
    assertError(await call('/api/health', { method: 'POST', headers, body: JSON.stringify({ a: 'x'.repeat(20000) }) }), 413);
  });

  it('unexpected errors (sync and async) return a generic 500 and leak nothing', async () => {
    const mini = express();
    mini.get('/boom', () => { throw new Error('password=secret at C:\\private\\db.js'); });
    mini.get('/async-boom', async () => { throw new Error('mysql: access denied for user root'); });
    mini.use(errorHandler);
    const miniServer = await listen(mini);
    try {
      for (const path of ['/boom', '/async-boom']) {
        const res = await fetch(`${baseUrl(miniServer)}${path}`);
        const text = await res.text();
        assert.equal(res.status, 500);
        assert.equal(JSON.parse(text).success, false);
        assert.ok(!/secret|mysql|root|private/.test(text), 'no internal details in the response');
      }
    } finally {
      await stop(miniServer);
    }
  });

  it('sets security headers and does not announce Express', async () => {
    const { res } = await call('/api/health');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    const csp = res.headers.get('content-security-policy');
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /img-src 'self' data: https:/);
    assert.doesNotMatch(csp, /upgrade-insecure-requests/);
  });
});

describe('frontend is served from the same address', { skip: !fs.existsSync(config.frontendDir) && 'frontend folder not found next to backend' }, () => {
  it('serves the home page and inner pages as HTML', async () => {
    for (const path of ['/', '/index.html', '/pages/movies.html', '/pages/movie.html?id=1', '/pages/seats.html?show=1101', '/pages/login.html']) {
      const { res, body } = await call(path);
      assert.equal(res.status, 200, path);
      assert.match(res.headers.get('content-type'), /text\/html/, path);
      assert.match(body, /BOOK_MY_SEAT/, path);
    }
  });

  it('serves JavaScript modules and CSS with the right content types (browsers require this for ES modules)', async () => {
    for (const path of ['/js/api.js', '/js/pages/seats.js', '/js/data/sample-data.js']) {
      const { res } = await call(path);
      assert.equal(res.status, 200, path);
      assert.match(res.headers.get('content-type'), /javascript/, path);
    }
    for (const path of ['/css/tokens.css', '/css/seats.css']) {
      const { res } = await call(path);
      assert.equal(res.status, 200, path);
      assert.match(res.headers.get('content-type'), /text\/css/, path);
    }
  });

  it('returns a plain 404 for unknown pages', async () => {
    const { res, body } = await call('/no-such-page.html');
    assert.equal(res.status, 404);
    assert.equal(body, 'Not found');
  });
});

describe('configuration (config/env.js)', () => {
  it('uses development and port 3000 by default', () => {
    const c = loadConfig({});
    assert.equal(c.nodeEnv, 'development');
    assert.equal(c.port, 3000);
    assert.equal(loadConfig({ PORT: '' }).port, 3000);
  });

  it('accepts valid values', () => {
    const c = loadConfig({ NODE_ENV: 'production', PORT: '8080' });
    assert.equal(c.port, 8080);
    assert.equal(c.isProduction, true);
  });

  it('fails fast with a clear message on invalid values', () => {
    for (const port of ['abc', '-1', '3.5', '70000', '80 80']) {
      assert.throws(() => loadConfig({ PORT: port }), /PORT must be a whole number/, port);
    }
    assert.throws(() => loadConfig({ NODE_ENV: 'staging' }), /NODE_ENV must be one of/);
  });
});
