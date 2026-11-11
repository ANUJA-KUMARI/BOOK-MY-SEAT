# Phase 6 — Stage 2: Seat Availability API

**Branch:** `phase-6/stage-2-seat-availability`  
**Status:** Implementation committed; local verification pending.

## Delivered

Added the public read-only endpoint:

`GET /api/shows/:id/seats`

The endpoint:
- Validates the show ID before accessing MySQL.
- Returns 404 for an unknown show.
- Rejects past or non-`SCHEDULED` shows with HTTP 409.
- Resolves the show's movie, cinema and screen.
- Returns every seat belonging to that show's screen.
- Marks a seat `BOOKED` only when an active (`active = 1`) booking-seat row exists for that exact show and seat.
- Treats released/cancelled rows (`active = NULL`) as available.
- Reads the three category prices from `show_prices`; it never accepts prices from the client.
- Rejects incomplete show pricing with HTTP 409.
- Returns total, available and booked seat counts.
- Uses parameterized SQL and the shared MySQL pool.
- Makes no database writes and requires no new DB grants.

## Response shape

```json
{
  "success": true,
  "data": {
    "show": {
      "id": 1101,
      "movie_id": 1,
      "movie_title": "Example",
      "start_time": "2026-11-12T05:00:00.000Z",
      "status": "SCHEDULED",
      "cinema": { "id": 1, "name": "Cinema", "city": "Delhi", "address": "..." },
      "screen": { "id": 1, "name": "Screen 1" }
    },
    "prices": { "STANDARD": 220, "PREMIUM": 320, "RECLINER": 520 },
    "seats": [
      {
        "id": 1,
        "row_label": "A",
        "seat_number": 1,
        "category": "STANDARD",
        "is_available": true,
        "status": "AVAILABLE"
      }
    ],
    "summary": { "total": 80, "available": 80, "booked": 0 }
  }
}
```

Example values above illustrate the response format; actual IDs, seat counts and prices come from MySQL.

## Files added/updated

- `backend/services/seat.service.js`
- `backend/controllers/seat.controller.js`
- `backend/routes/seat.routes.js`
- `backend/routes/index.js` (mounts `/api/shows`)
- `backend/tests/seat-availability.test.js`

## Tests added

- Pure mapping test: active reservations are booked; released/no reservation is available.
- Invalid show ID tests (no DB access).
- MySQL integration test: gets a real upcoming show and checks seat map, categories, prices, counts and uniqueness.
- MySQL integration test: unknown show returns 404.

## Scope and safety

- Read-only endpoint. No INSERT/UPDATE/DELETE.
- No database schema changes or privilege grants.
- No frontend changes; frontend API wiring remains Phase 7.
- Booking creation, seat locking, cancellation and history are not implemented in this stage.
- Concurrent booking protection remains the database unique constraint plus transactional handling in Stage 3.

## Local verification

Pending. Run from PowerShell:

```powershell
Set-Location "E:\BOOK MY SEAT"
git fetch origin
git checkout phase-6/stage-2-seat-availability
git pull origin phase-6/stage-2-seat-availability

Set-Location "E:\BOOK MY SEAT\backend"
npm test
npm run db:check
```

Do not share `.env` or any database credentials. The owner should send the test summary and database-check result for review.
