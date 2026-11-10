// Business logic for movies and shows. Controllers call these functions and know nothing about where the data lives.
// All data comes from MySQL through the shared connection pool (config/db.js). Every query uses "?" parameters:
// values typed by the user are never glued into the SQL text. All functions are async because database calls are.

const { getPool, toDatabaseError } = require('../config/db');
const { escapeLike } = require('../utils/sql');
const { toIsoUtc, indiaDayRangeUtc } = require('../utils/time');
const { config } = require('../config/env');

/**
 * The SQL for the movie list. A pure function (it does not touch the database), so it can be unit-tested.
 * Only fixed text goes into "sql"; everything typed by the user goes into "params" and reaches MySQL separately.
 * The text/collation of the tables (utf8mb4_unicode_ci) makes every comparison case-insensitive, like the old behaviour.
 */
function buildMovieListQuery({ search = '', genre = '', language = '' } = {}) {
  const conditions = ['m.is_active = 1'];
  const params = [];
  if (search) {
    conditions.push("m.title LIKE ? ESCAPE '!'"); // title contains the text
    params.push(`%${escapeLike(search)}%`);
  }
  if (language) {
    conditions.push('m.language = ?');
    params.push(language);
  }
  if (genre) {
    // EXISTS (not a join) so the movie keeps ALL its genres, not only the one that was searched for.
    conditions.push('EXISTS (SELECT 1 FROM movie_genres mg JOIN genres g ON g.id = mg.genre_id WHERE mg.movie_id = m.id AND g.name = ?)');
    params.push(genre);
  }
  const sql = `SELECT m.id, m.title, m.description, m.language, m.duration_min, m.certificate, m.release_date, m.poster_url
               FROM movies m
               WHERE ${conditions.join(' AND ')}
               ORDER BY m.id`;
  return { sql, params };
}

/**
 * Combines the movie rows and their genre rows into the objects the API has always returned.
 * Property names and types are unchanged: ids and durations are numbers, release_date is "YYYY-MM-DD" text, and a
 * missing (NULL) text value becomes '' (for example poster_url). Genres are listed alphabetically.
 */
function buildMovies(movieRows, genreRows) {
  const genresByMovie = new Map();
  for (const row of genreRows) {
    const id = Number(row.movie_id);
    if (!genresByMovie.has(id)) genresByMovie.set(id, []);
    genresByMovie.get(id).push(row.name);
  }
  return movieRows.map((m) => ({
    id: Number(m.id),
    title: m.title,
    language: m.language ?? '',
    duration_min: Number(m.duration_min),
    certificate: m.certificate ?? '',
    release_date: m.release_date ?? '',
    poster_url: m.poster_url ?? '',
    genres: genresByMovie.get(Number(m.id)) ?? [],
    description: m.description ?? '',
  }));
}

/** Movies from MySQL, optionally filtered by title text, genre name and language. Ordered by id. */
async function listMovies(filters = {}) {
  try {
    const pool = getPool();
    const { sql, params } = buildMovieListQuery(filters);
    const [movieRows] = await pool.execute(sql, params); // prepared statement: values are sent separately from the SQL
    if (movieRows.length === 0) return [];
    // The genres of all these movies in one second query (IN (?) expands the list of ids; query() is needed for that).
    const [genreRows] = await pool.query(
      `SELECT mg.movie_id, g.name
       FROM movie_genres mg
       JOIN genres g ON g.id = mg.genre_id
       WHERE mg.movie_id IN (?)
       ORDER BY mg.movie_id, g.name`,
      [movieRows.map((m) => m.id)],
    );
    return buildMovies(movieRows, genreRows);
  } catch (error) {
    throw toDatabaseError(error); // plain-language message, no secrets, marked "unavailable" when MySQL cannot be reached
  }
}

/**
 * Turns the rows of the "one movie with its genres" query into one API movie object, or null when there are no rows.
 * Each row is the same movie plus ONE genre name (genre_name is NULL when the movie has no genre at all).
 * Pure function (no database), so it can be unit-tested. The result has exactly the same shape as one item of listMovies().
 */
function buildMovieFromRows(rows) {
  if (rows.length === 0) return null;
  const genreRows = rows.filter((row) => row.genre_name !== null && row.genre_name !== undefined)
    .map((row) => ({ movie_id: row.id, name: row.genre_name }));
  return buildMovies([rows[0]], genreRows)[0];
}

/** The movie with ALL its genres, or null when it does not exist (or is inactive). The controller turns null into a 404. */
async function getMovieById(id) {
  // Callers pass a number (the controller validates the URL first). Anything else cannot be a movie id.
  if (!Number.isSafeInteger(id) || id < 1) return null;
  try {
    // One query: LEFT JOIN keeps the movie even if it has no genres, and returns one row per genre, so the movie and
    // its genres come from the same moment. The id travels as a separate parameter (the "?"), never inside the SQL text.
    const [rows] = await getPool().execute(
      `SELECT m.id, m.title, m.description, m.language, m.duration_min, m.certificate, m.release_date, m.poster_url,
              g.name AS genre_name
       FROM movies m
       LEFT JOIN movie_genres mg ON mg.movie_id = m.id
       LEFT JOIN genres g ON g.id = mg.genre_id
       WHERE m.id = ? AND m.is_active = 1
       ORDER BY g.name`,
      [id],
    );
    return buildMovieFromRows(rows);
  } catch (error) {
    throw toDatabaseError(error); // plain-language message, no secrets, marked "unavailable" when MySQL cannot be reached
  }
}

// Every show must have a price for each of these categories (see show_prices).
const PRICE_CATEGORIES = ['STANDARD', 'PREMIUM', 'RECLINER'];

/**
 * The SQL for the upcoming shows of one movie. A pure function (no database), so it can be unit-tested.
 * "Upcoming" = status SCHEDULED and a start time later than right now (UTC_TIMESTAMP() is UTC whatever the server's
 * time zone is, and start_time is stored in UTC, so both sides of the comparison are UTC).
 * dayRange (optional, from indiaDayRangeUtc) limits the result to one India calendar day, expressed in UTC.
 */
function buildUpcomingShowsQuery(movieId, dayRange = null) {
  const conditions = ['s.movie_id = ?', "s.status = 'SCHEDULED'", 's.start_time > UTC_TIMESTAMP()'];
  const params = [movieId];
  if (dayRange) {
    conditions.push('s.start_time >= ?', 's.start_time < ?');
    params.push(dayRange.from, dayRange.to);
  }
  const sql = `SELECT s.id, s.movie_id, s.start_time, s.status,
                      c.id AS cinema_id, c.name AS cinema_name, c.city AS cinema_city, c.address AS cinema_address,
                      sc.id AS screen_id, sc.name AS screen_name
               FROM shows s
               JOIN screens sc ON sc.id = s.screen_id
               JOIN cinemas c ON c.id = sc.cinema_id
               WHERE ${conditions.join(' AND ')}
               ORDER BY s.start_time, s.id`;
  return { sql, params };
}

/**
 * Combines show rows and price rows into the objects the API has always returned:
 *   { id, movie_id, start_time (ISO, UTC "Z"), status, cinema: {id, name, city, address}, screen: {id, name},
 *     prices: { STANDARD, PREMIUM, RECLINER } }   // ids and prices are numbers
 * A show that does not have a price for every category cannot be sold, so it is left out and its id is reported in
 * "skippedIds" (the caller logs it). The rows must already be in the order the API should return.
 */
function buildShowList(showRows, priceRows) {
  const pricesByShow = new Map();
  for (const row of priceRows) {
    const id = Number(row.show_id);
    if (!pricesByShow.has(id)) pricesByShow.set(id, {});
    pricesByShow.get(id)[row.category] = Number(row.price);
  }
  const shows = [];
  const skippedIds = [];
  for (const r of showRows) {
    const id = Number(r.id);
    const found = pricesByShow.get(id) || {};
    if (!PRICE_CATEGORIES.every((category) => Number.isFinite(found[category]))) {
      skippedIds.push(id);
      continue;
    }
    shows.push({
      id,
      movie_id: Number(r.movie_id),
      start_time: toIsoUtc(r.start_time),
      status: r.status,
      cinema: { id: Number(r.cinema_id), name: r.cinema_name, city: r.cinema_city, address: r.cinema_address },
      screen: { id: Number(r.screen_id), name: r.screen_name },
      prices: Object.fromEntries(PRICE_CATEGORIES.map((category) => [category, found[category]])),
    });
  }
  return { shows, skippedIds };
}

/**
 * Upcoming shows of a movie (earliest first), optionally only those on one INDIA calendar day ("YYYY-MM-DD").
 * Returns null when the movie does not exist (or is inactive); the controller turns that into a 404.
 */
async function listUpcomingShows(movieId, { date = '' } = {}) {
  if (!Number.isSafeInteger(movieId) || movieId < 1) return null;
  try {
    const pool = getPool();
    const [movieRows] = await pool.execute('SELECT 1 AS found FROM movies WHERE id = ? AND is_active = 1', [movieId]);
    if (movieRows.length === 0) return null;

    let dayRange = null;
    if (date) {
      dayRange = indiaDayRangeUtc(date);
      if (!dayRange) return []; // not a real date, so no show can match (the controller rejects such dates with a 400 first)
    }

    const { sql, params } = buildUpcomingShowsQuery(movieId, dayRange);
    const [showRows] = await pool.execute(sql, params);
    if (showRows.length === 0) return [];

    // The prices of all these shows in one second query (IN (?) expands the list of ids; query() is needed for that).
    const [priceRows] = await pool.query(
      'SELECT show_id, category, price FROM show_prices WHERE show_id IN (?)',
      [showRows.map((row) => row.id)],
    );
    const { shows, skippedIds } = buildShowList(showRows, priceRows);
    if (skippedIds.length > 0 && !config.isTest) {
      console.warn(`listUpcomingShows: left out show(s) without a complete price list: ${skippedIds.join(', ')}`);
    }
    return shows;
  } catch (error) {
    throw toDatabaseError(error); // plain-language message, no secrets, marked "unavailable" when MySQL cannot be reached
  }
}

module.exports = {
  listMovies,
  getMovieById,
  listUpcomingShows,
  _internals: { buildMovieListQuery, buildMovies, buildMovieFromRows, buildUpcomingShowsQuery, buildShowList }, // exported only so the unit tests can check them without a database
};
