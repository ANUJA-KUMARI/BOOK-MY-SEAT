# Phase 6 — Stage 6: Concurrency, Security and Full Regression

**Branch:** `phase-6/stage-6-concurrency-security-regression`  
**Status:** Regression hardening committed; local verification by the project owner is pending.

## Objective

Complete a final Phase 6 review of booking correctness, database-level concurrency protection, authentication/CSRF boundaries, cancellation rules, and regression safety without changing live booking data.

## Changes in this stage

### Read-only database regression checks

Updated `backend/tests/db-live.test.js` with two additional checks:

1. Both `bookings` and `booking_seats` use InnoDB, so the booking workflow can rely on transactional row changes.
2. The unique index `uq_booking_seats_show_seat_active` exists with the exact ordered columns `(show_id, seat_id, active)` and is unique. This is the database-level guard that prevents two active reservations for the same seat in the same show.
3. The `booking_seats.active` column remains nullable, allowing cancellation to release a seat by setting `active = NULL` while retaining historical booking-seat rows.

These checks query INFORMATION_SCHEMA only. They do not insert, update, or delete any records.

## Existing safeguards reviewed

- Booking input validation enforces a positive show ID, 1–6 unique positive seat IDs, and deterministic seat-ID ordering.
- Booking creation uses a transaction, locks the show and selected seat rows, validates screen membership, reads authoritative show prices, and stores price snapshots.
- Duplicate-key, deadlock, and lock-wait-timeout errors are mapped to HTTP 409.
- Booking history and detail queries are scoped to the authenticated user.
- Cancellation locks the owner-scoped booking row, enforces the two-hour cutoff, and updates booking status and active seat reservations in one transaction.
- Booking mutations require same-origin validation, authentication, and CSRF validation.
- The database application account has narrowly scoped SELECT access plus INSERT/UPDATE on booking tables; it does not need DELETE privileges for cancellation.

## Verification boundaries

The two new live-database tests are read-only. The full automated suite also exercises the existing validation, authentication, ownership, cancellation eligibility, error handling, and API behavior tests.

A destructive or persistent live concurrency test is intentionally not run against the project owner's current database. Booking ID 1 remains unchanged. A real concurrent race test should use a disposable test database/fixture so that test reservations cannot pollute the user's working seed data.

The attempted live cancellation of booking ID 1 was rejected with HTTP 409 because its showtime was inside the two-hour cancellation cutoff. This is the expected business-rule result; booking ID 1 was not cancelled.

## Owner verification

From PowerShell:

```powershell
Set-Location "E:\BOOK MY SEAT"
git pull origin phase-6/stage-6-concurrency-security-regression
Set-Location "E:\BOOK MY SEAT\backend"
npm test
npm run db:check
```

Expected test count after the two new checks: **220 tests**, assuming the same 218-test baseline and both live-database checks run (not skipped). The actual result must be recorded from the local test output.

Then confirm:
- all automated tests pass;
- `npm run db:check` reports `RESULT: ALL CHECKS PASSED.`;
- the two new live DB checks pass rather than skip;
- booking ID 1 remains unchanged.

## Phase 6 exit decision

Phase 6 can be marked implementation-complete after the owner confirms the regression commands above. The live cancellation success path remains unverified because booking ID 1 is not eligible under the two-hour rule. No booking should be cancelled or created merely to force a green verification result.
