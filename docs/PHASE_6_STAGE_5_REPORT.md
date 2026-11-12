# Phase 6 — Stage 5: Booking Cancellation and Seat Release

**Branch:** `phase-6/stage-5-booking-cancellation`  
**Status:** Implementation committed; automated and live cancellation verification pending.

## Objective

Allow an authenticated booking owner to cancel an eligible confirmed booking, apply the two-hour cutoff, and release its seats atomically.

## API

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| DELETE | `/api/bookings/:id` | Required + same-origin + CSRF | Cancel an eligible booking owned by the current user |

Success response uses the existing envelope and returns the booking ID, `CANCELLED` status, cancellation timestamp and number of released seats.

## Cancellation rules

- The booking must exist and belong to the authenticated user. Missing and other-user bookings both return 404.
- Only `CONFIRMED` bookings can be cancelled; other statuses return 409.
- Cancellation is rejected at or inside the two-hour window before showtime. The cutoff is checked by MySQL using `UTC_TIMESTAMP()`.
- The booking row is selected with `FOR UPDATE` inside a transaction. This serializes simultaneous cancellation attempts.
- The booking is updated to `CANCELLED` with `cancelled_at = UTC_TIMESTAMP()`.
- Active booking-seat rows are released by setting `active = NULL`; no booking-seat history rows are deleted.
- Both updates commit together. Any error rolls back the transaction.
- The route requires same-origin validation, authentication and the existing double-submit CSRF protection.
- No schema change or additional database grant is required; the Stage 3-approved `UPDATE` privileges cover the two affected tables.

## Files added/updated

- Added `backend/services/booking-cancellation.service.js`
- Added `backend/tests/booking-cancellation.test.js`
- Updated `backend/controllers/booking.controller.js`
- Updated `backend/routes/booking.routes.js`

## Automated coverage

- Cancellation allowed for a confirmed booking outside the cutoff.
- Cancellation rejected at/inside the cutoff.
- Cancellation rejected for non-confirmed statuses.
- DELETE request rejected without same-origin validation.
- Same-origin DELETE request still requires authentication.

The service uses one connection and a transaction, locks the owner-scoped booking row, and updates booking status and active seat reservations atomically.

## Live verification plan

After pulling the branch and passing the full test suite:

1. Verify an eligible future booking can be cancelled by its owner.
2. Verify booking history/detail show `CANCELLED` and a cancellation timestamp.
3. Verify its seat becomes available again.
4. Verify a second cancellation returns 409.
5. Verify another user's booking is indistinguishable from a missing booking (404).

**Important:** The existing live test booking (booking ID 1, show 1301, seat A1) is for a show whose scheduled time may be within the two-hour cutoff or already past depending on when verification is performed. Do not cancel it blindly. Use a separate suitable future test booking only after explicit user approval, or verify through a controlled test fixture. Do not create or cancel live records without approval.
