# Phase 6 — Stage 4: Booking History and Booking Details

**Branch:** `phase-6/stage-4-booking-history`  
**Status:** Implementation committed; automated and live read verification pending.

## Objective

Provide authenticated, owner-scoped booking history and booking detail endpoints. Historical booking totals and seat prices are read from stored booking records and `booking_seats.price_snapshot`; they are never recalculated from current show prices.

## API

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| GET | `/api/bookings` | Required | Paginated history for the authenticated user |
| GET | `/api/bookings/:id` | Required | One booking owned by the authenticated user |

History accepts optional `page` (default 1) and `limit` (default 20, maximum 50). It returns `bookings` and pagination metadata. Results are ordered newest first.

The detail response returns `{ booking }`. Both endpoints derive the user ID only from the verified JWT identity (`req.auth.id`). They do not accept a user ID from the client.

## Returned information

Each booking includes its reference, status, stored total, creation/cancellation timestamps, show time/status, movie, cinema, screen, and seat details. Each seat's price comes from the historical `price_snapshot`.

## Security and behavior

- Both read endpoints require authentication.
- Detail SQL filters by both booking ID and authenticated user ID.
- A missing booking and another user's booking both return the same `404 Booking not found.` response.
- Pagination inputs are bounded and validated.
- SQL uses parameterized values.
- No schema or database privilege changes are required; endpoints are read-only.

## Files added/updated

- Added `backend/services/booking-read.service.js`
- Updated `backend/controllers/booking.controller.js`
- Updated `backend/routes/booking.routes.js`
- Added `backend/tests/booking-history.test.js`

## Verification

Pending. After pulling this branch, run `npm test` and `npm run db:check`. Then perform authenticated read checks for history, own detail, nonexistent detail and cross-user ownership (404). Do not create, cancel or otherwise mutate bookings during Stage 4 verification.
