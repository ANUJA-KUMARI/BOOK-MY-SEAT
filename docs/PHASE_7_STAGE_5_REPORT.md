# Phase 7 — Stage 5: Booking History and My Bookings Integration

**Branch:** `phase-7/stage-5-booking-history-integration`  
**Base:** `phase-7/stage-4-booking-flow-integration`  
**Status:** Completed — project owner reported 12 frontend API tests passing and verified the booking details page in the browser.

## Objective

Connect the authenticated customer experience to the existing owner-scoped booking history and booking detail endpoints. Let a signed-in user review their bookings and inspect a ticket without changing booking creation, cancellation rules, database schema or payment behavior.

## Existing backend contract reused

- `GET /api/bookings?page=&limit=` returns only the authenticated user's bookings and pagination metadata.
- `GET /api/bookings/:id` returns a booking only when it belongs to the authenticated user; otherwise it returns 404.
- Responses include movie, showtime, cinema, screen, seat labels/categories, historical `price_snapshot`, total, status, booking reference and cancellation timestamp.
- No backend endpoint, database schema, grants or booking write behavior was changed in this stage.

## Implemented

### API client — `frontend/js/api.js`

- Added `getUserBookings({ page, limit })` for paginated booking history.
- Added `getUserBooking(id)` for an individual booking.
- Uses same-origin credentials and validates pagination values and booking IDs before network access.
- Leaves authentication to the HttpOnly session cookie; no token is exposed to JavaScript.

### Navigation — `frontend/js/components.js`

- Adds a **My bookings** link for authenticated users only.
- Preserves public navigation, session lookup and logout behavior.

### Booking history page

- Added `frontend/pages/my-bookings.html`, `frontend/js/pages/my-bookings.js` and `frontend/css/my-bookings.css`.
- Shows each booking's movie, cinema, showtime, seats, reference, status and total.
- Supports previous/next pagination (10 records per page).
- Shows a useful empty state when the user has no bookings.
- Provides a details view at `my-bookings.html?id=<booking-id>`.
- Details show booking reference/date, movie, cinema/address, showtime/screen, seat-by-seat historical prices, total and cancellation timestamp.
- Displays confirmed and cancelled states distinctly.
- Requires an active session; unauthenticated users are directed to login.
- Handles missing/unauthorized booking details as not found without exposing another user's booking.
- Escapes dynamic text before rendering HTML and uses the existing project typography, tokens, shared header and footer.

### Tests

Extended `frontend/tests/api.test.js` with four tests covering:
- Paginated authenticated booking-history requests.
- Rejection of invalid page/limit values before network access.
- Booking detail requests.
- Rejection of malformed booking IDs before network access.

## Security and scope

- The browser never supplies a user ID; ownership is determined by the authenticated backend identity.
- The backend's owner-scoped query remains the authorization boundary.
- The page is read-only. Cancellation controls and payment processing are not added.
- No schema changes, SQL grants, seed changes or backend service changes were made.

## Local verification

Run from PowerShell:

```powershell
Set-Location "E:\\BOOK MY SEAT"
git fetch origin
git switch phase-7/stage-5-booking-history-integration
node --experimental-default-type=module --test frontend/tests/api.test.js
Set-Location "E:\\BOOK MY SEAT\\backend"
npm test
npm run db:check
```

Expected frontend API result: **12 tests passed, 0 failed** (8 existing tests plus 4 new booking-history tests). The backend and database checks should remain green because this stage reuses existing read-only APIs and does not modify backend/database code.

## Browser verification required

1. Start the backend with `npm start` and sign in with the account that owns the existing demo booking.
2. Click **My bookings** in the authenticated navigation.
3. Confirm the list includes the existing booking reference `BMS-MWDCZ60F-1192106C45`, movie, showtime, seats C6/C7/C8 and total ₹660.
4. Open **View details** and confirm the seat-by-seat details and historical prices match the booking.
5. Return to the list and refresh; the booking should remain visible.
6. Sign out and revisit My bookings; it should ask the user to log in.
7. If a second test account is available, try opening the first user's booking detail URL while signed in as the second account; the API should return 404 and no booking details should appear.

Do not create another booking for this verification. The existing confirmed booking is sufficient.

**Exit criteria:** Met. The project owner reported 12 frontend API tests passing and confirmed that the booking details page displays the correct booking, show, seat and price information.
