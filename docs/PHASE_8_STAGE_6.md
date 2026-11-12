# BOOK_MY_SEAT — Phase 8, Stage 6
## Booking Management & Admin Dashboard

### Scope
- Administrator dashboard with live counts for total, confirmed and cancelled bookings; confirmed booking revenue; active movies; cinemas; screens; and upcoming shows.
- Dashboard recent-booking activity and next five upcoming shows.
- Administrator booking register with search by booking reference, customer name or email.
- Status filter (all, confirmed, cancelled), page size selection, pagination and booking detail view.
- Booking details include customer identity, movie, cinema, screen, showtime, booking timestamps, historical seat categories and price snapshots.

### API
- `GET /api/admin/dashboard`
- `GET /api/admin/bookings?search=&status=&page=&limit=`
- `GET /api/admin/bookings/:id`

All endpoints use the existing JWT authentication and ADMIN authorization middleware. These Stage 6 booking operations are read-only; they do not alter booking status, cancel reservations or modify payment records. Customer cancellation rules and the existing customer booking API remain unchanged.

### Data and financial definitions
- Confirmed revenue is the sum of `total_amount` for bookings whose status is `CONFIRMED`; cancelled bookings are excluded.
- Seat details use `booking_seats.price_snapshot`, preserving the price charged at booking time rather than current show prices.
- Seat release state is displayed as historical seat activity; cancelled booking rows remain available for audit/history.
- Dashboard upcoming shows include only `SCHEDULED` shows whose UTC start time is in the future.

### Security and compatibility
- No database schema changes or seed-data changes.
- No new dependencies.
- No password hashes, JWTs, or CSRF secrets are returned by the admin APIs.
- Existing frontend stack, API response envelope, session cookies, database pool, and Phase 1–7 customer workflows are preserved.

### Verification
Run from `E:\BOOK MY SEAT\backend`:
```powershell
npm test
npm run test:frontend
npm run db:check
```
Then verify in the browser as an ADMIN:
1. Dashboard metrics and recent/upcoming activity load.
2. Booking register loads, searches by booking reference/customer, filters by status and paginates.
3. Booking detail modal displays customer, show, seat and historical price information.
4. A USER account cannot access the admin dashboard or booking endpoints.
5. Customer booking history, details and cancellation remain unchanged.

Stage 6 is implemented on branch `phase-8/stage-6-booking-management-dashboard`; local test and browser verification are required before sign-off.
