# BOOK_MY_SEAT — Phase 4 Report
## MySQL Database Integration

| Item | Detail |
|---|---|
| Phase | 4 of 8 — MySQL integration |
| Database | MySQL Server 8.0.44 |
| Runtime in owner verification | Node.js v22.21.0 |
| Database / application account | `book_my_seat` / `bms_app` |
| Report status | Completed; local verification reported by project owner |

> **Verification provenance:** The owner reported that the Windows local database check returned **ALL CHECKS PASSED** and the automated suite returned **143 passed, 0 failed, 0 skipped across 34 suites**. These are owner-supplied local results, not independently rerun by this report.

## 1. Phase objective and outcome

Phase 4 replaced the backend's in-memory source for movie catalogue and upcoming-show reads with persistent MySQL queries. It established the relational database foundation used by authentication, booking and administration in later phases, while preserving the existing API response envelope and movie/show object shapes.

Delivered:
- An 11-table MySQL schema, seed data, verification script and dedicated application-user script.
- A shared `mysql2/promise` connection pool configured through environment variables.
- Parameterized movie, movie-detail and showtime queries.
- UTC storage conventions and India-calendar-day filtering.
- Database connectivity diagnostics and a startup readiness gate.
- Safe database-outage mapping to HTTP 503 and graceful SIGINT/SIGTERM shutdown.
- Automated tests for DB configuration, SQL construction, mapping, API behavior, errors and server lifecycle.

Phase 4 implemented database-backed reads. Authentication, booking writes, live seat availability, frontend API wiring and admin CRUD were intentionally left to later phases.

## 2. Relational database design

The authoritative schema is `database/schema.sql`. It creates the `book_my_seat` database and uses InnoDB, `utf8mb4` and `utf8mb4_unicode_ci`.

| Table | Responsibility |
|---|---|
| `users` | User identity, email, password hash and role |
| `movies` | Movie catalogue and descriptive metadata |
| `genres` | Normalized genre names |
| `movie_genres` | Many-to-many movie/genre junction |
| `cinemas` | Cinema name, city and address |
| `screens` | Screens belonging to cinemas |
| `seats` | Physical seat positions and categories |
| `shows` | Movie scheduled on a screen at a UTC DATETIME |
| `show_prices` | Category price for an individual show |
| `bookings` | Booking header, user, show, status and total |
| `booking_seats` | Seats in a booking and historical price snapshots |

Entity tables use BIGINT UNSIGNED identifiers. Junction/per-show category tables use composite keys where appropriate. Foreign keys connect movies to genres, cinemas to screens, screens to seats, movies/screens to shows, shows to prices, users/shows to bookings, and booking-seat rows to their booking, show and screen/seat relationships.

Important uniqueness rules include unique user email, genre name, screen name within a cinema, seat position within a screen, show start time within a screen, booking reference, and the unique key on `booking_seats(show_id, seat_id, active)`.

The schema also includes CHECK constraints for non-negative prices/totals and valid active-state/price-snapshot values. In `booking_seats`, `active = 1` represents a current reservation and `NULL` represents a released seat after cancellation. The unique key prevents two active reservations for the same show/seat while allowing cancelled history to remain.

Composite foreign keys ensure that a booking-seat row references a booking for the same show and a seat belonging to the screen assigned to that show. This provides database-level protection against invalid cross-show or cross-screen associations.

## 3. Normalization and design rationale

The schema separates entities with different lifecycles:
- Genres are stored once and linked through `movie_genres`, rather than stored as comma-separated text.
- Cinemas, screens and seats are separate relations.
- Shows reference movies and screens rather than duplicating their descriptive fields.
- `show_prices` stores category prices per show, allowing prices to vary between screenings.
- Booking headers and booking-seat rows separate booking-level information from individual seats.
- `price_snapshot` preserves the price at booking time, so later price changes do not alter historical bookings.

This describes the implemented relational decomposition and integrity controls. The source documentation does not include a separate formal normal-form proof for every relation, so this report does not claim an independently audited 3NF proof.

## 4. Seed data and verification scripts

Database scripts:
- `database/schema.sql` — creates the database and tables using `CREATE TABLE IF NOT EXISTS`; it does not drop existing tables.
- `database/seed.sql` — inserts sample movies, genres, cinemas, screens, seats, shows and prices.
- `database/verify_seed.sql` — performs 40 checks and prints summaries.
- `database/create_app_user.sql` — provisions/grants the dedicated application account.

Documented intended seed quantities:

| Data | Expected rows |
|---|---:|
| Movies | 9 |
| Genres | 10 |
| Cinemas | 3 |
| Screens | 19 |
| Seats | 1,520 |
| Shows | 270 |
| Show-price rows | 810 |

The seed creates a five-day show window based on the India calendar date when it runs. It is not a reset script. Its logic preserves booked shows and may skip conflicting new shows. Do not casually rerun it against a database containing bookings; routine verification must not drop or recreate the database.

## 5. Environment configuration and connection pool

`backend/config/env.js` reads:
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_CONNECTION_LIMIT`

The backend uses the dedicated `bms_app` account and rejects the MySQL `root` account. The password is stored as a non-enumerable configuration property to reduce accidental disclosure through logging/serialization. Actual credentials remain in the local `backend/.env`; only the example template belongs in Git.

`backend/config/db.js` uses a lazily initialized shared `mysql2/promise` pool. Documented options include waiting for available connections, a bounded connection limit, a 10-second connection timeout, disabled multiple statements, UTC timezone handling, date strings and decimal number conversion. `getPool()` returns the shared pool, `checkConnection()` runs a diagnostic read-only query, and `closePool()` closes the pool.

A shared pool avoids creating a new TCP connection for every request and bounds database concurrency.

## 6. Database-backed API and SQL safety

Implemented endpoints:
- `GET /api/health` — application liveness/uptime response; not a full database diagnostic.
- `GET /api/movies?search=&genre=&language=` — active movies with optional filters.
- `GET /api/movies/:id` — one active movie with its genres.
- `GET /api/movies/:id/shows?date=YYYY-MM-DD` — upcoming scheduled shows with cinema, screen and category prices.

SQL values are passed separately using parameterized `execute()`/`query()` calls. User values are not concatenated into SQL. LIKE metacharacters are escaped for literal search behavior, and `multipleStatements` is disabled. Controllers validate HTTP input and write responses; services own SQL and map rows to the existing API contract.

The established JSON envelope is retained:

```json
{ "success": true, "data": ... }
{ "success": false, "error": { "message": "..." } }
```

The show service reads prices from `show_prices` and maps the expected STANDARD, PREMIUM and RECLINER categories. A show missing a required category price is omitted rather than returned with an incomplete price object.

## 7. UTC and India date handling

MySQL DATETIME does not store timezone metadata. The project convention treats show timestamps stored in MySQL as UTC:
- Pooled connections use UTC.
- `dateStrings: true` avoids implicit JavaScript Date conversion.
- `toIsoUtc()` serializes database date/time text as ISO-8601 UTC ending in `Z`.
- API timestamps remain UTC; the browser displays them in the visitor's local timezone.
- The optional date filter represents an India calendar date. `indiaDayRangeUtc()` converts India midnight-to-midnight into a half-open UTC interval before querying.

A half-open interval (`>= from`, `< to`) avoids end-of-day precision problems.

## 8. Startup readiness, error handling and shutdown

`backend/server.js` calls `checkConnection()` before `app.listen()`. The process therefore does not accept HTTP requests until the configured database connection succeeds. Invalid configuration or unavailable MySQL causes startup to fail with a safe application-authored message and a non-zero exit status.

Database connectivity failures classified as unavailable map to HTTP 503. Other database errors (permissions, missing tables or query/programming errors) remain HTTP 500. AppError preserves its declared status; malformed JSON maps to 400; oversized JSON maps to 413. Driver messages, SQL, credentials and stack traces are not returned to clients.

SIGINT/SIGTERM trigger idempotent shutdown: stop accepting new requests, allow in-flight requests to finish where practical, close idle keep-alive connections when supported, then close the shared pool.

## 9. Security and operational safeguards

- Dedicated least-privilege application account; root account rejected.
- Secrets loaded from local environment and not committed.
- Parameterized SQL and disabled multi-statement execution.
- Safe API error responses.
- Helmet security headers and a 10 KB JSON body limit.
- Validation of IDs, repeated query parameters and calendar dates.
- Database constraints complement application validation.

## 10. Tests, results and limitations

The completion record reports **143 passed, 0 failed, 0 skipped across 34 suites**, plus local database verification of **ALL CHECKS PASSED**. The report's provenance is the project owner's Windows/MySQL environment.

Phase 4 does not implement authentication/JWT, booking creation/cancellation, seat locking/live availability, frontend API integration or admin management. The frontend still used sample data at this phase. Those responsibilities were assigned to Phases 5–8.

## 11. Phase 4 completion summary

Phase 4 established the persistent MySQL foundation, database-backed movie/show reads, safe SQL access, UTC date conventions, readiness checks, error classification and graceful shutdown. The owner reported successful local database and automated-test verification. Phase 4 is recorded as completed.
