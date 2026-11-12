# Phase 7 — Stage 1: Frontend Integration Audit & Implementation Plan

**Branch:** `phase-7/stage-1-frontend-integration-audit`  
**Baseline:** `phase-6/stage-6-concurrency-security-regression`  
**Stage status:** Audit complete; implementation not started.

## 1. Objective

Connect the existing Netflix-inspired HTML/CSS/Vanilla JavaScript frontend to the completed Express/MySQL backend without changing the established visual design or weakening server-side validation, authentication, booking, or cancellation rules.

This stage is an audit and implementation plan only. No frontend application code, API behavior, database schema, seed data, or permissions are changed.

## 2. Frontend audit findings

### 2.1 Existing API abstraction

File: `frontend/js/api.js`

- The project already has a central API abstraction, which is the intended integration seam.
- `API_BASE` is `/api`, matching the same-origin Express deployment.
- The `request()` helper uses `fetch()`, `credentials: 'same-origin'`, and expects the established `{ success, data }` response envelope.
- **Critical switch:** `USE_SAMPLE_DATA` is currently `true`. Movie functions therefore still use `js/data/sample-data.js`.
- The module currently exposes `getMovies()`, `getMovie()`, and `getMovieShows()`; authentication, seat availability, booking creation, booking history/detail, and cancellation functions are not yet exposed here.

### 2.2 Page-by-page status

| Frontend page | Current source/behavior | Phase 7 integration |
|---|---|---|
| Home — `index.html`, `js/pages/home.js` | Calls `getMovies()`; featured movies and genre links are built from returned data. | Use the real movie-list API; preserve featured sorting and genre rendering. |
| Movie listing — `pages/movies.html`, `js/pages/movies.js` | Search, genre and language filters call `getMovies()`. | Use query parameters against `GET /api/movies`; retain URL/filter behavior and loading/empty/error states. |
| Movie detail — `pages/movie.html`, `js/pages/movie.js` | Calls `getMovie()` and `getMovieShows()`; expects movie and show objects with nested cinema/screen and prices. | Use database-backed movie and upcoming-show endpoints. Existing response shapes are compatible with the page's main rendering needs. |
| Seat selection — `pages/seats.html`, `js/pages/seats.js` | Derives movie ID from the sample show ID; generates a pseudo-random booked-seat map; confirm button explicitly does not book. | Replace with `GET /api/shows/:id/seats`; use actual show metadata, seat IDs, categories, prices and availability; submit selected seat IDs to booking API. |
| Login/register — `pages/login.html`, `pages/register.html`, `js/pages/auth.js` | Client-side validation only; submit handler does not send requests. | Connect to registration/login endpoints, retain validation, handle server field errors, session state and redirects. |
| Booking history/detail | No dedicated frontend page found in the audited frontend tree. | Add a My Bookings page and booking detail presentation using the authenticated read endpoints. |

### 2.3 Shared header

File: `frontend/js/components.js`

- Header currently always shows Log in and Create account links.
- It does not check the current authenticated user.
- Phase 7 must make the header session-aware: show account/booking access and logout when signed in, while retaining login/register links when signed out.
- Preserve the current responsive navigation and styling.

## 3. Backend API contracts available

All endpoints are mounted on the same origin under `/api`.

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| GET | `/api/movies` | Public | List/filter movies |
| GET | `/api/movies/:id` | Public | Movie details |
| GET | `/api/movies/:id/shows?date=YYYY-MM-DD` | Public | Upcoming showtimes |
| GET | `/api/shows/:id/seats` | Public | Show metadata, seat map, authoritative prices and availability summary |
| POST | `/api/auth/register` | Public + same-origin | Register user |
| POST | `/api/auth/login` | Public + same-origin | Login and issue cookies |
| GET | `/api/auth/me` | Cookie-authenticated | Resolve current user |
| POST | `/api/auth/logout` | Cookie-authenticated + CSRF + same-origin | Logout/clear cookies |
| POST | `/api/bookings` | Cookie-authenticated + CSRF + same-origin | Create booking |
| GET | `/api/bookings?page=&limit=` | Cookie-authenticated | User's booking history |
| GET | `/api/bookings/:id` | Cookie-authenticated | Owner-scoped booking detail |
| DELETE | `/api/bookings/:id` | Cookie-authenticated + CSRF + same-origin | Cancel an eligible booking |

### 3.1 Important request and security requirements

- Authentication uses the `bms_token` HttpOnly cookie and `bms_csrf` readable cookie.
- Browser requests must use same-origin credentials.
- Mutating requests must send an `Origin` matching the current site and an `x-csrf-token` header matching the `bms_csrf` cookie.
- The frontend must never read, store, or log the HttpOnly JWT.
- Booking creation request body is `{ showId, seatIds }`. Do not send a trusted total or client-calculated price; the server recomputes prices from `show_prices`.
- A successful booking response is HTTP 201 with the booking in `data.booking`.
- Cancellation may return HTTP 409 when the booking is not confirmed or is within the two-hour cutoff. The frontend must explain this without treating it as a server failure.
- Booking history and detail are scoped to the authenticated owner by the backend.

## 4. Seat API response mapping

The current `GET /api/shows/:id/seats` service returns:

- `show`: show ID, movie ID/title, UTC start time, status, cinema and screen.
- `prices`: `STANDARD`, `PREMIUM`, and `RECLINER` prices.
- `seats[]`: real database seat ID, row label, seat number, category, `is_available`, and `status` (`AVAILABLE` or `BOOKED`).
- `summary`: total, available and booked counts.

The current seat UI uses an 8-by-10 layout and a fixed row/category mapping. Phase 7 must render the rows and categories from the API response rather than assume those values. Preserve the existing aisle and keyboard interaction where compatible with the returned seat layout.

## 5. Integration risks and decisions

1. **Show ID assumption:** Current seat page assumes a sample show ID encodes its movie ID. Real database show IDs do not follow that convention. Load the show directly through the seat-availability endpoint, then load the associated movie by the returned `movie_id` or use the returned `movie_title` with a separate movie request.
2. **Seat IDs:** Sample seat IDs are generated in the browser and are not database IDs. Only IDs from the seat API may be submitted to booking creation.
3. **Prices:** Seat UI may display prices returned by the API, but the backend remains authoritative at booking time.
4. **Session expiry:** Protected API calls can return 401. The UI should show a clear sign-in prompt and preserve a safe return path where practical.
5. **CSRF:** Login issues both cookies. All POST/DELETE authenticated mutations must read the CSRF cookie and attach its value as `x-csrf-token`; logout also requires it.
6. **Existing booking data:** Booking #1 is a real confirmed booking in the local database. Do not reseed/reset the database or use its seat for integration tests.
7. **Cancellation cutoff:** Booking #1's showtime is inside the two-hour cancellation window, so a 409 response is expected. Do not weaken this backend rule to make a UI test pass.
8. **No payments:** The current backend has no payment integration. The UI must not imply that payment has been collected.

## 6. Proposed Phase 7 stages

| Stage | Scope | Planned deliverable |
|---|---|---|
| 1 | Frontend integration audit and implementation plan | This report; no application-code changes |
| 2 | API client and movie browsing integration | Real movie list, filters, details and showtimes |
| 3 | Authentication UI integration | Registration, login, current-user session, logout and session-aware header |
| 4 | Seat availability and booking creation UI | Real show/seat data, selection and POST booking workflow |
| 5 | Booking history, detail and cancellation UI | My Bookings page, detail view and cancellation feedback |
| 6 | Full frontend/API regression and handover | Browser workflow checks, automated tests and updated project docs |

Each stage should be implemented and reviewed independently. The next stage should not begin until the current stage's tests and local verification are reported.

## 7. Acceptance criteria for Phase 7

- All customer-facing movie/show/seat/booking/auth data shown by the application comes from the backend, not sample or generated browser data.
- The existing visual design, responsive layout, keyboard seat navigation and accessible status messaging remain intact.
- Authentication state is derived from `GET /api/auth/me`; no JWT is exposed to JavaScript.
- Booking totals shown in the UI are informational; the backend remains authoritative.
- Users can see only their own booking history/details.
- API errors, loading states, empty states, expired sessions and cancellation restrictions are communicated clearly.
- The full automated test suite and database checks pass after integration.
- Manual browser verification covers registration/login, browsing, seat selection, booking, history/detail and the allowed/blocked cancellation paths.

## 8. Stage 1 exit decision

The audit confirms that the backend APIs needed for customer workflows are already implemented and the frontend already has a central API abstraction. The primary remaining work is to switch that abstraction to real requests and replace the simulated seat/auth/booking interactions with calls to the existing endpoints.

**Stage 1 is complete.** No application code or database state was changed in this stage. Proceed to Stage 2 only after reviewing this integration order.
