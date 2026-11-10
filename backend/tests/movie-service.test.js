// Tests for listMovies() in services/movie.service.js, which now reads from MySQL.
//   Part 1 and 3: unit tests, NO database needed.
//   Part 2: tests against the real, seeded database (read-only). Skipped when there are no DB credentials
//           or SKIP_DB_TESTS=1 (see tests/helpers/db-skip.js).

process.env.NODE_ENV = 'test';

const net = require('node:net');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const movieService = require('../services/movie.service');
const { closePool } = require('../config/db');
const { dbSkipReason } = require('./helpers/db-skip');

const { buildMovieListQuery, buildMovies } = movieService._internals;
const backendDir = path.join(__dirname, '..');
const SECRET = 'secret-pw-xyz-123';

after(async () => { await closePool(); });

// ---------------------------------------------------------------------------------------------------
describe('Part 1: building the SQL (no database)', () => {
  it('without filters it selects the active movies in id order and has no parameters', () => {
    const { sql, params } = buildMovieListQuery({});
    assert.match(sql, /WHERE m\.is_active = 1\s+ORDER BY m\.id/);
    assert.deepEqual(params, []);
    assert.deepEqual(buildMovieListQuery(), buildMovieListQuery({ search: '', genre: '', language: '' }));
  });

  it('every filter becomes a "?" placeholder, and the values travel only in params (in the same order)', () => {
    const { sql, params } = buildMovieListQuery({ search: 'monsoon', language: 'Hindi', genre: 'Drama' });
    assert.equal((sql.match(/\?/g) || []).length, 3);
    assert.deepEqual(params, ['%monsoon%', 'Hindi', 'Drama']);
    assert.match(sql, /m\.title LIKE \? ESCAPE '!'/);
    assert.match(sql, /m\.language = \?/);
    assert.match(sql, /EXISTS \(SELECT 1 FROM movie_genres mg JOIN genres g ON g\.id = mg\.genre_id WHERE mg\.movie_id = m\.id AND g\.name = \?\)/);
  });

  it('text that looks like SQL never enters the SQL text', () => {
    const hostile = "x'; DROP TABLE movies; --";
    for (const filters of [{ search: hostile }, { genre: hostile }, { language: hostile }]) {
      const { sql } = buildMovieListQuery(filters);
      assert.ok(!sql.includes('DROP') && !sql.includes('--') && !sql.includes("x'"), sql);
    }
  });

  it('escapes % _ ! in the search text so they match literally', () => {
    assert.deepEqual(buildMovieListQuery({ search: '50%_off!' }).params, ['%50!%!_off!!%']);
  });
});

describe('Part 1b: shaping the rows into API objects (no database)', () => {
  const row = (over = {}) => ({ id: 7, title: 'T', description: 'D', language: 'Hindi', duration_min: 120, certificate: 'UA', release_date: '2026-10-09', poster_url: 'http://x/p.jpg', ...over });

  it('returns the same property names as before, with numbers for id and duration_min', () => {
    const [movie] = buildMovies([row({ id: '7', duration_min: '120' })], [{ movie_id: '7', name: 'Drama' }]);
    assert.deepEqual(Object.keys(movie).sort(), ['certificate', 'description', 'duration_min', 'genres', 'id', 'language', 'poster_url', 'release_date', 'title']);
    assert.strictEqual(movie.id, 7);
    assert.strictEqual(movie.duration_min, 120);
    assert.deepEqual(movie.genres, ['Drama']);
  });

  it("turns missing (NULL) text values into '' and keeps the movie's genres in the given order", () => {
    const [movie] = buildMovies(
      [row({ description: null, language: null, certificate: null, release_date: null, poster_url: null })],
      [{ movie_id: 7, name: 'Drama' }, { movie_id: 7, name: 'Thriller' }],
    );
    assert.equal(movie.poster_url, '');
    assert.equal(movie.description, '');
    assert.equal(movie.language, '');
    assert.equal(movie.certificate, '');
    assert.equal(movie.release_date, '');
    assert.deepEqual(movie.genres, ['Drama', 'Thriller']);
  });

  it('gives each movie only its own genres, and [] when it has none', () => {
    const movies = buildMovies([row({ id: 1 }), row({ id: 2 }), row({ id: 3 })], [{ movie_id: 1, name: 'A' }, { movie_id: 2, name: 'B' }, { movie_id: 1, name: 'C' }]);
    assert.deepEqual(movies.map((m) => m.genres), [['A', 'C'], ['B'], []]);
  });

  it('returns an empty list for no rows', () => {
    assert.deepEqual(buildMovies([], []), []);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('Part 2: listMovies() against the seeded MySQL database', { skip: dbSkipReason }, () => {
  // What database/seed.sql contains for the 9 movies (genres alphabetical, as agreed).
  const EXPECTED = [
    [1, 'Midnight Monsoon', 'Hindi', 138, 'UA', '2026-10-09', ['Drama', 'Romance']],
    [2, 'The Last Local', 'Hindi', 124, 'UA', '2026-10-16', ['Drama', 'Thriller']],
    [3, 'Rang De Raat', 'Hindi', 151, 'UA', '2026-10-23', ['Action', 'Thriller']],
    [4, 'Chai & Chaos', 'Hindi', 132, 'U', '2026-10-02', ['Comedy', 'Family']],
    [5, 'Echoes of Kutch', 'Hindi', 128, 'U', '2026-09-25', ['Adventure', 'Drama']],
    [6, 'Kaveri Express', 'Tamil', 143, 'UA', '2026-10-18', ['Adventure', 'Drama']],
    [7, 'Dilli Heist', 'Hindi', 127, 'UA', '2026-10-11', ['Comedy', 'Thriller']],
    [8, 'Shadow of the Haveli', 'Hindi', 118, 'A', '2026-10-25', ['Horror', 'Mystery']],
    [9, 'Skyline Protocol', 'English', 112, 'UA', '2026-10-20', ['Action', 'Sci-Fi']],
  ];
  const ids = async (filters) => (await movieService.listMovies(filters)).map((m) => m.id);

  it('returns all 9 movies in id order with exactly the expected values', async () => {
    const movies = await movieService.listMovies({});
    assert.equal(movies.length, 9);
    movies.forEach((m, i) => {
      const [id, title, language, duration, certificate, release, genres] = EXPECTED[i];
      assert.deepEqual(
        { id: m.id, title: m.title, language: m.language, duration_min: m.duration_min, certificate: m.certificate, release_date: m.release_date, genres: m.genres },
        { id, title, language, duration_min: duration, certificate, release_date: release, genres },
      );
      assert.ok(typeof m.description === 'string' && m.description.length > 20, `description of movie ${id}`);
    });
  });

  it('keeps the property names and the data types (numbers stay numbers, no Date objects)', async () => {
    for (const m of await movieService.listMovies()) {
      assert.deepEqual(Object.keys(m).sort(), ['certificate', 'description', 'duration_min', 'genres', 'id', 'language', 'poster_url', 'release_date', 'title']);
      assert.strictEqual(typeof m.id, 'number');
      assert.strictEqual(typeof m.duration_min, 'number');
      assert.strictEqual(typeof m.release_date, 'string');
      assert.match(m.release_date, /^\d{4}-\d{2}-\d{2}$/);
      assert.strictEqual(m.poster_url, '', 'no poster in the sample data: empty text, not null');
      assert.ok(Array.isArray(m.genres) && m.genres.every((g) => typeof g === 'string'));
      assert.deepEqual(m.genres, [...m.genres].sort(), 'genres are alphabetical');
    }
  });

  it('search: title contains the text, ignoring upper/lower case, and the text is matched literally', async () => {
    assert.deepEqual(await ids({ search: 'monsoon' }), [1]);
    assert.deepEqual(await ids({ search: 'MONSOON' }), [1]);
    assert.deepEqual(await ids({ search: 'chai & chaos' }), [4]);
    assert.deepEqual(await ids({ search: 'ha' }), [4, 8]); // "Chai & Chaos", "Shadow of the Haveli"
    assert.deepEqual(await ids({ search: 'zzzz' }), []);
    for (const wildcard of ['%', '_', '!', '100%', '%o%']) assert.deepEqual(await ids({ search: wildcard }), [], `"${wildcard}" must not act as a wildcard`);
  });

  it('search looks at the title only (not genre, language or description)', async () => {
    assert.deepEqual(await ids({ search: 'Drama' }), []);
    assert.deepEqual(await ids({ search: 'Hindi' }), []);
    assert.deepEqual(await ids({ search: 'monsoon rain' }), []);
  });

  it('genre filter: exact genre name, ignoring case, and each movie still shows ALL of its genres', async () => {
    assert.deepEqual(await ids({ genre: 'Drama' }), [1, 2, 5, 6]);
    assert.deepEqual(await ids({ genre: 'drama' }), [1, 2, 5, 6]);
    assert.deepEqual(await ids({ genre: 'DRAMA' }), [1, 2, 5, 6]);
    assert.deepEqual(await ids({ genre: 'Thriller' }), [2, 3, 7]);
    assert.deepEqual(await ids({ genre: 'Sci-Fi' }), [9]);
    assert.deepEqual(await ids({ genre: 'Dram' }), [], 'not a partial match');
    assert.deepEqual(await ids({ genre: 'Tamil' }), [], 'Tamil is a language, not a genre');
    const thriller = await movieService.listMovies({ genre: 'Thriller' });
    assert.deepEqual(thriller.find((m) => m.id === 2).genres, ['Drama', 'Thriller']);
  });

  it('language filter: exact language, ignoring case', async () => {
    assert.deepEqual(await ids({ language: 'Tamil' }), [6]);
    assert.deepEqual(await ids({ language: 'tamil' }), [6]);
    assert.deepEqual(await ids({ language: 'English' }), [9]);
    assert.deepEqual(await ids({ language: 'Hindi' }), [1, 2, 3, 4, 5, 7, 8]);
    assert.deepEqual(await ids({ language: 'Hind' }), []);
  });

  it('filters combine with AND', async () => {
    assert.deepEqual(await ids({ genre: 'Drama', language: 'Hindi' }), [1, 2, 5]);
    assert.deepEqual(await ids({ genre: 'Drama', language: 'Tamil' }), [6]);
    assert.deepEqual(await ids({ genre: 'Thriller', language: 'Hindi', search: 'last' }), [2]);
    assert.deepEqual(await ids({ genre: 'Horror', language: 'Tamil' }), []);
  });

  it('treats text that looks like SQL as plain text: no error, no results, and the data is untouched', async () => {
    for (const text of ["' OR 1=1 --", "'; DROP TABLE movies; --", '" OR ""="', '\\', "Robert'); DROP TABLE movies;--"]) {
      for (const filters of [{ search: text }, { genre: text }, { language: text }]) {
        assert.deepEqual(await movieService.listMovies(filters), [], JSON.stringify(filters));
      }
    }
    assert.equal((await movieService.listMovies({})).length, 9);
  });

  it('works with undefined or partial arguments', async () => {
    assert.equal((await movieService.listMovies()).length, 9);
    assert.equal((await movieService.listMovies({ search: undefined })).length, 9);
    assert.deepEqual(await ids({ language: 'Tamil', search: '', genre: '' }), [6]);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('Part 3: when the database cannot be used (no database needed)', () => {
  const script = `
    const { listMovies } = require('./services/movie.service');
    const { closePool } = require('./config/db');
    listMovies({}).then(
      () => console.log(JSON.stringify({ unexpected: true })),
      (e) => console.log(JSON.stringify({ name: e.name, code: e.code, unavailable: e.unavailable, message: e.message, hint: e.hint })),
    ).finally(() => closePool());`;
  const runService = (env) => spawnSync(process.execPath, ['-e', script], { cwd: backendDir, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 30000 });
  const freePort = () => new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
  });

  it('MySQL not reachable: rejects with a plain-language DatabaseError marked "unavailable", without the password', async () => {
    const port = await freePort();
    const result = runService({ DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_USER: 'bms_app', DB_PASSWORD: SECRET, DB_NAME: 'book_my_seat' });
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 0, output);
    const error = JSON.parse(result.stdout);
    assert.equal(error.name, 'DatabaseError');
    assert.equal(error.code, 'ECONNREFUSED');
    assert.equal(error.unavailable, true);
    assert.match(error.message, new RegExp(`Cannot connect to MySQL at 127\\.0\\.0\\.1:${port}`));
    assert.ok(!output.includes(SECRET));
  });

  it('settings missing: rejects with a DbConfigError (not marked unavailable)', () => {
    const result = runService({ DB_USER: '', DB_PASSWORD: '' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const error = JSON.parse(result.stdout);
    assert.equal(error.name, 'DbConfigError');
    assert.equal(error.unavailable, false);
    assert.match(error.message, /DB_USER and DB_PASSWORD are not set/);
  });
});

// ===================================================================================================
// getMovieById()
// ===================================================================================================
const { buildMovieFromRows } = movieService._internals;

describe('getMovieById, Part 1: shaping the rows (no database)', () => {
  const row = (over = {}) => ({ id: 7, title: 'T', description: 'D', language: 'Hindi', duration_min: 120, certificate: 'UA', release_date: '2026-10-09', poster_url: null, genre_name: 'Drama', ...over });

  it('returns null when there are no rows (the controller turns that into a 404)', () => {
    assert.equal(buildMovieFromRows([]), null);
  });

  it('collects every genre from the joined rows, in the order given, with numbers for id and duration', () => {
    const movie = buildMovieFromRows([row({ id: '7', duration_min: '120' }), row({ id: '7', duration_min: '120', genre_name: 'Thriller' })]);
    assert.deepEqual(Object.keys(movie).sort(), ['certificate', 'description', 'duration_min', 'genres', 'id', 'language', 'poster_url', 'release_date', 'title']);
    assert.strictEqual(movie.id, 7);
    assert.strictEqual(movie.duration_min, 120);
    assert.deepEqual(movie.genres, ['Drama', 'Thriller']);
  });

  it('a movie without any genre has genres [] (LEFT JOIN gives one row with a NULL genre)', () => {
    assert.deepEqual(buildMovieFromRows([row({ genre_name: null })]).genres, []);
  });

  it("turns missing (NULL) text values into ''", () => {
    const movie = buildMovieFromRows([row({ description: null, language: null, certificate: null, release_date: null, poster_url: null })]);
    assert.deepEqual([movie.description, movie.language, movie.certificate, movie.release_date, movie.poster_url], ['', '', '', '', '']);
  });

  it('gives the same result as the list builder for the same movie', () => {
    const fromList = buildMovies([row({ poster_url: null })], [{ movie_id: 7, name: 'Drama' }, { movie_id: 7, name: 'Thriller' }])[0];
    const fromRows = buildMovieFromRows([row(), row({ genre_name: 'Thriller' })]);
    assert.deepEqual(fromRows, fromList);
  });
});

describe('getMovieById, Part 2: against the seeded MySQL database', { skip: dbSkipReason }, () => {
  const EXPECTED_MOVIES = [
    [1, 'Midnight Monsoon', 'Hindi', 138, 'UA', '2026-10-09', ['Drama', 'Romance']],
    [2, 'The Last Local', 'Hindi', 124, 'UA', '2026-10-16', ['Drama', 'Thriller']],
    [3, 'Rang De Raat', 'Hindi', 151, 'UA', '2026-10-23', ['Action', 'Thriller']],
    [4, 'Chai & Chaos', 'Hindi', 132, 'U', '2026-10-02', ['Comedy', 'Family']],
    [5, 'Echoes of Kutch', 'Hindi', 128, 'U', '2026-09-25', ['Adventure', 'Drama']],
    [6, 'Kaveri Express', 'Tamil', 143, 'UA', '2026-10-18', ['Adventure', 'Drama']],
    [7, 'Dilli Heist', 'Hindi', 127, 'UA', '2026-10-11', ['Comedy', 'Thriller']],
    [8, 'Shadow of the Haveli', 'Hindi', 118, 'A', '2026-10-25', ['Horror', 'Mystery']],
    [9, 'Skyline Protocol', 'English', 112, 'UA', '2026-10-20', ['Action', 'Sci-Fi']],
  ];

  it('returns each of the 9 movies with exactly the expected values and ALL its genres', async () => {
    for (const [id, title, language, duration, certificate, release, genres] of EXPECTED_MOVIES) {
      const m = await movieService.getMovieById(id);
      assert.deepEqual(
        { id: m.id, title: m.title, language: m.language, duration_min: m.duration_min, certificate: m.certificate, release_date: m.release_date, genres: m.genres },
        { id, title, language, duration_min: duration, certificate, release_date: release, genres },
      );
      assert.ok(typeof m.description === 'string' && m.description.length > 20, `description of movie ${id}`);
    }
  });

  it('keeps the property names and data types', async () => {
    const m = await movieService.getMovieById(6);
    assert.deepEqual(Object.keys(m).sort(), ['certificate', 'description', 'duration_min', 'genres', 'id', 'language', 'poster_url', 'release_date', 'title']);
    assert.strictEqual(typeof m.id, 'number');
    assert.strictEqual(typeof m.duration_min, 'number');
    assert.strictEqual(typeof m.release_date, 'string');
    assert.strictEqual(m.poster_url, '');
    assert.ok(Array.isArray(m.genres));
  });

  it('is identical to the matching item of listMovies()', async () => {
    const list = await movieService.listMovies({});
    for (const movie of list) assert.deepEqual(await movieService.getMovieById(movie.id), movie, `movie ${movie.id}`);
  });

  it('returns null for ids that do not exist, including very large ones', async () => {
    for (const id of [10, 999, 2147483648, 4294967297, 9999999999]) {
      assert.equal(await movieService.getMovieById(id), null, String(id));
    }
  });

  it('returns null (without asking MySQL) for anything that is not a positive whole number', async () => {
    for (const id of [0, -1, 1.5, NaN, Infinity, '1', '1; DROP TABLE movies', null, undefined, {}, [1], true]) {
      assert.equal(await movieService.getMovieById(id), null, String(id));
    }
    assert.equal((await movieService.listMovies({})).length, 9, 'the data is untouched');
  });
});

describe('getMovieById, Part 3: when the database cannot be used (no database needed)', () => {
  const script = `
    const { getMovieById } = require('./services/movie.service');
    const { closePool } = require('./config/db');
    getMovieById(1).then(
      (value) => console.log(JSON.stringify({ unexpected: value })),
      (e) => console.log(JSON.stringify({ name: e.name, code: e.code, unavailable: e.unavailable, message: e.message })),
    ).finally(() => closePool());`;
  const guardScript = `
    const { getMovieById } = require('./services/movie.service');
    const { closePool } = require('./config/db');
    getMovieById(0).then((v) => console.log(JSON.stringify({ value: v })), (e) => console.log(JSON.stringify({ error: e.name }))).finally(() => closePool());`;
  const run = (code, env) => spawnSync(process.execPath, ['-e', code], { cwd: backendDir, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 30000 });
  const freePort2 = () => new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
  });

  it('MySQL not reachable: rejects with a DatabaseError marked "unavailable", without the password', async () => {
    const port = await freePort2();
    const result = run(script, { DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_USER: 'bms_app', DB_PASSWORD: SECRET, DB_NAME: 'book_my_seat' });
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 0, output);
    const error = JSON.parse(result.stdout);
    assert.equal(error.name, 'DatabaseError');
    assert.equal(error.code, 'ECONNREFUSED');
    assert.equal(error.unavailable, true);
    assert.ok(!output.includes(SECRET));
  });

  it('an invalid id never reaches the database: it returns null even when MySQL is unreachable', async () => {
    const port = await freePort2();
    const result = run(guardScript, { DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_USER: 'bms_app', DB_PASSWORD: SECRET, DB_NAME: 'book_my_seat' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { value: null });
  });
});

// ===================================================================================================
// listUpcomingShows()
// ===================================================================================================
const { buildUpcomingShowsQuery, buildShowList } = movieService._internals;
const { indiaDayRangeUtc } = require('../utils/time');

describe('listUpcomingShows, Part 1: building the SQL (no database)', () => {
  it('selects the movie\'s SCHEDULED shows that start after now (UTC), earliest first', () => {
    const { sql, params } = buildUpcomingShowsQuery(7);
    assert.deepEqual(params, [7]);
    assert.equal((sql.match(/\?/g) || []).length, 1);
    assert.match(sql, /s\.movie_id = \?/);
    assert.match(sql, /s\.status = 'SCHEDULED'/);
    assert.match(sql, /s\.start_time > UTC_TIMESTAMP\(\)/);
    assert.match(sql, /ORDER BY s\.start_time, s\.id/);
    assert.match(sql, /JOIN screens sc ON sc\.id = s\.screen_id\s+JOIN cinemas c ON c\.id = sc\.cinema_id/);
  });

  it('a day range adds two UTC bounds, passed as parameters (never inside the SQL text)', () => {
    const range = indiaDayRangeUtc('2026-11-03');
    const { sql, params } = buildUpcomingShowsQuery(7, range);
    assert.deepEqual(params, [7, '2026-11-02 18:30:00', '2026-11-03 18:30:00']);
    assert.equal((sql.match(/\?/g) || []).length, 3);
    assert.match(sql, /s\.start_time >= \? AND s\.start_time < \?/);
    assert.ok(!sql.includes('2026-11') && !sql.includes('18:30'));
  });
});

describe('listUpcomingShows, Part 1b: shaping the rows (no database)', () => {
  const showRow = (over = {}) => ({
    id: '3204', movie_id: '3', start_time: '2026-11-03 05:00:00', status: 'SCHEDULED',
    cinema_id: '3', cinema_name: 'Starline Screens', cinema_city: 'New Delhi', cinema_address: 'Sector 12, Dwarka',
    screen_id: '33', screen_name: 'Screen 3', ...over,
  });
  const prices = (showId, [a, b, c] = [200, 290, 470]) => [
    { show_id: showId, category: 'RECLINER', price: c }, { show_id: showId, category: 'STANDARD', price: a }, { show_id: showId, category: 'PREMIUM', price: b },
  ];

  it('returns exactly the API shape, with numbers for every id and price', () => {
    const { shows, skippedIds } = buildShowList([showRow()], prices('3204', ['200.00', '290.00', '470.00']));
    assert.deepEqual(skippedIds, []);
    assert.deepEqual(shows, [{
      id: 3204, movie_id: 3, start_time: '2026-11-03T05:00:00.000Z', status: 'SCHEDULED',
      cinema: { id: 3, name: 'Starline Screens', city: 'New Delhi', address: 'Sector 12, Dwarka' },
      screen: { id: 33, name: 'Screen 3' },
      prices: { STANDARD: 200, PREMIUM: 290, RECLINER: 470 },
    }]);
    const [show] = shows;
    for (const value of [show.id, show.movie_id, show.cinema.id, show.screen.id, ...Object.values(show.prices)]) assert.strictEqual(typeof value, 'number');
    assert.deepEqual(Object.keys(show), ['id', 'movie_id', 'start_time', 'status', 'cinema', 'screen', 'prices']);
    assert.deepEqual(Object.keys(show.prices), ['STANDARD', 'PREMIUM', 'RECLINER'], 'same key order whatever order MySQL returned the rows in');
  });

  it('only reformats the time: the UTC value from MySQL is NOT shifted (no double conversion)', () => {
    const times = { '2026-11-03 05:00:00': '2026-11-03T05:00:00.000Z', '2026-11-03 17:15:00': '2026-11-03T17:15:00.000Z', '2026-11-02 18:30:00': '2026-11-02T18:30:00.000Z' };
    for (const [mysql, iso] of Object.entries(times)) {
      assert.equal(buildShowList([showRow({ start_time: mysql })], prices('3204')).shows[0].start_time, iso);
    }
  });

  it('keeps the order of the rows and matches each show with its own prices', () => {
    const rows = [showRow({ id: 1 }), showRow({ id: 2 }), showRow({ id: 3 })];
    const priceRows = [...prices(3, [30, 31, 32]), ...prices(1, [10, 11, 12]), ...prices(2, [20, 21, 22])];
    const { shows } = buildShowList(rows, priceRows);
    assert.deepEqual(shows.map((s) => s.id), [1, 2, 3]);
    assert.deepEqual(shows.map((s) => s.prices.STANDARD), [10, 20, 30]);
  });

  it('leaves out (and reports) a show that does not have all three prices; extra categories are ignored', () => {
    const rows = [showRow({ id: 1 }), showRow({ id: 2 }), showRow({ id: 3 })];
    const priceRows = [
      ...prices(1), // complete
      { show_id: 2, category: 'STANDARD', price: 1 }, { show_id: 2, category: 'PREMIUM', price: 2 }, // RECLINER missing
      // show 3 has no prices at all
    ];
    const { shows, skippedIds } = buildShowList(rows, [...priceRows, { show_id: 1, category: 'VIP', price: 999 }]);
    assert.deepEqual(shows.map((s) => s.id), [1]);
    assert.deepEqual(skippedIds, [2, 3]);
    assert.deepEqual(Object.keys(shows[0].prices), ['STANDARD', 'PREMIUM', 'RECLINER']);
  });

  it('returns an empty list for no rows', () => {
    assert.deepEqual(buildShowList([], []), { shows: [], skippedIds: [] });
  });
});

describe('listUpcomingShows, Part 2: against the seeded MySQL database', { skip: dbSkipReason }, () => {
  const CINEMAS = {
    1: { name: 'Aurora Cinemas', city: 'New Delhi', address: 'District Centre, Saket', prices: { STANDARD: 220, PREMIUM: 320, RECLINER: 520 } },
    2: { name: 'Lotus Multiplex', city: 'New Delhi', address: 'Barakhamba Road, Connaught Place', prices: { STANDARD: 260, PREMIUM: 380, RECLINER: 620 } },
    3: { name: 'Starline Screens', city: 'New Delhi', address: 'Sector 12, Dwarka', prices: { STANDARD: 200, PREMIUM: 290, RECLINER: 470 } },
  };
  const SLOTS_IST = ['10:30', '13:45', '17:00', '20:15', '22:45'];
  const indiaDate = (ms) => new Date(ms + 330 * 60000).toISOString().slice(0, 10);
  const indiaTime = (iso) => new Date(new Date(iso).getTime() + 330 * 60000).toISOString().slice(11, 16);
  const MOVIE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  async function showsOf(movieId, options) {
    const shows = await movieService.listUpcomingShows(movieId, options);
    assert.ok(Array.isArray(shows), `movie ${movieId} must exist`);
    return shows;
  }
  async function freshShowsOf(movieId) {
    const shows = await showsOf(movieId);
    assert.ok(shows.length > 0, `Movie ${movieId} has no upcoming shows. database/seed.sql creates shows for 5 days from the day it is run: run it again.`);
    return shows;
  }

  it('returns upcoming shows for every movie: only the future, earliest first, unique ids, status SCHEDULED', async () => {
    const now = Date.now();
    for (const movieId of MOVIE_IDS) {
      const shows = await freshShowsOf(movieId);
      shows.forEach((s, i) => {
        assert.equal(s.movie_id, movieId);
        assert.equal(s.status, 'SCHEDULED');
        assert.ok(new Date(s.start_time).getTime() > now, `show ${s.id} is in the future`);
        if (i > 0) {
          const before = shows[i - 1];
          assert.ok(new Date(before.start_time) < new Date(s.start_time) || (before.start_time === s.start_time && before.id < s.id), 'sorted by time, then id');
        }
      });
      assert.equal(new Set(shows.map((s) => s.id)).size, shows.length);
    }
  });

  it('keeps the exact API shape and numeric types (show, movie, cinema and screen ids, prices)', async () => {
    for (const movieId of [1, 5, 9]) {
      for (const s of await freshShowsOf(movieId)) {
        assert.deepEqual(Object.keys(s), ['id', 'movie_id', 'start_time', 'status', 'cinema', 'screen', 'prices']);
        assert.deepEqual(Object.keys(s.cinema), ['id', 'name', 'city', 'address']);
        assert.deepEqual(Object.keys(s.screen), ['id', 'name']);
        assert.deepEqual(Object.keys(s.prices), ['STANDARD', 'PREMIUM', 'RECLINER']);
        for (const value of [s.id, s.movie_id, s.cinema.id, s.screen.id, ...Object.values(s.prices)]) assert.strictEqual(typeof value, 'number');
        assert.match(s.start_time, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/);
      }
    }
  });

  it('keeps the id conventions: show id starts with the movie id, screen id starts with the cinema id', async () => {
    for (const movieId of MOVIE_IDS) {
      for (const s of await freshShowsOf(movieId)) {
        assert.equal(Math.floor(s.id / 1000), s.movie_id, `show ${s.id}`);
        assert.equal(Math.floor(s.screen.id / 10), s.cinema.id, `screen ${s.screen.id}`);
        assert.ok(CINEMAS[s.cinema.id], `cinema ${s.cinema.id}`);
      }
    }
  });

  it('has the right cinema details and the cinema-specific prices on every show of every movie', async () => {
    const seen = new Set();
    for (const movieId of MOVIE_IDS) {
      for (const s of await freshShowsOf(movieId)) {
        const expected = CINEMAS[s.cinema.id];
        assert.deepEqual({ name: s.cinema.name, city: s.cinema.city, address: s.cinema.address }, { name: expected.name, city: expected.city, address: expected.address });
        assert.deepEqual(s.prices, expected.prices, `show ${s.id} at ${expected.name}`);
        assert.match(s.screen.name, /^Screen [1-7]$/);
        seen.add(s.cinema.id);
      }
    }
    assert.deepEqual([...seen].sort(), ['1', '2', '3'].map(Number).sort());
  });

  it('time zone: show times are UTC, so in India time they fall exactly on the five show slots (nothing shifted twice)', async () => {
    for (const movieId of MOVIE_IDS) {
      for (const s of await freshShowsOf(movieId)) {
        assert.ok(SLOTS_IST.includes(indiaTime(s.start_time)), `show ${s.id}: ${s.start_time} is ${indiaTime(s.start_time)} in India`);
      }
    }
  });

  it('?date= means an INDIA calendar day: each day returns exactly that day\'s shows, and the days add up to all of them', async () => {
    const all = await freshShowsOf(1);
    const byDay = new Map();
    for (const s of all) {
      const day = indiaDate(new Date(s.start_time).getTime());
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(s);
    }
    assert.ok(byDay.size >= 2, 'shows on several days');
    let total = 0;
    for (const [day, expected] of byDay) {
      const filtered = await showsOf(1, { date: day });
      assert.deepEqual(filtered, expected, `day ${day}`);
      total += filtered.length;
    }
    assert.equal(total, all.length);
  });

  it('?date= with a day that has no shows returns an empty list; a date that is not real also matches nothing', async () => {
    assert.deepEqual(await showsOf(1, { date: '2020-01-01' }), []);
    assert.deepEqual(await showsOf(1, { date: '2099-12-31' }), []);
    assert.deepEqual(await showsOf(1, { date: '2026-02-31' }), []);
    assert.deepEqual(await showsOf(1, { date: 'tomorrow' }), []);
  });

  it('returns null for movies that do not exist and for invalid ids, even when a date is given', async () => {
    for (const id of [10, 999, 4294967297, 9999999999]) assert.equal(await movieService.listUpcomingShows(id), null, String(id));
    assert.equal(await movieService.listUpcomingShows(999, { date: '2026-11-03' }), null);
    for (const id of [0, -1, 1.5, NaN, '1', null, undefined, {}, [1]]) assert.equal(await movieService.listUpcomingShows(id), null, String(id));
  });

  it('gives the same result whatever time zone the Node process runs in (Asia/Kolkata, UTC, America/Los_Angeles)', async () => {
    const day = indiaDate(Date.now() + 24 * 3600 * 1000); // tomorrow in India
    const script = `
      const { listUpcomingShows } = require('./services/movie.service');
      const { closePool } = require('./config/db');
      listUpcomingShows(1, { date: ${JSON.stringify(day)} }).then((v) => console.log(JSON.stringify(v))).finally(() => closePool());`;
    const outputs = ['Asia/Kolkata', 'UTC', 'America/Los_Angeles'].map((TZ) => {
      const result = spawnSync(process.execPath, ['-e', script], { cwd: backendDir, env: { ...process.env, TZ }, encoding: 'utf8', timeout: 30000 });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      return result.stdout.trim();
    });
    assert.ok(JSON.parse(outputs[0]).length > 0, 'tomorrow has shows');
    assert.equal(outputs[1], outputs[0]);
    assert.equal(outputs[2], outputs[0]);
  });
});

describe('listUpcomingShows, Part 3: when the database cannot be used (no database needed)', () => {
  const script = `
    const { listUpcomingShows } = require('./services/movie.service');
    const { closePool } = require('./config/db');
    listUpcomingShows(1).then(
      (value) => console.log(JSON.stringify({ unexpected: value })),
      (e) => console.log(JSON.stringify({ name: e.name, code: e.code, unavailable: e.unavailable, message: e.message })),
    ).finally(() => closePool());`;
  const guardScript = `
    const { listUpcomingShows } = require('./services/movie.service');
    const { closePool } = require('./config/db');
    listUpcomingShows(0).then((v) => console.log(JSON.stringify({ value: v })), (e) => console.log(JSON.stringify({ error: e.name }))).finally(() => closePool());`;
  const run = (code, env) => spawnSync(process.execPath, ['-e', code], { cwd: backendDir, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 30000 });
  const closedPort = () => new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
  });

  it('MySQL not reachable: rejects with a DatabaseError marked "unavailable", without the password', async () => {
    const port = await closedPort();
    const result = run(script, { DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_USER: 'bms_app', DB_PASSWORD: SECRET, DB_NAME: 'book_my_seat' });
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 0, output);
    const error = JSON.parse(result.stdout);
    assert.equal(error.name, 'DatabaseError');
    assert.equal(error.code, 'ECONNREFUSED');
    assert.equal(error.unavailable, true);
    assert.ok(!output.includes(SECRET));
  });

  it('an invalid movie id never reaches the database', async () => {
    const port = await closedPort();
    const result = run(guardScript, { DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_USER: 'bms_app', DB_PASSWORD: SECRET, DB_NAME: 'book_my_seat' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { value: null });
  });
});

