# Phase 7 — Stage 4: Seat Availability and Booking Flow Integration

**Branch:** `phase-7/stage-4-booking-flow-integration`  
**Base:** `phase-7/stage-3-authentication-integration`  
**Status:** COMPLETE — automated tests, database checks and live browser booking verification passed.

## Objective

Replace the seat-selection page's simulated seat map and placeholder confirmation action with the Phase 6 database-backed seat-availability and booking APIs. Preserve the existing seat-map design, keyboard accessibility, six-seat selection limit and authentication protections.

## Implemented

### Frontend API client — `frontend/js/api.js`

- Added `getShowSeats(showId)` → `GET /api/shows/:id/seats`.
- Added `createBooking({ showId, seatIds })` → `POST /api/bookings`.
- Booking requests include same-origin credentials, JSON content type and the readable `bms_csrf` cookie in `x-csrf-token`.
- Client validation rejects invalid IDs, empty selections and more than six seats before sending a request.
- The HttpOnly JWT is never read by frontend JavaScript.

### Seat selection page — `frontend/js/pages/seats.js`

- Removed the generated pseudo-random booked-seat pattern and temporary row/category mapping.
- Loads the selected show using the real show-specific seat availability endpoint.
- Loads movie details using the movie ID returned by the show-availability API; no assumptions are made about show ID numbering.
- Renders seat IDs, row labels, seat numbers, categories, availability and prices from database-backed API data.
- Keeps the existing six-seat cap, accessible button labels, keyboard navigation and booking summary.
- Sends only the show ID and selected seat IDs to the booking API.
- Displays the server-generated booking reference and server-calculated total after success.
- Displays safe API errors. A 409 prompts the user to refresh/recheck availability; a 401 provides a login link.
- Marks successfully booked seats unavailable in the current page after the API confirms success.

### Tests — `frontend/tests/api.test.js`

Added tests for:
- Fetching show-specific seat availability.
- Posting booking data with same-origin credentials and the CSRF header.
- Rejecting invalid seat counts and missing CSRF before network access.

## Security and data-integrity boundaries

- The frontend does not submit prices or totals.
- The backend remains authoritative for seat ownership by screen, show status, price lookup, total calculation, duplicate booking protection and transaction commit.
- Booking creation requires authentication, same-origin validation and CSRF validation.
- A booking confirmation is shown only after the backend returns success.
- No payment processing is implemented; this remains a demo booking workflow.

## Verification results

From PowerShell:

```powershell
Set-Location "E:\BOOK MY SEAT"
git pull origin phase-7/stage-4-booking-flow-integration
Set-Location "E:\BOOK MY SEAT\backend"
npm test
npm run db:check
```

Then start the backend with `npm start` and verify:

1. Log in with the registered user.
2. Open a movie, select an upcoming show and continue to seat selection.
3. Confirm the seat map reflects the database's current availability and category prices.
4. Select one or more available seats (up to six); confirm the summary updates.
5. Selected three available seats and submitted the booking.
6. The server confirmed the booking and returned reference `BMS-MWDCZ60F-1192106C45`; the UI displayed seats C6, C7 and C8 and a server-calculated total of ₹660.
7. Reloaded the same show; C6, C7 and C8 remained unavailable, confirming database persistence.

The booking is a demo reservation; no real payment was taken. The three seats remain reserved in the local database.

Do not use a show that has started or is within the cancellation cutoff for a test booking intended to be cancelled later. Do not run seed scripts against a database containing bookings.

**Exit criteria:** MET. Stage 4 is complete based on the reported automated tests, database checks, successful live booking and seat-persistence verification.

**Remaining scope:** Payment processing is not implemented. Cross-user booking-history authorization and cancellation remain covered by their respective backend stages and are not claimed as newly browser-verified here.
