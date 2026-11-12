# Phase 6 — Stage 1: Booking Requirements, Schema and Security Audit

**Branch:** `phase-6/stage-1-booking-audit`  
**Status:** Audit completed; implementation plan prepared; no booking code or database grants changed.

## 1. Objective

Phase 6 implements persistent show-specific seat availability and booking management on the existing MySQL schema. It must make the database—not the browser—the final authority for seat ownership, seat availability, pricing, booking ownership and concurrent booking conflicts.

Phase 7 remains responsible for connecting the existing frontend to these endpoints. Phase 8 remains responsible for admin functionality.

## 2. Source-of-truth requirements

The following decisions are recorded in `docs/phase-reports/PHASE_1_REPORT.md` and the Phase 4 schema.

- A booking is for one show and one or more seats.
- A maximum of **6 seats per booking** is enforced by the server.
- A seat's availability is specific to a show, not globally to the physical seat.
- Only seats belonging to the screen assigned to the selected show may be booked.
- The server reads prices from `show_prices`; client-supplied prices are not accepted.
- Each booking-seat row stores a `price_snapshot` so historical totals remain stable.
- Duplicate seat IDs in one request are rejected with HTTP 400.
- Seat IDs are sorted before insertion to reduce deadlock risk.
- Concurrent duplicate booking attempts are resolved by the database unique constraint and surfaced as HTTP 409.
- Cancellation is allowed only for the owner's `CONFIRMED` booking until **2 hours before showtime**.
- A booking that does not exist and a booking owned by another user should both return 404, avoiding ownership disclosure.
- Cancellation releases seats by setting `booking_seats.active = NULL`; active reservations use `active = 1`.
- Booking and cancellation operations use transactions and UTC time comparisons.

## 3. Existing schema audit

The current `database/schema.sql` already contains the 11 tables needed for Phase 6. No schema change is currently required.

### Relevant tables

| Table | Relevant columns / constraints | Phase 6 use |
|---|---|---|
| `shows` | `id, screen_id, start_time, status`; unique screen/start | Validate selected show is scheduled and in the future |
| `screens` | `id, cinema_id` | Resolve show location |
| `seats` | `id, screen_id, row_label, seat_number, category` | Validate seat membership and category |
| `show_prices` | Primary key `(show_id, category)`, nonnegative price | Authoritative server-side category pricing |
| `bookings` | `booking_ref` unique, `user_id`, `show_id`, status, total, timestamps | Booking ownership and lifecycle |
| `booking_seats` | `show_id, screen_id, seat_id, price_snapshot, active` | Seat reservation, historical price and release |

### Database-enforced integrity

- `UNIQUE(show_id, seat_id, active)` prevents two active reservations for the same seat and show.
- MySQL permits multiple NULL values in a unique index, so a cancelled seat can be reserved again.
- Composite foreign keys enforce that the booking belongs to the same show and that the seat belongs to the screen used by that show.
- `CHECK` constraints prevent negative totals/prices and invalid active states.
- Foreign keys preserve user, show, booking and seat relationships.

## 4. Existing application architecture

The backend uses Express 5, MVC controllers, asynchronous services, parameterized `mysql2/promise` queries, a shared pool, `AppError`, and a centralized error handler.

Phase 5 provides:
- `authenticate` middleware that sets `req.auth.id` and `req.auth.role` from a verified JWT.
- A single-origin application served by Express.
- Existing response helpers and error envelope.
- Cookie-based authentication and CSRF middleware.

Phase 6 booking routes will require authentication. The seat availability read endpoint can remain public, matching the Phase 1 API contract.

## 5. Planned API contract

All routes are mounted under `/api`.

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/shows/:id/seats` | No | Seat layout, category and show-specific availability |
| POST | `/bookings` | Yes | Create a booking for `showId` and `seatIds[]` |
| GET | `/bookings` | Yes | List only the authenticated user's bookings |
| GET | `/bookings/:id` | Yes | Retrieve one booking belonging to the authenticated user |
| DELETE | `/bookings/:id` | Yes | Cancel an eligible owned booking and release its seats |

Success and error response envelopes remain consistent with the existing API:
- `{ success: true, data: ... }`
- `{ success: false, error: { message: ... } }`

No payment gateway, temporary seat hold, frontend integration or admin route is part of this phase.

## 6. Transaction design to implement

### 6.1 Create booking

1. Validate the request body, positive IDs, array shape, non-empty selection, maximum of six seats and no duplicate IDs.
2. Begin a MySQL transaction.
3. Load the show and its screen, ensuring the show is `SCHEDULED` and starts after `UTC_TIMESTAMP()`.
4. Load all requested seats and prove every seat belongs to the show's screen.
5. Load the required category prices from `show_prices`; reject incomplete pricing rather than trusting a browser value.
6. Sort seat IDs numerically and insert the booking row with a generated unique booking reference.
7. Insert one `booking_seats` row per selected seat with the server-derived category price as `price_snapshot` and `active = 1`.
8. Calculate `total_amount` from those authoritative price snapshots.
9. Commit and return the ticket/booking details.
10. On any failure, roll back. Map duplicate-key conflicts on the active show/seat uniqueness constraint to HTTP 409. Handle deadlocks with a safe conflict/retry policy; do not partially commit.

The transaction should use one acquired connection for BEGIN/COMMIT/ROLLBACK. A pre-check for availability improves the error message but is not the concurrency guarantee; the unique database constraint is.

### 6.2 Seat availability

- Return the physical seat layout for the selected show's screen.
- A seat is unavailable only when an active `booking_seats` row exists for that show and seat.
- Cancelled rows with `active = NULL` must not block availability.
- Include seat ID, row label, seat number, category and a boolean availability/status field.
- Reject unknown show IDs; cancelled/completed/past shows should not be bookable. The precise read behavior for past/completed shows will be kept consistent with the public show detail contract and tested.

### 6.3 Booking history and detail

- Always filter by `req.auth.id`.
- Never accept a user ID from the request body/query as an authority.
- Include show/movie/cinema/screen details and booked seat labels/categories/prices.
- Preserve `price_snapshot` and the stored total; do not recalculate historical bookings from current prices.
- Detail lookup for another user's booking returns 404.

### 6.4 Cancellation

1. Begin transaction.
2. Lock the booking row using `SELECT ... WHERE id = ? AND user_id = ? FOR UPDATE`.
3. Return 404 if no owned booking exists.
4. Require status `CONFIRMED`; otherwise return a conflict response.
5. Check the show's start time using UTC and reject cancellation at or inside the two-hour cutoff.
6. Set booking status to `CANCELLED` and `cancelled_at` to UTC.
7. Set its active booking-seat rows to `NULL`.
8. Commit. Roll back on any error.

## 7. Critical database privilege gap — approval required

The checked-in `database/create_app_user.sql` currently grants:
- `SELECT` on `book_my_seat.*`.
- `INSERT` on `book_my_seat.users` for Phase 5 registration.

It does **not** grant booking writes. Phase 6 will require narrowly scoped permissions, expected to include:

| Table | Required operation |
|---|---|
| `shows`, `screens`, `seats`, `show_prices`, `bookings`, `booking_seats` | SELECT |
| `bookings` | INSERT |
| `booking_seats` | INSERT |
| `bookings` | UPDATE (status/cancelled_at) |
| `booking_seats` | UPDATE (active release) |

No DELETE, schema/DDL, user-management or admin privileges are needed for the booking workflow.

**No GRANT statements have been executed or added in this stage.** Before live MySQL booking tests, the project owner must explicitly approve these additional least-privilege grants. The grants must be applied by a database administrator in MySQL Workbench, not silently by application startup.

## 8. Stage plan

- **Stage 1 — Requirements, schema and privilege audit:** completed in this branch.
- **Stage 2 — Seat availability read API:** public show-specific seat map.
- **Stage 3 — Transactional booking creation:** six-seat limit, server pricing, unique reference and duplicate prevention.
- **Stage 4 — Booking history and detail:** authenticated owner-only reads.
- **Stage 5 — Cancellation and seat release:** two-hour rule, row lock and transaction.
- **Stage 6 — Concurrency, security and full regression:** simultaneous booking tests, rollback, ownership, cancellation/rebooking and DB verification.

Each stage will be implemented on a separate branch based on the preceding verified stage. Full local test and database verification will be performed after each implementation batch.

## 9. Stage 1 acceptance

- [x] Phase 1 booking rules recovered from the original report.
- [x] Existing 11-table schema inspected.
- [x] Database uniqueness and composite foreign-key guarantees confirmed in source.
- [x] Existing authentication and service architecture inspected.
- [x] API endpoints and transaction boundaries documented.
- [x] Missing booking write privileges identified.
- [x] No application code, schema or database grants changed.

**Stage 1 result:** Audit and implementation plan are ready. The next step is Stage 2 seat availability implementation. Live booking-write testing must wait for explicit approval of the least-privilege database grants described above.
