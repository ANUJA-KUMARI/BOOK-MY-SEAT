# Phase 7 — Stage 2: Movie Browsing API Integration

**Branch:** `phase-7/stage-2-movie-api-integration`  
**Base:** `phase-7/stage-1-frontend-integration-audit`  
**Scope:** Movie list, filters, movie details and upcoming showtimes  
**Status:** Implementation committed; local browser verification pending.

## 1. Changes

### `frontend/js/api.js`

- Removed the `USE_SAMPLE_DATA` switch and all imports of the sample movie/show dataset.
- Removed simulated network delay and sample-data cloning.
- `getMovies()` now calls `GET /api/movies` and serializes search, genre and language filters with `URLSearchParams`.
- `getMovie()` now calls `GET /api/movies/:id`.
- `getMovieShows()` now calls `GET /api/movies/:id/shows`, optionally with a validated date.
- Retained the shared `ApiError` interface so existing page-level error handling continues to work.
- Kept same-origin credentials enabled. The API client does not expose or store authentication tokens.
- Network failures now produce a clear connection error rather than an unhandled raw fetch exception.
- Request headers can be extended by later stages without losing the default JSON Accept header.

### Existing pages

The existing home, movie-list and movie-detail pages already use the central API functions. Their visual markup and interaction patterns were therefore preserved; switching the API client routes them to MySQL-backed responses without duplicating fetch logic in page scripts.

## 2. Backend contract compatibility

The backend movie service returns the fields consumed by the current UI:

- Movie: `id`, `title`, `description`, `language`, `duration_min`, `certificate`, `release_date`, `poster_url`, `genres[]`.
- Show: `id`, `movie_id`, `start_time`, `status`, nested `cinema`, nested `screen`, and `prices`.

No backend routes, database tables, seed records, permissions or booking rules were changed.

## 3. Security and behavior

- All calls remain same-origin and use `credentials: 'same-origin'`.
- Query values are encoded through `URLSearchParams`; IDs are validated as positive safe integers before constructing paths.
- The frontend displays prices returned by the backend; booking price authority remains on the server.
- No sample fallback is retained. If the API is unavailable, the existing page error states are shown instead of silently displaying stale sample data.

## 4. Files changed

- `frontend/js/api.js`
- `docs/PHASE_7_STAGE_2_REPORT.md` (this report)

## 5. Local verification checklist

Run from the project root after pulling this branch:

1. Start the backend with `npm start` from `E:\\BOOK MY SEAT\\backend`.
2. Open `http://localhost:3000/`; confirm featured movies load.
3. Open `http://localhost:3000/pages/movies.html`; test title search, genre filter, language filter and clear filters.
4. Open a movie detail page; confirm movie information and upcoming showtimes load.
5. Select a date and showtime; confirm the displayed cinema, screen and database prices are correct.
6. Stop the backend temporarily and refresh a movie page; confirm a friendly error state appears. Restart the backend afterwards.

The current frontend is served by the backend's same-origin static hosting, so use the `localhost:3000` origin for these checks.

## 6. Exit criteria

Stage 2 is ready for local verification. It is considered complete after the user confirms the movie list, filters, movie details and showtimes work in the browser against the local MySQL-backed API. Do not begin Stage 3 until this verification is reported.
