// Central frontend API client. Page scripts call these functions and receive the API's data payload.
// All customer-facing movie and showtime data is loaded from the same-origin Express/MySQL API.

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/** Make a same-origin request and return the established { success, data } response envelope's data. */
async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(options.headers || {}) },
      ...options,
    });
  } catch {
    throw new ApiError('Could not connect to the server. Check your connection and try again.', 0);
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

function csrfToken() {
  const match = document.cookie.match(/(?:^|; )bms_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function jsonOptions(method, body, csrf = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (csrf) {
    const token = csrfToken();
    if (!token) throw new ApiError('Your security token is missing. Refresh the page and try again.', 403);
    headers['x-csrf-token'] = token;
  }
  return { method, headers, body: JSON.stringify(body) };
}

/** POST /api/auth/register */
export async function registerUser({ name, email, password }) {
  return request('/auth/register', jsonOptions('POST', { name, email, password }));
}

/** POST /api/auth/login. The backend sets HttpOnly JWT and readable CSRF cookies. */
export async function loginUser({ email, password }) {
  return request('/auth/login', jsonOptions('POST', { email, password }));
}

/** GET /api/auth/me. Returns null only when there is no valid session. */
export async function getCurrentUser() {
  try {
    const data = await request('/auth/me');
    return data.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** POST /api/auth/logout with the double-submit CSRF token. */
export async function logoutUser() {
  return request('/auth/logout', jsonOptions('POST', {}, true));
}

/** GET /api/movies?search=&genre=&language= */
export async function getMovies({ search = '', genre = '', language = '' } = {}) {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (genre.trim()) params.set('genre', genre.trim());
  if (language.trim()) params.set('language', language.trim());
  const query = params.toString();
  return request(`/movies${query ? `?${query}` : ''}`);
}

/** GET /api/movies/:id */
export async function getMovie(id) {
  return request(`/movies/${parseId(id)}`);
}

/** GET /api/movies/:id/shows?date=YYYY-MM-DD (upcoming shows, earliest first). */
export async function getMovieShows(id, { date = '' } = {}) {
  const movieId = parseId(id);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError('Invalid date', 400);
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return request(`/movies/${movieId}/shows${query}`);
}


/** GET /api/shows/:id/seats. Returns authoritative seat availability and show prices. */
export async function getShowSeats(id) {
  return request(`/shows/${parseId(id)}/seats`);
}

/** POST /api/bookings. The server validates availability and recalculates all prices. */
export async function createBooking({ showId, seatIds }) {
  const parsedShowId = parseId(showId);
  if (!Array.isArray(seatIds) || seatIds.length < 1 || seatIds.length > 6) {
    throw new ApiError('Choose between 1 and 6 seats.', 400);
  }
  const parsedSeatIds = seatIds.map(parseId);
  return request('/bookings', jsonOptions('POST', { showId: parsedShowId, seatIds: parsedSeatIds }, true));
}
