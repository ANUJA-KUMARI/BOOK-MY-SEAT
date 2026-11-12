# Phase 7 — Stage 6: Final Integration, Regression Testing and QA

**Branch:** `phase-7/stage-6-final-integration-qa`  
**Base:** `phase-7/stage-5-booking-history-integration`  
**Status:** QA tooling and release checklist committed; owner-run full regression and final browser acceptance are required before closing Phase 7.

## Objective

Perform a final cross-layer quality pass over the customer-facing flow delivered in Phases 5–7. Preserve the existing UI, API contract, MySQL schema, authentication model, booking rules and demo-payment disclaimer.

## Scope audited

- Public movie catalogue, movie details and showtime selection.
- Registration, login, current-session persistence and logout.
- Same-origin requests, HttpOnly authentication cookie and CSRF header behavior.
- Database-backed seat availability and server-authoritative show prices.
- Booking creation, six-seat limit and booking confirmation.
- Authenticated booking list, pagination and booking detail.
- Booking cancellation endpoint and its authentication, same-origin, CSRF, ownership and two-hour cutoff protections.
- API error envelope, invalid identifiers, database readiness and secret-file hygiene.

## Implemented in Stage 6

### Unified regression commands

Updated `backend/package.json` with:

| Command | Purpose |
|---|---|
| `npm test` | Run the backend Node.js test suite |
| `npm run test:frontend` | Run all frontend API/authentication/validator tests |
| `npm run test:all` | Run backend and frontend automated tests sequentially |
| `npm run test:release` | Run all automated tests, then the live MySQL database check |

The frontend test command explicitly includes:
- `frontend/tests/api.test.js`
- `frontend/tests/auth-api.test.js`
- `frontend/tests/validators.test.mjs`

No new runtime dependency, database migration, seed operation, privilege grant or production behavior was added.

### Final acceptance checklist

The full local QA checklist is below. The browser items are deliberately manual because they depend on the owner's local MySQL data, browser cookies and running server.

1. **Environment**
   - Confirm local `.env` exists only on the machine and is not tracked.
   - Confirm MySQL is running and the app uses the least-privileged `bms_app` account.
   - Run `npm run db:check`; expect `RESULT: ALL CHECKS PASSED.`
2. **Automated regression**
   - Run `npm run test:all`; expect zero failures.
   - Run `npm run test:release` for the combined test-plus-database gate; expect zero failures and all DB checks passed.
3. **Public browsing**
   - Open Home and Movies.
   - Search/filter movies and open a movie detail.
   - Select a future showtime and confirm the seat map and DB prices load.
4. **Authentication**
   - Register a test account if needed; verify login.
   - Refresh and verify the session remains active.
   - Verify protected pages redirect/deny unauthenticated access.
   - Log out; verify the session is no longer accepted.
5. **Booking**
   - Sign in and choose an upcoming show.
   - Confirm booked seats are disabled and available seats are selectable.
   - Create a booking using one or more available seats (maximum six).
   - Confirm the server-confirmed reference and total appear.
   - Refresh availability and confirm the booked seats remain unavailable.
6. **Booking history**
   - Open My bookings and confirm the new/previous booking appears.
   - Open View details and verify movie, cinema, screen, showtime, seat categories, historical prices, total and reference.
   - Refresh the page and confirm the booking remains visible.
7. **Cancellation**
   - Use only a booking eligible under the existing rule (CONFIRMED and more than two hours before showtime).
   - Confirm successful cancellation updates status and releases the seats.
   - Verify a cancelled booking cannot be cancelled again and seats become available.
   - Do not attempt to cancel a booking inside the two-hour cutoff expecting success; the API must reject it.
8. **Authorization and negative paths**
   - Unauthenticated history/detail/cancellation requests must be rejected.
   - Another user's booking must not be disclosed or cancelled.
   - Missing/invalid IDs and invalid requests must return safe API errors.
   - A same-origin/CSRF failure must not mutate booking state.

**Data safety:** Browser acceptance may create or cancel real rows in the local demo database. Use an upcoming test show and seats intentionally. Do not rerun `seed.sql`, drop tables or reset the database to clean up tests.

## Verification provenance

The project owner previously reported successful local verification for earlier stages, including 220 backend tests passing, database checks passing, and successful browser checks for authentication, booking creation, booking list and booking detail. Those results are historical Stage 3–5 evidence, not a claim that Stage 6's newly added combined command has already been run.

The new `test:all` and `test:release` commands must be run locally after pulling this branch. Browser acceptance checklist items must also be confirmed by the project owner.

## Phase 7 exit criteria

Phase 7 is complete when:
- Stages 1–6 are implemented and committed.
- The unified backend + frontend automated test command reports zero failures.
- The database verification command reports all checks passed.
- The customer journey works in the browser from public movie discovery through booking, booking history/detail and eligible cancellation.
- No unresolved integration blocker remains.

Once these criteria are confirmed, Phase 7 can be marked **Completed**. Phase 8 (admin functionality) remains a separate planned phase; completing Phase 7 does not mean the entire project is finished.
