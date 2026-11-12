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


/** GET /api/bookings?page=&limit=. Results are scoped to the authenticated user by the API. */
export async function getUserBookings({ page = 1, limit = 20 } = {}) {
  const parsedPage = parseId(page);
  const parsedLimit = parseId(limit);
  if (parsedLimit > 50) throw new ApiError('Page size cannot exceed 50.', 400);
  return request(`/bookings?page=${parsedPage}&limit=${parsedLimit}`);
}

/** GET /api/bookings/:id. The API only returns bookings owned by the current user. */
export async function getUserBooking(id) {
  return request(`/bookings/${parseId(id)}`);
}


// Phase 8 admin catalogue API. All write operations use the existing same-origin + CSRF protections.
export async function getAdminMovies({ search = '', status = 'all' } = {}) {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (status !== 'all') params.set('status', status);
  const query = params.toString();
  return request('/admin/movies' + (query ? '?' + query : ''));
}
export async function getAdminGenres() {
  return request('/admin/genres');
}
export async function createAdminMovie(movie) {
  return request('/admin/movies', jsonOptions('POST', movie, true));
}
export async function updateAdminMovie(id, movie) {
  return request('/admin/movies/' + parseId(id), jsonOptions('PATCH', movie, true));
}
export async function setAdminMovieActive(id, is_active) {
  return request('/admin/movies/' + parseId(id) + '/status', jsonOptions('PATCH', { is_active }, true));
}
export async function createAdminGenre(name) {
  return request('/admin/genres', jsonOptions('POST', { name }, true));
}
export async function updateAdminGenre(id, name) {
  return request('/admin/genres/' + parseId(id), jsonOptions('PATCH', { name }, true));
}
export async function deleteAdminGenre(id) {
  return request('/admin/genres/' + parseId(id), {
    method: 'DELETE',
    headers: { 'x-csrf-token': csrfToken() },
  });
}


// Phase 8 Stage 4: cinema, screen and seat-layout administration.
export async function getAdminCinemas() { return request('/admin/cinemas'); }
export async function createAdminCinema(cinema) { return request('/admin/cinemas', jsonOptions('POST', cinema, true)); }
export async function updateAdminCinema(id, cinema) { return request('/admin/cinemas/' + parseId(id), jsonOptions('PATCH', cinema, true)); }
export async function getAdminScreens(cinemaId) { return request('/admin/cinemas/' + parseId(cinemaId) + '/screens'); }
export async function createAdminScreen(cinemaId, name) { return request('/admin/cinemas/' + parseId(cinemaId) + '/screens', jsonOptions('POST', { name }, true)); }
export async function updateAdminScreen(id, name) { return request('/admin/screens/' + parseId(id), jsonOptions('PATCH', { name }, true)); }
export async function getAdminSeats(screenId) { return request('/admin/screens/' + parseId(screenId) + '/seats'); }
export async function saveAdminSeatLayout(screenId, rows) { return request('/admin/screens/' + parseId(screenId) + '/seats', jsonOptions('PUT', { rows }, true)); }


// Phase 8 Stage 5: administrator show scheduling and category pricing.
export async function getAdminShows() { return request('/admin/shows'); }
export async function createAdminShow(show) { return request('/admin/shows', jsonOptions('POST', show, true)); }
export async function updateAdminShowPrices(id, prices) { return request('/admin/shows/' + parseId(id) + '/prices', jsonOptions('PATCH', { prices }, true)); }
export async function updateAdminShowStatus(id, status) { return request('/admin/shows/' + parseId(id) + '/status', jsonOptions('PATCH', { status }, true)); }


// Phase 8 Stage 6: administrator dashboard and booking operations.
export async function getAdminDashboard() {
  return request('/admin/dashboard');
}
export async function getAdminBookings({ search = '', status = 'all', page = 1, limit = 20 } = {}) {
  const parsedPage = parseId(page);
  const parsedLimit = parseId(limit);
  // Keep the client-side page-size contract aligned with the admin API (maximum 50).
  if (parsedLimit > 50) throw new ApiError('Page size cannot exceed 50.', 400);

  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (status !== 'all') params.set('status', status);
  params.set('page', String(parsedPage));
  params.set('limit', String(parsedLimit));
  return request('/admin/bookings?' + params.toString());
}
export async function getAdminBooking(id) {
  return request('/admin/bookings/' + parseId(id));
}
