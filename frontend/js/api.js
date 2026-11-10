// The only file that knows where data comes from.
// Page scripts call these functions. Each returns the "data" part of the Phase 1 API response
// and throws ApiError with the HTTP status the real API would use (400 invalid input, 404 not found).
//
// Phase 2: USE_SAMPLE_DATA = true  -> data comes from js/data/sample-data.js
// Phase 7: set it to false         -> the same functions call the Express API with fetch()

import { MOVIES, buildShows } from './data/sample-data.js';
import { toDateKey } from './utils.js';

const USE_SAMPLE_DATA = true;
const API_BASE = '/api';

export class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/** Real network call, used only when USE_SAMPLE_DATA is false (Phase 7). Expects { success, data } JSON. */
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    ...options,
  });
  let body = null;
  try { body = await response.json(); } catch { /* non-JSON error page */ }
  if (!response.ok || !body || !body.success) {
    throw new ApiError(body?.error?.message || 'Request failed', response.status, body?.error?.details ?? null);
  }
  return body.data;
}

const wait = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms)); // pretend network delay
const clone = (value) => JSON.parse(JSON.stringify(value));

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new ApiError('Invalid id', 400);
  return id;
}

/** GET /api/movies?search=&genre=&language= */
export async function getMovies({ search = '', genre = '', language = '' } = {}) {
  if (!USE_SAMPLE_DATA) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (genre) params.set('genre', genre);
    if (language) params.set('language', language);
    const qs = params.toString();
    return request(`/movies${qs ? `?${qs}` : ''}`);
  }
  await wait();
  const term = search.trim().toLowerCase();
  const wantedGenre = genre.trim().toLowerCase();
  return clone(MOVIES.filter((m) =>
    (!term || m.title.toLowerCase().includes(term)) &&
    (!wantedGenre || m.genres.some((g) => g.toLowerCase() === wantedGenre)) &&
    (!language || m.language === language)));
}

/** GET /api/movies/:id */
export async function getMovie(id) {
  if (!USE_SAMPLE_DATA) return request(`/movies/${parseId(id)}`);
  const movieId = parseId(id);
  await wait();
  const movie = MOVIES.find((m) => m.id === movieId);
  if (!movie) throw new ApiError('Movie not found', 404);
  return clone(movie);
}

/** GET /api/movies/:id/shows?date=YYYY-MM-DD  (upcoming shows only, earliest first) */
export async function getMovieShows(id, { date = '' } = {}) {
  const movieId = parseId(id);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError('Invalid date', 400);
  if (!USE_SAMPLE_DATA) return request(`/movies/${movieId}/shows${date ? `?date=${date}` : ''}`);
  await wait();
  if (!MOVIES.some((m) => m.id === movieId)) throw new ApiError('Movie not found', 404);
  const now = new Date();
  return buildShows(now)
    .filter((s) => s.movie_id === movieId
      && new Date(s.start_time) > now
      && (!date || toDateKey(s.start_time) === date))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}
