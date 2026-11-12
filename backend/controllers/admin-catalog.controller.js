const catalogService = require('../services/admin-catalog.service');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const { parseId, parseOptionalText } = require('../validators/params');
const { movieInput, genreInput } = require('../validators/admin');

async function listMovies(req, res) {
  const search = parseOptionalText(req.query.search, 'search', 100);
  const status = req.query.status === undefined ? 'all' : req.query.status;
  if (!['all', 'active', 'inactive'].includes(status)) throw new AppError(400, 'status must be all, active or inactive.');
  return sendSuccess(res, await catalogService.listMovies({ search, status }));
}
async function createMovie(req, res) {
  return sendSuccess(res, { movie: await catalogService.createMovie(movieInput(req.body)) }, 201);
}
async function updateMovie(req, res) {
  const movie = await catalogService.updateMovie(parseId(req.params.id), movieInput(req.body, { partial: true }));
  return sendSuccess(res, { movie });
}
async function setMovieActive(req, res) {
  if (!req.body || typeof req.body.is_active !== 'boolean') throw new AppError(400, 'is_active must be true or false.');
  const result = await catalogService.setMovieActive(parseId(req.params.id), req.body.is_active);
  if (!result) throw new AppError(404, 'Movie not found.');
  return sendSuccess(res, result);
}
async function listGenres(req, res) { return sendSuccess(res, await catalogService.listGenres()); }
async function createGenre(req, res) {
  return sendSuccess(res, { genre: await catalogService.createGenre(genreInput(req.body).name) }, 201);
}
async function updateGenre(req, res) {
  const result = await catalogService.updateGenre(parseId(req.params.id), genreInput(req.body).name);
  if (!result) throw new AppError(404, 'Genre not found.');
  return sendSuccess(res, { genre: result });
}
async function deleteGenre(req, res) {
  const result = await catalogService.deleteGenre(parseId(req.params.id));
  if (!result) throw new AppError(404, 'Genre not found.');
  return sendSuccess(res, result);
}
module.exports = { listMovies, createMovie, updateMovie, setMovieActive, listGenres, createGenre, updateGenre, deleteGenre };
