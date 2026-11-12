// The only file that knows where data comes from.
// Page scripts call these functions. Each returns the "data" part of the Phase 4+ API response
// and throws ApiError with the HTTP status returned by the backend.

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/** Same-origin API request. Expects the established { success, data } response envelope. */
async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(options.headers || {}) },
      ...options,
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }

  let body = null;
  try { body = await response.json(); } catch { /* non-JSON error page */ }

  if (!response.ok || !body || !body.success) {
    throw new ApiError(
      body?.error?.message || 'Request failed. Please try again.',
      response.status,
      body?.error?.details ?? null,
    );
  }
  return body.data;
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new ApiError('Invalid id', 400);
  return id;
}

/** GET /api/movies?search=&genre=&language= */
export async function getMovies({ search = '', genre = '', language = '' } = {}) {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (genre.trim()) params.set('genre', genre.trim());
  if (language.trim()) params.set('language', language.trim());
  const qs = params.toString();
  return request(`/movies${qs ? `?${qs}` : ''}`);
}

/** GET /api/movies/:id */
export async function getMovie(id) {
  return request(`/movies/${parseId(id)}`);
}

/** GET /api/movies/:id/shows?date=YYYY-MM-DD (upcoming shows only, earliest first) */
export async function getMovieShows(id, { date = '' } = {}) {
  const movieId = parseId(id);
  if (date && !/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) {
    throw new ApiError('Invalid date', 400);
  }
  return request(`/movies/${movieId}/shows${date ? `?date=${encodeURIComponent(date)}` : ''}`);
}
