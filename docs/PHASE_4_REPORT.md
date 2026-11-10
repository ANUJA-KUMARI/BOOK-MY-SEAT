# BOOK_MY_SEAT — Phase 4: MySQL Integration Report

**Status:** Implementation and sandbox regression tests completed; local Windows/MySQL verification and project-owner approval are still required.  
**Scope:** MySQL-backed read operations only. Create, update and delete workflows are deferred to their respective later phases.

## 1. Phase objective and architecture

Phase 4 replaces the backend's in-memory source for movie and show reads with MySQL 8.0 while preserving the existing Express API response contract. The frontend continues to use its existing sample data; frontend-to-API integration belongs to Phase 7.

Request flow:

1. `backend/app.js` configures Helmet, request logging, JSON parsing, API routes, static frontend serving, 404 handling and the central error handler.
2. Controllers validate request parameters and delegate to services.
3. `backend/services/movie.service.js` builds SQL and executes it through the shared pool in `backend/config/db.js`.
4. `mysql2/promise` returns rows; service mapping functions preserve the API's established field names and value types.
5. `backend/middleware/errorHandler.js` maps expected application errors and safely handles unexpected/database errors.

`backend/data/sample-data.js` is intentionally retained. It is not the source for the Phase 4 movie/show read endpoints, but remains part of the project for compatibility and later work.

## 2. Database configuration

- Database: `book_my_seat`.
- Target server: MySQL 8.0 (the developer previously verified 8.0.44 locally).
- Storage engine: InnoDB.
- Character set/collation: `utf8mb4` / `utf8mb4_unicode_ci`.
- Application account: dedicated `bms_app` account; application configuration rejects `root`.
- Credentials are read from `backend/.env`, not source code. `.env` and `.env.*` are ignored by Git; `.env.example` is explicitly allowed.
- `backend/config/env.js` reads `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` and `DB_CONNECTION_LIMIT`. The password is a non-enumerable property on the database config object.

`backend/config/db.js` creates a shared `mysql2/promise` pool. Pool configuration includes a bounded connection limit, queued waiting (`waitForConnections`), a 10-second connect timeout, `multipleStatements: false`, UTC timezone handling, date strings and numeric DECIMAL conversion. New physical connections set their session time zone to `+00:00`.

`getPool()` lazily creates the shared pool. `checkConnection()` runs a read-only diagnostic SELECT and returns connection facts. `closePool()` ends the shared pool and is safe when no pool exists or after it has already been closed. Database driver errors are translated into application-authored `DatabaseError` messages; the raw driver error is retained only as `cause` for internal diagnosis.

## 3. Database schema — all 11 tables

The authoritative definitions remain in `database/schema.sql`; this report documents them but does not replace them.

| Table | Purpose and key relationships |
|---|---|
| `users` | User identity and password hash; unique email. Authentication is not implemented in Phase 4. |
| `movies` | Movie catalogue, metadata, active flag and indexed title/active fields. |
| `genres` | Genre lookup table; unique genre name. |
| `movie_genres` | Many-to-many junction between movies and genres; composite primary key `(movie_id, genre_id)`. |
| `cinemas` | Cinema name, city and address; city index. |
| `screens` | Screens belonging to cinemas; unique screen name per cinema and composite `(id, cinema_id)` key for downstream integrity. |
| `seats` | Physical seats belonging to a screen; category enum and unique position per screen. Composite `(id, screen_id)` supports screen-consistency checks. |
| `shows` | Movie scheduled on a screen at a UTC `DATETIME`; unique screen/start time and composite `(id, screen_id)` key. |
| `show_prices` | One price per seat category per show; composite primary key `(show_id, category)`. |
| `bookings` | Future booking record associated with a user and show; unique booking reference and composite `(id, show_id)` key. |
| `booking_seats` | Future booking-to-seat association with show/screen consistency, active reservation marker and historical `price_snapshot`. |

### 3.1 Foreign keys and delete/update behavior

- `movie_genres.movie_id` → `movies.id`: update cascades; delete cascades.
- `movie_genres.genre_id` → `genres.id`: update cascades; delete restricted.
- `screens.cinema_id` → `cinemas.id`: update cascades; delete restricted.
- `seats.screen_id` → `screens.id`: update cascades; delete restricted.
- `shows.movie_id` → `movies.id`: update cascades; delete restricted.
- `shows.screen_id` → `screens.id`: update cascades; delete restricted.
- `show_prices.show_id` → `shows.id`: update cascades; delete cascades.
- `bookings.user_id` → `users.id`: update cascades; delete restricted.
- `bookings.show_id` → `shows.id`: update cascades; delete restricted.
- `booking_seats.(booking_id, show_id)` → `bookings.(id, show_id)`: update cascades; delete restricted.
- `booking_seats.(show_id, screen_id)` → `shows.(id, screen_id)`: update cascades; delete restricted.
- `booking_seats.(seat_id, screen_id)` → `seats.(id, screen_id)`: update cascades; delete restricted.

These composite foreign keys prevent a booking-seat row from associating a booking, show and seat from inconsistent shows/screens.

### 3.2 Unique constraints and indexes

Unique keys:

- `users.email` (`uq_users_email`).
- `genres.name` (`uq_genres_name`).
- `movie_genres(movie_id, genre_id)` (composite primary key).
- `screens(cinema_id, name)` and `screens(id, cinema_id)`.
- `seats(screen_id, row_label, seat_number)` and `seats(id, screen_id)`.
- `shows(screen_id, start_time)` and `shows(id, screen_id)`.
- `show_prices(show_id, category)` (composite primary key).
- `bookings.booking_ref` and `bookings(id, show_id)`.
- `booking_seats(show_id, seat_id, active)`.

Additional non-unique indexes support movie title/active filtering, cinema city lookup, show movie/start-time lookup and booking user/creation-time lookup.

### 3.3 CHECK constraints

- `chk_show_prices_nonnegative`: `price >= 0`.
- `chk_bookings_total_nonnegative`: `total_amount >= 0`.
- `chk_booking_seats_active`: `active = 1 OR active IS NULL`.
- `chk_booking_seats_price`: `price_snapshot >= 0`.

`booking_seats.active = 1` represents an active seat reservation; `NULL` represents a released seat after cancellation. The unique key allows historical released rows while preventing duplicate active reservations for a show/seat. Booking and cancellation workflows are not implemented in this phase.

## 4. Seed and verification process

Scripts are located in `database/`:

- `schema.sql` creates the database if needed and creates the 11 tables with `CREATE TABLE IF NOT EXISTS`; it does not drop the database or existing tables.
- `seed.sql` inserts the sample catalogue and schedule. The intended seed totals are 9 movies, 10 genres, 3 cinemas, 19 screens, 1,520 seats, 270 shows and 810 show-price rows. It uses a five-day show window based on the India calendar date at execution time.
- `verify_seed.sql` runs 40 checks covering expected counts, foreign-key consistency, screen/seat layout and categories, show scheduling, prices, duplicates and missing relationships. It also prints useful summaries of show dates, cinema prices, movies/genres and screens.

The seed script is not a harmless repeatable reset. Its logic preserves booked shows and may skip conflicting new shows; do not casually rerun it against a database containing real bookings. Phase 4 close-out does not require rerunning schema or seed scripts.

## 5. MySQL-backed API reads

The following endpoints are backed by MySQL:

- `GET /api/movies?search=&genre=&language=` — active movies, optional title/genre/language filters.
- `GET /api/movies/:id` — one active movie with all its genres.
- `GET /api/movies/:id/shows?date=YYYY-MM-DD` — upcoming scheduled shows, optionally restricted to one India calendar date, including cinema, screen and all three category prices.
- `GET /api/health` — application health endpoint; it is not a substitute for the startup database check.

The services use parameterized `execute()`/`query()` calls. User-provided values are passed as parameters, not concatenated into SQL. LIKE wildcard characters are escaped before being placed in the parameter value. `multipleStatements` is disabled. The show query uses UTC comparisons and translates an India calendar-day range to UTC bounds.

Response compatibility is preserved: the existing success/error envelope and movie/show object shapes remain unchanged. IDs and prices are converted to numbers; date/time fields retain the established string formats.

## 6. Startup readiness and graceful shutdown

`backend/server.js` now verifies MySQL connectivity with `checkConnection()` before calling `app.listen()`. Therefore no HTTP request can be accepted before the configured database has passed the startup check. If the database cannot be reached or the database configuration is invalid, startup prints a safe application-authored message, closes the pool where possible and sets a non-zero process exit code. Credentials, SQL and driver stack traces are not printed.

The server lifecycle handles `SIGINT` and `SIGTERM`. Shutdown is idempotent: repeated calls share the same shutdown promise. `server.close()` stops new connections and waits for in-flight requests to finish where practical; idle keep-alive connections are closed on supported Node versions. The shared MySQL pool is then explicitly closed with `closePool()`. Shutdown errors are reported without printing driver details or credentials.

## 7. Error handling and HTTP status codes

`backend/middleware/errorHandler.js` preserves the established JSON error contract:

- Genuine `DatabaseError` connectivity failures marked `unavailable === true`: HTTP **503** with a generic temporary-unavailability message.
- Other database errors (for example access denied, missing table or query/programming errors): remain HTTP **500**; they are not mislabeled as outages.
- `AppError`: retains its declared application status, message and optional details (for example validation 400 or missing resource 404).
- Malformed JSON: HTTP 400.
- Oversized JSON body: HTTP 413.
- Unexpected errors: generic HTTP 500.

Database driver messages, SQL text, credentials and stack traces are not included in API responses. Database errors are logged using only safe metadata; unexpected errors are logged by error name rather than serializing potentially sensitive error contents.

## 8. Tests and results

New tests:

- `tests/error-handler.test.js`: database outage → 503, non-outage database errors remain 500, AppError status/details preserved, unexpected errors generic.
- `tests/server-lifecycle.test.js`: HTTP listener remains unavailable while startup check is pending; failed startup creates no listener; successful shutdown closes HTTP server and pool; repeated shutdown calls are idempotent; child-process startup fails with non-zero status and does not print a test password when MySQL is unavailable.

The existing suite also covers API validation/response behavior, DB configuration, pool options, error classification, read-service SQL construction and mapping, time conversion, parameterization and optional live-MySQL checks.

**Sandbox result:** `node --test` completed with **94 passing tests and 0 failures** in the uploaded project copy. Live-MySQL suites were skipped in the sandbox because the uploaded archive's local `.env` was deliberately not copied into the working environment. This result does not verify the developer's local MySQL instance or the actual Windows environment.

## 9. Known limitations and deferred scope

- Phase 4 implements database-backed read operations only. Create, update and delete workflows are deferred to their respective later phases.
- No authentication, JWT, password hashing or authorization workflows are implemented; these belong to Phase 5.
- No booking creation, cancellation, seat locking or live seat availability workflow is implemented in Phase 4.
- The frontend still uses its existing sample data; API integration belongs to Phase 7.
- Sandbox tests cannot validate the user's local MySQL credentials, grants, seed state, Windows process behavior or live database contents. The developer must run the local verification commands before sign-off.
- The current test archive contains the developer's installed dependencies, but `node_modules` is not part of the deliverable ZIP generated for handover; use `npm ci` if dependencies need reinstalling.

## 10. Phase 4 close-out decision

The approved close-out implementation and isolated automated tests are present. **Phase 4 is not declared complete yet.** The project owner must run the Windows PowerShell checks against the local `book_my_seat` database, confirm the live database tests and API behavior, inspect the resulting files, and explicitly approve the phase.
