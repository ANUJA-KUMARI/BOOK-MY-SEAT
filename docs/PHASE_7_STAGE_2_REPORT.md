# Phase 7 — Stage 2: Live Movie & Showtime Integration

**Branch:** `phase-7/stage-2-movie-showtime-integration`  
**Base:** `phase-7/stage-1-frontend-integration-audit`  
**Stage status:** Implementation and local frontend/browser verification completed (project owner confirmed).

## 1. Objective

Replace the frontend's Phase 2 sample-data source for movie browsing, movie details and showtimes with the existing same-origin Express/MySQL APIs. Preserve the Netflix-inspired UI, page behavior and existing backend contracts.

## 2. Changes

### `frontend/js/api.js`

- Removed the sample-data imports and the `USE_SAMPLE_DATA` switch.
- Removed the artificial network delay and sample-data filtering/building paths.
- All three existing page-facing methods now call the live API:
  - `getMovies()` → `GET /api/movies`
  - `getMovie(id)` → `GET /api/movies/:id`
  - `getMovieShows(id, { date })` → `GET /api/movies/:id/shows?date=YYYY-MM-DD`
- Preserved the page-facing method names and returned data shape, so the home, movie-list and movie-detail pages do not need visual rewrites.
- Preserved same-origin cookie credentials for future authenticated integration.
- Query parameters are encoded with `URLSearchParams`.
- Invalid IDs and invalid date formats are rejected before a network request.
- API failures retain their HTTP status and server message through `ApiError`; connection failures receive a clear connection message.

### `frontend/tests/api.test.js`

Added focused Node test-runner coverage for:
- Live movie-list URL and filter encoding.
- Same-origin credentials and JSON Accept header.
- Movie detail URL and returned data.
- Showtime URL and optional date.
- Invalid ID/date rejection before fetch.
- Server error status/message preservation.

## 3. Existing pages now backed by MySQL

No page markup or CSS was changed. The existing pages already consume the API abstraction and therefore now receive real backend data:

- Home featured movies and genre links.
- Movie listing, title search, genre filter and language filter.
- Movie detail and upcoming showtime selection.
- Cinema/screen information and server-provided ticket category prices.

The current backend returns all active movies and upcoming scheduled shows with complete category prices. The UI continues to render its existing loading, empty and error states.

## 4. Explicitly not included in Stage 2

- Authentication UI/session integration (Stage 3).
- Seat availability and booking UI (Stage 4).
- Booking history/detail/cancellation UI (Stage 5).
- Backend/database/schema/seed/grant changes.
- Payment processing.
- Visual redesign.

The seat-selection page remains simulated until Stage 4. Stage 2 does not claim that end-to-end booking is integrated.

## 5. Local verification

From the project root:

```powershell
Set-Location "E:\BOOK MY SEAT"
git fetch origin
git switch phase-7/stage-2-movie-showtime-integration
git pull origin phase-7/stage-2-movie-showtime-integration
node --experimental-default-type=module --test frontend/tests/api.test.js
```

Then start the backend in a separate PowerShell terminal:

```powershell
Set-Location "E:\BOOK MY SEAT\backend"
npm start
```

Browser smoke checks:
1. Open `http://localhost:3000/` and confirm featured movies and genres load.
2. Open `http://localhost:3000/pages/movies.html`; test title search, genre and language filters.
3. Open a movie card and confirm database movie details and upcoming shows load.
4. Select a date/showtime and confirm the displayed cinema, screen and category prices.
5. Open browser DevTools → Network and confirm the page requests use `/api/movies` and `/api/movies/:id/shows`, not sample-data files.

Also run the existing backend regression and database checks:

```powershell
Set-Location "E:\BOOK MY SEAT\backend"
npm test
npm run db:check
```

## 6. Acceptance criteria

- [x] Sample data is no longer imported by the movie API client.
- [x] Movie list, detail and showtime functions call the live API.
- [x] Existing page-facing function names and data contracts are preserved.
- [x] Focused API client tests are added.
- [x] Focused frontend API tests pass locally (5 passed, 0 failed; project owner supplied terminal result).
- [ ] Backend regression and database checks for this stage were not separately reconfirmed.
- [x] Browser smoke checks pass for home, filters, movie detail and showtimes (project owner confirmed completion).

**Stage 2 is complete.**
