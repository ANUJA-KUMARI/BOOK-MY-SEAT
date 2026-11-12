# BOOK_MY_SEAT — Phase 7 Report
## Frontend and Backend Integration

| Item | Detail |
|---|---|
| Phase | 7 of 8 — Connecting the Vanilla JavaScript frontend to Express/MySQL |
| Frontend | HTML5, CSS3 and Vanilla JavaScript ES modules |
| Integration | Fetch API, same-origin cookies and CSRF headers |
| Status | Customer integration implemented; later project records report successful customer workflow and regression checks |

## 1. Phase objective and integration approach

Phase 7 replaced the frontend's sample-data and simulated customer workflows with requests to the existing Express/MySQL backend. It preserved the established cinematic visual design, page structure, responsive layout and accessible seat-map interactions.

The central integration point was `frontend/js/api.js`. The frontend and API are served by Express from one origin, so browser requests use same-origin credentials. The integration does not read or expose the HttpOnly JWT.

## 2. Initial audit and integration risks

The initial audit found:
- `frontend/js/api.js` already defined `API_BASE = '/api'` and a shared fetch helper using `credentials: 'same-origin'`.
- A `USE_SAMPLE_DATA` switch was true, so movie functions still used `js/data/sample-data.js`.
- Login/register forms had client-side validation but did not send requests.
- The seat page generated pseudo-random booked seats and its confirmation action did not create a booking.
- The shared header always showed login/register links and did not resolve an authenticated user.
- There was no My Bookings page.

Key integration constraints:
- Only seat IDs returned by the database-backed seat API may be submitted.
- Never trust a browser-calculated price or total.
- Booking creation body is `{ showId, seatIds }`.
- State-changing authenticated requests must include same-origin credentials and the CSRF header.
- The HttpOnly `bms_token` must never be read by JavaScript.
- A 401 indicates an unauthenticated/expired session; a 409 can represent a business conflict such as unavailable seats or cancellation cutoff.
- The UI must not imply that payment was collected; payment processing is not implemented.

## 3. Movie catalogue, details and showtime integration

The sample-data imports, `USE_SAMPLE_DATA` switch, artificial delay and sample filtering/building paths were removed from `frontend/js/api.js`.

The existing page-facing methods now call:
- `getMovies()` → `GET /api/movies`
- `getMovie(id)` → `GET /api/movies/:id`
- `getMovieShows(id, { date })` → `GET /api/movies/:id/shows?date=YYYY-MM-DD`

Query parameters are encoded with URLSearchParams; invalid IDs/date formats are rejected before fetch. API failures retain HTTP status and server message through ApiError; connection failures receive a clear connection message.

Home, movie listing, filters, movie detail and showtime selection now consume database-backed API results while retaining their existing markup and styling.

## 4. Authentication UI integration

Added API methods:
- `registerUser()` → `POST /api/auth/register`
- `loginUser()` → `POST /api/auth/login`
- `getCurrentUser()` → `GET /api/auth/me`
- `logoutUser()` → `POST /api/auth/logout`

The login/register forms submit JSON while retaining client-side validation. Submit buttons are disabled during requests; server field errors and general API errors are displayed safely. Successful registration displays confirmation and a login link; successful login redirects to the home page.

The shared navigation checks `GET /api/auth/me`. Signed-out users see login/register links; authenticated users see their account name, My Bookings access and logout. A temporary current-user lookup failure does not block public browsing.

Logout reads the readable CSRF cookie and sends `x-csrf-token`. The HttpOnly JWT is never accessed by JavaScript.

## 5. Seat availability and booking UI integration

Added:
- `getShowSeats(showId)` → `GET /api/shows/:id/seats`
- `createBooking({ showId, seatIds })` → `POST /api/bookings`

The seat page removed pseudo-random booked-seat generation and temporary row/category assumptions. It loads real show metadata, seat IDs, row labels, seat numbers, categories, prices and availability from the API. It uses the movie ID returned by the show endpoint rather than inferring movie identity from a sample show-ID pattern.

The existing six-seat cap, accessible seat controls, keyboard navigation and booking summary were retained. The browser sends only show ID and selected seat IDs. The backend calculates the total and returns the booking reference; confirmation is displayed only after a successful server response. A 409 prompts a refresh/recheck; a 401 offers a login path.

### Owner-reported live booking verification

The Phase 7 Stage 4 record documents a successful booking of seats C6, C7 and C8. The backend returned reference `BMS-MWDCZ60F-1192106C45` and a server-calculated total of ₹660. Reloading the same show showed those seats unavailable, demonstrating persistence in the local database.

This was a demo reservation; no real payment was taken. The three seats remained reserved in the local database.

## 6. Booking history and details UI

Added API methods:
- `getUserBookings({ page, limit })`
- `getUserBooking(id)`

Added:
- `frontend/pages/my-bookings.html`
- `frontend/js/pages/my-bookings.js`
- `frontend/css/my-bookings.css`

The page displays booking reference, movie, cinema, showtime, seats, status and total. It supports pagination (10 records per page), an empty state and a details view at `my-bookings.html?id=<booking-id>`.

Details include booking date/reference, movie, cinema/address, showtime/screen, seat-by-seat historical prices, total and cancellation timestamp. Confirmed and cancelled states are distinct. Unauthenticated users are directed to login; missing/unauthorized details are shown as not found without exposing another user's booking. Dynamic text is escaped before rendering.

The Stage 5 record reports 12 frontend API tests passing and the booking details page verified in the browser, including the existing booking reference, movie, showtime, seats and total.

## 7. Regression tooling and QA

Phase 7 Stage 6 added unified commands in `backend/package.json`:
| Command | Purpose |
|---|---|
| `npm test` | Backend Node test suite |
| `npm run test:frontend` | Frontend API/authentication/validator tests |
| `npm run test:all` | Backend and frontend tests sequentially |
| `npm run test:release` | Automated tests followed by live MySQL database check |

The frontend test command includes:
- `frontend/tests/api.test.js`
- `frontend/tests/auth-api.test.js`
- `frontend/tests/validators.test.mjs`

The manual QA checklist covers environment/secrets, database checks, public browsing, authentication/session persistence/logout, seat availability, booking creation, booking history/detail, eligible cancellation, authorization and negative paths.

The Stage 6 report initially required the owner to run the new unified commands and finish manual browser acceptance. Later project records report successful release testing and browser checks before deployment preparation. The earlier Stage 4–5 evidence includes the successful live booking and 12 frontend API tests.

## 8. Scope boundaries and limitations

- Payment gateway and payment processing are not implemented.
- A successful booking is a demo reservation, not proof of payment or a paid ticket.
- The customer UI is integrated with the backend; the project remains a local application and was not publicly deployed.
- The in-memory rate limiter requires a shared store before multi-instance deployment.
- Manual browser checks depend on the owner's local database and browser session; do not rerun seed/reset scripts against a database containing bookings.

## 9. Phase 7 completion summary

Phase 7 connected movie discovery, search/filtering, movie details, showtimes, registration/login/session/logout, seat availability, booking creation, booking history and booking details to the backend. It removed the simulated customer booking path while preserving the existing frontend design and accessibility. Project records report successful customer workflow verification and later release regression checks. Payment processing and public deployment remain out of scope.
