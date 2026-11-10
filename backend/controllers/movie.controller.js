// Controllers handle HTTP only: read and validate the request, call a service, send the response.
// They contain no business rules and no SQL. Express 5 forwards errors from async functions automatically.

const movieService = require('../services/movie.service');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const { parseId, parseOptionalText, parseOptionalDate } = require('../validators/params');

// GET /api/movies?search=&genre=&language=
async function listMovies(req, res) {
  const filters = {
    search: parseOptionalText(req.query.search, 'search'),
    genre: parseOptionalText(req.query.genre, 'genre', 50),
    language: parseOptionalText(req.query.language, 'language', 50),
  };
  sendSuccess(res, await movieService.listMovies(filters));
}

// GET /api/movies/:id
async function getMovie(req, res) {
  const movie = await movieService.getMovieById(parseId(req.params.id));
  if (!movie) throw new AppError(404, 'Movie not found.');
  sendSuccess(res, movie);
}

// GET /api/movies/:id/shows?date=YYYY-MM-DD
async function listMovieShows(req, res) {
  const movieId = parseId(req.params.id);
  const date = parseOptionalDate(req.query.date);
  const shows = await movieService.listUpcomingShows(movieId, { date });
  if (!shows) throw new AppError(404, 'Movie not found.');
  sendSuccess(res, shows);
}

module.exports = { listMovies, getMovie, listMovieShows };
