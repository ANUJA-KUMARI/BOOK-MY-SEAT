# Phase 6 — Stage 3: Transactional Booking Creation

**Branch:** `phase-6/stage-3-booking-creation`  
**Status:** Code committed; local verification and live MySQL write test pending.

## Delivered API

`POST /api/bookings`

Requires:
- Valid Phase 5 JWT authentication.
- Same-origin request.
- Valid double-submit CSRF cookie/header pair.
- JSON body with `showId` and `seatIds`.

Example request:

```json
{
  "showId": 123,
  "seatIds": [101, 102]
}
```

The client must not send a user ID, price, total, booking reference or role. The authenticated user ID is taken only from `req.auth.id`.

## Validation

- Show ID and each seat ID must be positive safe integers.
- At least one seat is required.
- Maximum six seats per booking.
- Duplicate seat IDs are rejected.
- Seat IDs are sorted before database row locking to reduce deadlock risk.
- All selected seats must belong to the screen assigned to the requested show.

## Transaction behavior

The service obtains one pooled connection and uses it for the entire transaction:

1. Begin transaction.
2. Lock and validate the show row; it must be scheduled and in the future.
3. Lock requested seat rows in ascending ID order and validate screen membership.
4. Read authoritative category prices from `show_prices`.
5. Calculate total on the server.
6. Insert the booking with a generated unique `BMS-` reference.
7. Insert each booking-seat row with `active = 1` and a server-derived `price_snapshot`.
8. Commit.
9. On any error, roll back and release the connection.

Duplicate-key conflicts, deadlocks and lock-wait timeouts are mapped to HTTP 409 with a safe refresh-and-retry message. The database unique key on `(show_id, seat_id, active)` remains the final double-booking guarantee.

## Response

Successful creation returns HTTP 201 with the booking ID, reference, show ID, confirmed status, total and seat details/prices. No password, JWT, client-supplied price or internal SQL is returned.

## Files added/updated

- `backend/validators/booking.js`
- `backend/services/booking.service.js`
- `backend/controllers/booking.controller.js`
- `backend/routes/booking.routes.js`
- `backend/routes/index.js`
- `backend/tests/booking-create.test.js`

## Database permission prerequisite — not changed

The application account currently lacks booking write grants. Stage 3 requires the narrowly scoped permissions identified in Stage 1:
- `INSERT, UPDATE` on `book_my_seat.bookings`
- `INSERT, UPDATE` on `book_my_seat.booking_seats`

**No GRANT statements were executed.** Until the project owner explicitly approves and a database administrator applies these grants, real booking writes using `bms_app` will be denied by MySQL. Read-only and validation tests can still run.

## Local verification

Pending. Run:

```powershell
Set-Location "E:\BOOK MY SEAT"
git fetch origin
git checkout phase-6/stage-3-booking-creation
git pull origin phase-6/stage-3-booking-creation

Set-Location "E:\BOOK MY SEAT\backend"
npm test
npm run db:check
```

Do not share `.env` or database credentials. After the tests pass, request explicit approval before changing MySQL grants or performing a live booking write.
