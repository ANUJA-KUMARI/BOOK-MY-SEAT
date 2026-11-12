# BOOK_MY_SEAT — Phase 6 Report
## Booking and Seat Availability

| Item | Detail |
|---|---|
| Phase | 6 of 8 — Show-specific availability, booking transactions, history and cancellation |
| Database | MySQL / InnoDB |
| Main integrity guarantee | One active reservation per seat per show |
| Status | Implementation and regression hardening completed; later project records report successful local verification |

## 1. Phase objective

Phase 6 implemented the persistent customer booking workflow on top of the Phase 4 schema and Phase 5 authentication. It added show-specific seat availability, transactional booking creation, owner-scoped booking history/detail and transactional cancellation with seat release.

The phase deliberately protects existing local booking data. Destructive concurrency testing was not run against the owner's working database. The attempted cancellation of booking ID 1 was rejected with HTTP 409 because the showtime was inside the two-hour cutoff; the booking was left unchanged.

## 2. Database integrity model

A seat is physical inventory on a screen, but availability is specific to a show. The application checks that selected seats belong to the screen assigned to the requested show.

The `booking_seats` table stores:
- booking ID,
- show ID,
- seat ID,
- historical `price_snapshot`,
- active reservation state.

The unique key `(show_id, seat_id, active)` prevents two active reservations for the same seat and show. `active = 1` means reserved; `active = NULL` means released after cancellation. Historical booking-seat rows are retained.

Composite foreign keys in the schema ensure booking/show/screen/seat relationships remain consistent. Booking seat IDs are sorted before row locking to reduce deadlock risk.

## 3. Show-specific seat availability API

Endpoint: `GET /api/shows/:id/seats`

The endpoint:
- Validates the show ID before querying MySQL.
- Returns 404 for an unknown show.
- Rejects past or non-SCHEDULED shows with HTTP 409.
- Resolves movie, cinema and screen information.
- Returns every seat belonging to the show's screen.
- Marks a seat BOOKED only when an active booking-seat row exists for that exact show and seat.
- Treats released rows (`active = NULL`) as available.
- Reads STANDARD, PREMIUM and RECLINER prices from `show_prices`.
- Rejects incomplete pricing rather than returning a misleading partial price object.
- Returns total, available and booked seat counts.

The endpoint is read-only and uses the shared pool and parameterized SQL. It does not require new database write grants.

## 4. Transactional booking creation

Endpoint: `POST /api/bookings`

The request requires authentication, same-origin validation and CSRF proof. Its body contains only `showId` and `seatIds`. The client must not submit user ID, role, booking reference, price or total.

Validation rules:
- Show and seat IDs must be positive safe integers.
- At least one seat is required.
- Maximum six seats per booking.
- Duplicate seat IDs are rejected.
- Seat IDs are sorted before database row locking.
- All selected seats must belong to the screen assigned to the show.

Transaction sequence:
1. Acquire one pooled connection and begin a transaction.
2. Lock and validate the show; it must be scheduled and in the future.
3. Lock selected seats in ascending ID order and validate screen membership.
4. Read authoritative category prices from `show_prices`.
5. Calculate the total on the server.
6. Insert a booking with a generated unique `BMS-` reference.
7. Insert booking-seat rows with `active = 1` and server-derived `price_snapshot` values.
8. Commit.
9. On any error, roll back and release the connection.

Duplicate-key conflicts, deadlocks and lock-wait timeouts map to HTTP 409 with a safe refresh/retry message. The database unique key remains the final double-booking protection.

## 5. Booking history and details

Endpoints:
- `GET /api/bookings?page=&limit=` — paginated history for the authenticated user.
- `GET /api/bookings/:id` — one booking owned by the authenticated user.

The default page is 1 and default limit is 20; maximum limit is 50. Results are ordered newest first.

Both endpoints derive the user ID only from `req.auth.id`; they never accept a client-supplied user ID as authority. Detail lookup filters by both booking ID and authenticated user ID. A missing booking and another user's booking both return 404 to avoid disclosing ownership.

Responses include booking reference/status/total/timestamps, show, movie, cinema, screen, seat labels/categories and historical seat prices from `price_snapshot`. Historical totals are not recalculated from current show prices.

## 6. Cancellation and seat release

Endpoint: `DELETE /api/bookings/:id`

Cancellation requires authentication, same-origin validation and CSRF proof. The service:
1. Begins a transaction.
2. Locks the owner-scoped booking row using `SELECT ... FOR UPDATE`.
3. Returns 404 for missing or non-owned bookings.
4. Allows only CONFIRMED bookings; other statuses return 409.
5. Checks the two-hour cutoff using MySQL UTC time.
6. Updates booking status to CANCELLED and sets `cancelled_at = UTC_TIMESTAMP()`.
7. Sets active booking-seat rows to `NULL`.
8. Commits both changes together; any error rolls back.

No booking-seat history rows are deleted. The booking row lock serializes simultaneous cancellation attempts.

The live attempt to cancel booking ID 1 returned HTTP 409 because its showtime was inside the two-hour cutoff. This is the expected business-rule behavior, not a defect; the booking was not cancelled. The successful live cancellation path was not forced using that ineligible record.

## 7. Database privilege requirements

The Phase 6 audit identified that the original app-user grants did not include booking writes. The booking workflow requires narrowly scoped access:
- SELECT on shows, screens, seats, show_prices, bookings and booking_seats.
- INSERT and UPDATE on bookings.
- INSERT and UPDATE on booking_seats.

No DELETE, DDL, schema-management or user-management privileges are needed for customer booking/cancellation. Stage documentation states that grants must be applied explicitly by a database administrator; the application must not silently execute GRANT statements at startup.

## 8. Regression and data-safety testing

Stage 6 added read-only INFORMATION_SCHEMA checks verifying:
- `bookings` and `booking_seats` use InnoDB.
- `uq_booking_seats_show_seat_active` exists, is unique and has ordered columns `(show_id, seat_id, active)`.
- `booking_seats.active` remains nullable.

The checks are read-only and do not insert, update or delete booking rows. A persistent live concurrency race test was intentionally not run against the owner's database; it should use a disposable database or isolated fixture.

The Stage 6 report specified an expected 220-test total if the 218-test baseline and both live DB checks ran rather than skipped. Later project records report the 220 backend tests passing and database checks passing. This is treated as owner-reported local verification, not an independently executed result.

## 9. Phase 6 completion summary

Phase 6 delivered show-specific seat availability, server-authoritative pricing, transactional booking creation, six-seat enforcement, database-level duplicate prevention, owner-scoped booking history/detail and transactional cancellation with the two-hour cutoff and seat release. Later project records report successful regression/database verification. The existing booking ID 1 remained unchanged after the ineligible cancellation attempt.
