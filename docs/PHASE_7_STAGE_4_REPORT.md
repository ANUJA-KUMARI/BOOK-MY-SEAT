# Phase 7 — Stage 4: Seat Availability UI Integration

**Branch:** `phase-7/stage-4-seat-availability-ui`  
**Base:** `phase-7/stage-3-authentication-ui-integration`  
**Status:** Implementation committed; local verification pending.

## Objective

Replace the seat page's simulated show, seat, and price data with the existing Phase 6 read-only availability API. Preserve the seat map design, keyboard accessibility, selection limit, and summary panel. Booking creation is intentionally out of scope for this stage.

## Changes

### `frontend/js/api.js`

Added `getShowSeats(showId)`, which validates the show ID and requests `GET /api/shows/:id/seats` using the existing same-origin API client.

### `frontend/js/pages/seats.js`

- Removed the derived movie-ID/show-ID assumption and the separate movie/showtime requests.
- Removed the pseudo-random booked-seat simulation and hard-coded row/category mapping.
- Loads show metadata, seat rows, availability, and prices from one authoritative API response.
- Uses database seat IDs, row labels, seat numbers, categories, and `is_available` values.
- Uses database show prices for category labels and selected-seat totals.
- Booked seats are disabled; available seats remain selectable.
- Preserves the six-seat maximum, selection summary, accessible button states, and arrow-key navigation.
- Does not create bookings or write to the database.

### `frontend/tests/api.test.js`

Added focused tests for the availability endpoint request/response and invalid show-ID rejection.

## API response contract consumed

`GET /api/shows/:id/seats` returns:
- `show`: movie, cinema, screen, start time and status.
- `prices`: authoritative STANDARD, PREMIUM and RECLINER prices.
- `seats`: seat ID, row, number, category, `is_available`, and status.
- `summary`: total, available and booked counts.

## Local verification

From the project root:

```powershell
Set-Location "E:\BOOK MY SEAT"
git fetch origin
git switch phase-7/stage-4-seat-availability-ui
git pull origin phase-7/stage-4-seat-availability-ui
node --experimental-default-type=module --test frontend/tests/api.test.js
```

Expected focused result: 12 tests, all passing.

Start the backend in another terminal:

```powershell
Set-Location "E:\BOOK MY SEAT\backend"
npm start
```

Browser acceptance:
1. Open a movie page and choose an upcoming showtime.
2. Continue to seat selection.
3. Confirm movie, cinema, screen, date and showtime match the selected show.
4. Confirm the seat map displays the database seat layout and categories.
5. Confirm booked seats are disabled and available seats can be selected.
6. Select seats across categories and confirm displayed prices and total match the API.
7. Confirm the six-seat selection limit and keyboard navigation still work.
8. Refresh the page and confirm the availability is loaded again from the server.

Then run regression checks:

```powershell
Set-Location "E:\BOOK MY SEAT\backend"
npm test
npm run db:check
```

## Acceptance criteria

- [x] Seat availability API client added.
- [x] Simulated booked-seat pattern removed.
- [x] Hard-coded row/category mapping removed.
- [x] Seat availability and prices sourced from the database API.
- [x] Existing selection UI and six-seat limit preserved.
- [x] Focused API tests added.
- [ ] Focused frontend API tests pass locally.
- [ ] Seat page browser acceptance checks pass.
- [ ] Backend regression and database checks pass locally.

## Not included

- Booking creation UI/API submission (next stage).
- Booking history, detail and cancellation UI.
- Admin functionality.
- Payment processing.
