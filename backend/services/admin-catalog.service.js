const { getPool, toDatabaseError } = require('../config/db');
const AppError = require('../utils/AppError');

function mapMovie(row, genres = []) {
  return { id: Number(row.id), title: row.title, description: row.description ?? '', language: row.language ?? '',
    duration_min: Number(row.duration_min), certificate: row.certificate ?? '', release_date: row.release_date ?? '',
    poster_url: row.poster_url ?? '', is_active: Boolean(row.is_active), genres };
}
async function getMovieWithGenres(executor, id) {
  const [rows] = await executor.execute(
    'SELECT m.id, m.title, m.description, m.language, m.duration_min, m.certificate, m.release_date, m.poster_url, m.is_active, g.name AS genre_name ' +
    'FROM movies m LEFT JOIN movie_genres mg ON mg.movie_id = m.id LEFT JOIN genres g ON g.id = mg.genre_id ' +
    'WHERE m.id = ? ORDER BY g.name', [id]);
  if (!rows.length) return null;
  return mapMovie(rows[0], rows.filter((row) => row.genre_name !== null).map((row) => row.genre_name));
}
async function assertGenresExist(executor, ids) {
  if (!ids || ids.length === 0) return;
  const marks = ids.map(() => '?').join(', ');
  const [rows] = await executor.execute('SELECT id FROM genres WHERE id IN (' + marks + ')', ids);
  if (rows.length !== ids.length) throw new AppError(400, 'One or more selected genres do not exist.');
}
async function listMovies({ search = '', status = 'all' } = {}) {
  try {
    const conditions = [], params = [];
    if (search) {
      conditions.push("m.title LIKE ? ESCAPE '!'");
      params.push('%' + search.replace(/[!%_]/g, (c) => '!' + c) + '%');
    }
    if (status === 'active') conditions.push('m.is_active = 1');
    if (status === 'inactive') conditions.push('m.is_active = 0');
    const [movies] = await getPool().execute(
      'SELECT m.id, m.title, m.description, m.language, m.duration_min, m.certificate, m.release_date, m.poster_url, m.is_active ' +
      'FROM movies m ' + (conditions.length ? 'WHERE ' + conditions.join(' AND ') : '') + ' ORDER BY m.id DESC LIMIT 500', params);
    if (!movies.length) return [];
    const ids = movies.map((movie) => movie.id);
    const [genreRows] = await getPool().query(
      'SELECT mg.movie_id, g.name FROM movie_genres mg JOIN genres g ON g.id = mg.genre_id WHERE mg.movie_id IN (?) ORDER BY g.name', [ids]);
    const byMovie = new Map();
    for (const row of genreRows) {
      const id = Number(row.movie_id);
      if (!byMovie.has(id)) byMovie.set(id, []);
      byMovie.get(id).push(row.name);
    }
    return movies.map((movie) => mapMovie(movie, byMovie.get(Number(movie.id)) || []));
  } catch (error) { throw toDatabaseError(error); }
}
async function createMovie(input) {
  const pool = getPool(); let connection;
  try {
    connection = await pool.getConnection(); await connection.beginTransaction();
    await assertGenresExist(connection, input.genre_ids || []);
    const [result] = await connection.execute(
      'INSERT INTO movies (title, description, language, duration_min, certificate, release_date, poster_url, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
      [input.title, input.description, input.language, input.duration_min, input.certificate, input.release_date, input.poster_url]);
    const id = Number(result.insertId);
    for (const genreId of input.genre_ids || []) await connection.execute(
      'INSERT INTO movie_genres (movie_id, genre_id) VALUES (?, ?)', [id, genreId]);
    const movie = await getMovieWithGenres(connection, id);
    await connection.commit(); return movie;
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch {} }
    if (error instanceof AppError) throw error;
    throw toDatabaseError(error);
  } finally { if (connection) connection.release(); }
}
async function updateMovie(id, input) {
  const pool = getPool(); let connection;
  try {
    connection = await pool.getConnection(); await connection.beginTransaction();
    const [existing] = await connection.execute('SELECT id FROM movies WHERE id = ? FOR UPDATE', [id]);
    if (!existing.length) throw new AppError(404, 'Movie not found.');
    if (input.genre_ids !== undefined) await assertGenresExist(connection, input.genre_ids);
    const allowed = ['title', 'description', 'language', 'duration_min', 'certificate', 'release_date', 'poster_url'];
    const keys = allowed.filter((key) => Object.prototype.hasOwnProperty.call(input, key));
    if (keys.length) {
      const assignments = keys.map((key) => key + ' = ?').join(', ');
      await connection.execute('UPDATE movies SET ' + assignments + ' WHERE id = ?', [...keys.map((key) => input[key]), id]);
    }
    if (input.genre_ids !== undefined) {
      await connection.execute('DELETE FROM movie_genres WHERE movie_id = ?', [id]);
      for (const genreId of input.genre_ids) await connection.execute(
        'INSERT INTO movie_genres (movie_id, genre_id) VALUES (?, ?)', [id, genreId]);
    }
    const movie = await getMovieWithGenres(connection, id);
    await connection.commit(); return movie;
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch {} }
    if (error instanceof AppError) throw error;
    throw toDatabaseError(error);
  } finally { if (connection) connection.release(); }
}
async function setMovieActive(id, isActive) {
  const pool = getPool();
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Serialize activation changes with show creation, which also locks the movie row.
    // Without this lock, a concurrent schedule/deactivation could pass both checks.
    const [rows] = await connection.execute(
      'SELECT id FROM movies WHERE id = ? FOR UPDATE', [id]);
    if (!rows.length) {
      await connection.commit();
      return null;
    }

    if (!isActive) {
      const [upcoming] = await connection.execute(
        "SELECT id FROM shows WHERE movie_id = ? AND status = 'SCHEDULED' AND start_time > UTC_TIMESTAMP() LIMIT 1",
        [id]);
      if (upcoming.length) {
        throw new AppError(409, 'This movie has upcoming scheduled shows. Cancel or complete those shows before deactivating it.');
      }
    }

    await connection.execute(
      'UPDATE movies SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
    await connection.commit();
    return { id, is_active: Boolean(isActive) };
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch {}
    }
    if (error instanceof AppError) throw error;
    throw toDatabaseError(error);
  } finally {
    if (connection) connection.release();
  }
}
async function listGenres() {
  try {
    const [rows] = await getPool().execute(
      'SELECT g.id, g.name, COUNT(mg.movie_id) AS movie_count FROM genres g ' +
      'LEFT JOIN movie_genres mg ON mg.genre_id = g.id GROUP BY g.id, g.name ORDER BY g.name');
    return rows.map((row) => ({ id: Number(row.id), name: row.name, movie_count: Number(row.movie_count) }));
  } catch (error) { throw toDatabaseError(error); }
}
async function createGenre(name) {
  try {
    const [result] = await getPool().execute('INSERT INTO genres (name) VALUES (?)', [name]);
    return { id: Number(result.insertId), name, movie_count: 0 };
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') throw new AppError(409, 'A genre with this name already exists.');
    throw toDatabaseError(error);
  }
}
async function updateGenre(id, name) {
  try {
    const [result] = await getPool().execute('UPDATE genres SET name = ? WHERE id = ?', [name, id]);
    if (!result.affectedRows) {
      const [found] = await getPool().execute('SELECT id FROM genres WHERE id = ?', [id]);
      if (!found.length) return null;
    }
    const [rows] = await getPool().execute('SELECT id, name FROM genres WHERE id = ?', [id]);
    return { id: Number(rows[0].id), name: rows[0].name };
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') throw new AppError(409, 'A genre with this name already exists.');
    throw toDatabaseError(error);
  }
}
async function deleteGenre(id) {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT id FROM genres WHERE id = ?', [id]);
    if (!rows.length) return null;
    const [linked] = await pool.execute('SELECT movie_id FROM movie_genres WHERE genre_id = ? LIMIT 1', [id]);
    if (linked.length) throw new AppError(409, 'This genre is assigned to one or more movies. Remove those assignments first.');
    await pool.execute('DELETE FROM genres WHERE id = ?', [id]); return { id };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw toDatabaseError(error);
  }
}
module.exports = { listMovies, createMovie, updateMovie, setMovieActive, listGenres, createGenre, updateGenre, deleteGenre };
