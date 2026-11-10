# BOOK_MY_SEAT — Phase 4 Completion Report

| Item | Detail |
|---|---|
| Project | BOOK_MY_SEAT — Full-Stack Movie Ticket Booking Platform |
| Phase | 4 — MySQL Integration |
| Status | **COMPLETED — local verification reported by project owner** |
| Database | MySQL Server 8.0.44 |
| Runtime | Node.js v22.21.0 |
| Database name / account | `book_my_seat` / `bms_app` |
| Local database check | **ALL CHECKS PASSED** |
| Automated tests | **143 passed · 0 failed · 0 skipped** |
| Test suites | 34 |
| Project root | `E:\BOOK MY SEAT` |

> **Verification provenance.** The Windows/MySQL results in this report are the project owner's supplied local verification results. They are not represented as tests independently executed by the documentation author or in a sandbox. Source-code descriptions below were prepared by inspecting the supplied project archive, including the schema, seed and verification SQL, backend source, tests and earlier phase reports.

---

## 1. Phase 4 objectives and outcome

Phase 4 introduced persistent MySQL storage for the backend's movie catalogue and upcoming-show reads. It replaced the backend's in-memory source for those read operations while preserving the established API response envelope and object shapes.

The phase also established the database foundation needed by later booking work: users, screens, seats, shows, show-specific prices, bookings and booking-seat history are represented in the schema, even though their write workflows are not implemented in Phase 4.

**Completed in this phase**

- Created the 11-table MySQL schema and supporting seed, verification and application-user scripts.
- Configured `mysql2/promise`, environment-based credentials and a shared connection pool.
- Implemented parameterized MySQL-backed movie and show reads.
- Added India-calendar-day filtering over UTC-stored show timestamps.
- Added database connection diagnostics (`npm run db:check`).
- Added startup database verification before the HTTP listener is opened.
- Added safe database-outage error mapping to HTTP 503.
- Added idempotent SIGINT/SIGTERM shutdown, including HTTP server and pool closure.
- Added automated tests for database configuration, SQL, service mapping, API behavior, error handling and server lifecycle.

**Explicitly out of scope**

Phase 4 implements **read operations only**. Create, update and delete workflows are deferred to their respective later phases. Authentication, booking transactions, live seat availability, frontend-to-API integration and admin management are not Phase 4 deliverables.

## 2. Database architecture

### 2.1 Platform and conventions

- MySQL 8.0.44 on the verified development machine.
- InnoDB tables, providing transactional storage and foreign-key enforcement.
- `utf8mb4` character set and `utf8mb4_unicode_ci` collation.
- Database: `book_my_seat`.
- Backend account: dedicated `bms_app`; backend configuration rejects the `root` account.
- Show `DATETIME` values follow an application convention: they represent UTC, even though MySQL `DATETIME` itself stores no timezone metadata.

The authoritative schema is `database/schema.sql`. The report documents it; it does not replace it.

### 2.2 The 11 tables

| # | Table | Responsibility |
|---:|---|---|
| 1 | `users` | User identity, email, password hash and role. Authentication is a later phase. |
| 2 | `movies` | Movie catalogue, descriptive metadata, release date, poster URL and active flag. |
| 3 | `genres` | Normalized list of genre names. |
| 4 | `movie_genres` | Junction table implementing the many-to-many movie/genre relationship. |
| 5 | `cinemas` | Cinema name, city and address. |
| 6 | `screens` | Screens belonging to a cinema. |
| 7 | `seats` | Physical seat positions and category within a screen. |
| 8 | `shows` | A movie scheduled on a screen at a UTC `DATETIME`, with a schedule status. |
| 9 | `show_prices` | Price for each seat category for an individual show. |
| 10 | `bookings` | Booking header associated with a user and show; includes status and total. |
| 11 | `booking_seats` | Seats attached to a booking, including show/screen consistency and a historical price snapshot. |

### 2.3 Relationships and foreign keys

- `movie_genres.movie_id` → `movies.id` (update cascade, delete cascade).
- `movie_genres.genre_id` → `genres.id` (update cascade, delete restrict).
- `screens.cinema_id` → `cinemas.id` (update cascade, delete restrict).
- `seats.screen_id` → `screens.id` (update cascade, delete restrict).
- `shows.movie_id` → `movies.id` and `shows.screen_id` → `screens.id` (update cascade, delete restrict).
- `show_prices.show_id` → `shows.id` (update cascade, delete cascade).
- `bookings.user_id` → `users.id` and `bookings.show_id` → `shows.id` (update cascade, delete restrict).
- `booking_seats(booking_id, show_id)` → `bookings(id, show_id)`.
- `booking_seats(show_id, screen_id)` → `shows(id, screen_id)`.
- `booking_seats(seat_id, screen_id)` → `seats(id, screen_id)`.

The three composite foreign keys on `booking_seats` are important integrity controls. They ensure that the booking belongs to the referenced show and that the selected seat belongs to the screen on which that show is scheduled. This prevents a logically invalid cross-show or cross-screen association even if an application bug attempts to insert it later.

### 2.4 Primary keys, uniqueness and indexes

Primary-key design:

- Surrogate `BIGINT UNSIGNED AUTO_INCREMENT` identifiers are used for entity tables (`users`, `movies`, `genres`, `cinemas`, `screens`, `seats`, `shows`, `bookings`).
- Junction and per-show category tables use composite primary keys: `movie_genres(movie_id, genre_id)` and `show_prices(show_id, category)`.
- `booking_seats` has its own row identifier because it represents a historical booking-seat association.

Important unique constraints:

- `users.email`.
- `genres.name`.
- `screens(cinema_id, name)` and the composite candidate key `screens(id, cinema_id)`.
- `seats(screen_id, row_label, seat_number)` and `seats(id, screen_id)`.
- `shows(screen_id, start_time)` and `shows(id, screen_id)`.
- `show_prices(show_id, category)`.
- `bookings.booking_ref` and `bookings(id, show_id)`.
- `booking_seats(show_id, seat_id, active)`.

Supporting non-unique indexes include movie title and active status, cinema city, show movie/start time, and booking user/creation time.

### 2.5 CHECK constraints

The schema declares these CHECK constraints:

- `chk_show_prices_nonnegative`: `price >= 0`.
- `chk_bookings_total_nonnegative`: `total_amount >= 0`.
- `chk_booking_seats_active`: `active = 1 OR active IS NULL`.
- `chk_booking_seats_price`: `price_snapshot >= 0`.

In `booking_seats`, `active = 1` means the seat association is currently active; `NULL` represents a released seat after cancellation. The unique key over `(show_id, seat_id, active)` prevents two active rows for the same seat and show while allowing historical released rows with `NULL`. The actual booking/cancellation state transitions are deferred to the booking phase.

## 3. Normalization and design decisions

The schema separates concepts that have different lifecycles and avoids storing repeating groups in a single row:

- Genres are stored once in `genres`; `movie_genres` resolves the many-to-many relationship rather than storing comma-separated genre names in `movies`.
- Cinemas, screens and seats are separate entities, so a screen belongs to one cinema and a seat belongs to one screen.
- Shows refer to movies and screens rather than duplicating their descriptive data.
- `show_prices` stores category prices per show. Pricing can therefore vary between shows instead of being hard-coded globally or attached permanently to a seat.
- Booking headers and booking-seat rows are separate, allowing one booking to contain multiple seats.
- `price_snapshot` records the amount applicable when a seat was booked, so later price changes do not rewrite historical booking amounts.

These are relational normalization and data-integrity decisions consistent with the project's normalized design. The schema uses keys, constraints and separate relations to reduce update anomalies. The exact normal-form proof for every relation is not separately recorded in the source archive; this report therefore describes the implemented decomposition rather than claiming a formal audited 3NF proof.

## 4. Seed data and verification

The database scripts are:

- `database/schema.sql` — creates the database if needed and creates the tables with `CREATE TABLE IF NOT EXISTS`; it does not drop existing tables.
- `database/seed.sql` — inserts the sample catalogue, cinemas, screens, seats, shows and prices.
- `database/verify_seed.sql` — runs 40 verification checks and prints useful summaries.
- `database/create_app_user.sql` — provisions/grants the dedicated application account.

The intended seed quantities documented by the project are:

| Data | Expected count |
|---|---:|
| Movies | 9 |
| Genres | 10 |
| Cinemas | 3 |
| Screens | 19 |
| Seats | 1,520 |
| Shows | 270 |
| Show-price rows | 810 |

The seed creates a five-day show window based on the India calendar date when it runs. Because dates move forward, the number of *upcoming* shows returned by the API changes over time.

**Important operational warning:** the seed is not a reset script. Its logic preserves booked shows and may skip conflicting new shows. Do not casually rerun it against a database containing real bookings. The verification process should be run against the existing database; do not drop/recreate the database for routine checks.

The project owner reports that the local database check completed with **ALL CHECKS PASSED** on the verified machine.

## 5. MySQL configuration and connection pooling

### 5.1 Configuration

`backend/config/env.js` reads the database settings from environment variables and the backend-local `.env` file:

| Variable | Purpose | Default / expectation |
|---|---|---|
| `DB_HOST` | MySQL host | `127.0.0.1` |
| `DB_PORT` | MySQL TCP port | `3306` |
| `DB_USER` | Application account | Set to `bms_app` |
| `DB_PASSWORD` | Application password | Required; private |
| `DB_NAME` | Database name | `book_my_seat` |
| `DB_CONNECTION_LIMIT` | Pool connection limit | `10` |

The password is deliberately stored as a non-enumerable property in the configuration object, reducing the risk of accidental disclosure through `console.log(config)` or JSON serialization. `assertDbConfig()` rejects missing credentials and refuses to connect as `root`.

Do not copy actual credentials into documentation, source control or issue reports. Keep `backend/.env` local. Use `backend/.env.example` as the variable-name template.

### 5.2 Pool configuration

`backend/config/db.js` uses `mysql2/promise` and a lazily created shared pool. The configured behavior includes:

- `waitForConnections: true`: queries wait when all pool connections are busy.
- `connectionLimit`: bounds the number of concurrent connections.
- `queueLimit: 0`: no fixed queue-length cap.
- `connectTimeout: 10000`: connection attempt timeout.
- `multipleStatements: false`: disables multi-statement execution through a single query call.
- `timezone: 'Z'` and a per-connection `SET time_zone = '+00:00'`.
- `dateStrings: true`: avoids implicit JavaScript date conversion for MySQL date/time values.
- `decimalNumbers: true`: returns DECIMAL values as JavaScript numbers.

`getPool()` returns the shared pool. `checkConnection()` runs a diagnostic read-only SELECT. `closePool()` calls `pool.end()` and safely handles the absence of an initialized pool.

A pool is used instead of opening a new TCP connection for each request because it reuses a bounded set of connections and avoids repeated connection setup overhead.

## 6. Parameterized SQL and database-backed API

### 6.1 Query safety

The service layer passes values separately from SQL text using mysql2 placeholders and `execute()` / `query()` calls. Client input is not interpolated into SQL strings. `backend/utils/sql.js` also escapes `%`, `_` and `!` in LIKE search values so that a user searching for those characters gets literal matching rather than accidentally invoking wildcard behavior.

`multipleStatements` is disabled as an additional safeguard. Parameterization is the primary defense against SQL injection; input validation remains necessary for correctness and predictable API behavior.

### 6.2 Implemented endpoints

| Endpoint | Database behavior | Result |
|---|---|---|
| `GET /api/health` | Application health/uptime response; not a full database diagnostic query | `200` when the process is serving |
| `GET /api/movies?search=&genre=&language=` | Reads active movies; optional title, genre and language filters | Movie list |
| `GET /api/movies/:id` | Reads one active movie and its genres | Movie details; `404` if absent/inactive |
| `GET /api/movies/:id/shows?date=YYYY-MM-DD` | Reads future scheduled shows, cinema, screen and prices | Upcoming show list |

The API continues to use the established JSON envelope:

```json
{ "success": true, "data": ... }
{ "success": false, "error": { "message": "..." } }
```

The controller layer parses and validates request parameters, calls the service and writes the response. The service layer owns SQL and mapping. This separation keeps HTTP concerns out of SQL code and makes the service functions testable without Express request objects.

### 6.3 Movie and show data flow

For movie listing, the service builds a parameterized query over active movies and optional filters. Genre filtering uses the normalized `genres` / `movie_genres` relationship. Movie rows are mapped into the API's existing object shape, including numeric IDs and a `genres` array.

For a movie detail request, the service checks the requested active movie and loads its associated genres, then maps the result into the existing movie response shape.

For upcoming shows:

1. The service verifies that the movie exists and is active.
2. It queries scheduled shows whose start time is in the future, optionally constrained to the requested India calendar day.
3. It joins show, movie, screen and cinema information so each show can include cinema and screen details.
4. It loads `show_prices` for the returned show IDs.
5. It maps the three expected categories (`STANDARD`, `PREMIUM`, `RECLINER`) into a `prices` object.
6. A show missing any required category price is omitted rather than returned with a misleading partial price object.

The service maps database IDs and prices to JavaScript numbers and preserves the API's established field names. The frontend still uses its own sample data; the API is not yet the website's live data source.

## 7. UTC and India time-zone handling

MySQL `DATETIME` has no timezone metadata. The project therefore adopts a clear convention: show timestamps stored in the database are UTC.

- Each pooled connection is configured to use UTC.
- `dateStrings: true` returns database date/time values as text.
- `toIsoUtc()` interprets the MySQL `DATETIME` text as UTC and serializes it as an ISO-8601 timestamp ending in `Z`.
- The API returns UTC timestamps; it does not pre-convert show times to India local display time.
- The browser is expected to display the ISO timestamp in the visitor's local timezone.
- The optional `?date=YYYY-MM-DD` filter means an India calendar date. `indiaDayRangeUtc()` converts India midnight-to-midnight into a half-open UTC interval before querying MySQL.

India Standard Time is UTC+05:30 and does not currently observe daylight saving time. For example, the India calendar day `2026-11-03` maps to the UTC interval beginning `2026-11-02 18:30:00` and ending just before `2026-11-03 18:30:00`. A half-open range (`>= from` and `< to`) avoids end-of-day precision problems.

## 8. Error handling and HTTP 503

`backend/config/db.js` translates MySQL driver errors into a `DatabaseError` with an application-authored message and an `unavailable` classification. The raw driver error is retained as an internal `cause`; it is not returned to clients.

The central `backend/middleware/errorHandler.js` preserves the response contract and classifies errors as follows:

| Condition | HTTP status | Client behavior |
|---|---:|---|
| Genuine database connectivity/outage error marked unavailable | **503 Service Unavailable** | Generic temporary database-unavailable message |
| Other database error (permissions, missing table, query/programming issue) | 500 | Generic server error; not mislabeled as outage |
| `AppError` | Its declared status | Preserves expected validation/not-found message and optional details |
| Malformed JSON body | 400 | Safe invalid-JSON message |
| JSON body too large | 413 | Safe size-limit message |
| Unexpected programming error | 500 | Generic message |

This distinction matters: an incorrect password, missing schema object or programming bug should not automatically be described as a temporary network outage. The HTTP response never includes credentials, SQL statements, driver messages or stack traces.

## 9. Startup database verification

`backend/server.js` calls `checkConnection()` before calling `app.listen()`. This is a readiness gate: the process does not begin accepting HTTP requests until the configured database connection succeeds.

If database configuration is incomplete or MySQL is unavailable:

- startup fails;
- a safe, application-authored message is printed;
- the connection pool is closed where possible;
- the process receives a non-zero exit code;
- credentials and raw driver stack traces are not printed.

This avoids a misleading state in which the web server appears healthy while every database-backed request is destined to fail. The `GET /api/health` endpoint is an application liveness response; the startup gate is the database readiness check.

## 10. Graceful shutdown

The server lifecycle handles `SIGINT` and `SIGTERM`.

1. The first signal starts shutdown.
2. Repeated signals do not start another shutdown operation.
3. `server.close()` stops accepting new connections and waits for in-flight requests to finish where practical.
4. Idle keep-alive connections are closed when the Node runtime supports `closeIdleConnections()`.
5. `closePool()` explicitly ends the shared MySQL pool.
6. Shutdown failures set a non-zero exit code and log a safe message without dumping database driver internals.

The lifecycle functions are injectable, allowing automated tests to simulate database checks and pool closure without modifying or connecting to the developer's actual database.

## 11. Security and operational safeguards

- Dedicated `bms_app` database account; `root` is rejected by backend configuration.
- Secrets are environment-based and the real `.env` is excluded by ignore rules.
- Password configuration is non-enumerable in the loaded config object.
- SQL values are parameterized; LIKE metacharacters are escaped for literal search.
- Multiple SQL statements per query are disabled.
- Database and unexpected API errors are sanitized before responses.
- Database outage classification is narrow; authentication/configuration/programming failures are not automatically treated as outages.
- Helmet security headers remain enabled.
- JSON request body size is limited to 10 KB.
- Input validators reject malformed IDs, repeated query parameters and invalid calendar dates.
- The schema's foreign keys, unique keys and CHECK constraints provide database-level integrity in addition to application validation.

Authentication, authorization, rate limiting and booking transaction safety remain future work; the presence of `users`, `bookings` and `booking_seats` tables does not mean those workflows are active.

## 12. Testing strategy and verified results

The project uses Node.js's built-in test runner (`node --test`). The inspected test files cover:

- API response contracts, validation, status codes and not-found behavior.
- Database configuration validation and pool options.
- Database error classification.
- Parameterized SQL construction and LIKE escaping.
- Movie query building and database-row mapping.
- UTC serialization and India-day range conversion.
- Error-handler behavior, including outage 503 and non-outage status preservation.
- Startup readiness ordering and failure behavior.
- Graceful shutdown, pool closure and repeated signal handling.
- Optional live database checks.

### 12.1 Project-owner local verification

The project owner supplied the following results from the actual Windows development machine:

| Check | Reported result |
|---|---|
| Operating system | Windows |
| Node.js | v22.21.0 |
| MySQL Server | 8.0.44 |
| Database | `book_my_seat` |
| Application DB user | `bms_app` |
| `npm run db:check` | **ALL CHECKS PASSED** |
| Automated test suites | 34 |
| Tests passed | **143** |
| Tests failed | **0** |
| Tests skipped | **0** |

These are recorded as **owner-reported local verification results**. They supersede earlier sandbox-only test counts in the preliminary `docs/PHASE_4_REPORT.md`. That earlier report is preserved as a historical artifact and is not overwritten.

### 12.2 Reproduction commands

From Windows PowerShell:

```powershell
Set-Location "E:\BOOK MY SEAT\backend"
npm ci
npm run db:check
npm test
npm start
```

Stop the running server with `Ctrl+C` to exercise SIGINT graceful shutdown. The owner should retain the actual command output alongside project records if an auditable verification log is required.

## 13. Technical decisions and rationale

| Decision | Reason |
|---|---|
| InnoDB | Supports foreign keys and transactional behavior needed by later booking work. |
| Normalized lookup and junction tables | Avoid repeated genre/cinema/screen/seat data and preserve relational integrity. |
| Per-show category pricing | Prices can vary by show and cinema rather than being globally fixed. |
| `price_snapshot` | Preserves historical booking price even if future show prices change. |
| Composite foreign keys | Prevent cross-screen and cross-show booking-seat inconsistencies. |
| Shared bounded connection pool | Reuses connections while limiting concurrent database sessions. |
| Parameterized SQL | Separates data from SQL syntax and prevents input from becoming executable SQL. |
| UTC storage convention | Avoids ambiguity across server and visitor timezones. |
| India-day to UTC range conversion | Makes date filters match the intended India calendar day without changing stored timestamps. |
| Startup readiness gate | Prevents HTTP traffic reaching an application whose required database is unavailable. |
| Idempotent graceful shutdown | Avoids duplicate pool closure and gives active requests time to finish. |
| Preserve API response shape | Keeps existing consumers compatible; frontend switching remains a later phase. |

## 14. Completed scope versus later work

| Capability | Phase 4 status |
|---|---|
| MySQL schema and 11 tables | Completed |
| Seed and verification scripts | Completed |
| MySQL config and pool | Completed |
| Movie list/detail reads | Completed |
| Upcoming show reads and category prices | Completed |
| Startup DB readiness check | Completed |
| HTTP 503 outage handling | Completed |
| Graceful HTTP/pool shutdown | Completed |
| Automated and local verification | Owner reports passed |
| User registration/login, password hashing, JWT | Phase 5 |
| Seat availability and booking/cancellation transactions | Phase 6 |
| Frontend-to-backend API switch | Phase 7 |
| Admin management | Phase 8 |
| Additional release/deployment hardening | To be scoped under the approved roadmap; see `PROJECT_ROADMAP.md` |

## 15. Known limitations

- The API is read-only for the Phase 4 movie/show domain. No create/update/delete workflows are implemented.
- The frontend continues to use its local sample data. It does not yet call the database-backed API.
- `GET /api/health` is an application health endpoint; it should not be interpreted as a continuous database health monitor.
- No authentication or authorization is active, despite the schema's `users` and `role` fields.
- No booking, cancellation, seat-locking, concurrency or payment workflow is implemented.
- The database contains future-phase tables, but their write paths and lifecycle rules still need implementation and tests.
- The seed schedule is date-relative and must not be treated as a static set of permanently upcoming shows.
- The prior Phase 4 report has a historical sandbox count; the final local count in this report is based on the project owner's verification.

## 16. Phase 4 completion decision

**Phase 4 is formally documented as completed**, based on the project owner's explicit confirmation that the local database checks passed and the complete automated suite reported 143 passed, zero failed and zero skipped across 34 suites.

The project is ready to proceed to **Phase 5 — Authentication**. This report closes Phase 4 only; it does not imply that later authentication, booking, integration, admin or release work has been started.
