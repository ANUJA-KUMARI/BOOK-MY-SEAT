# BOOK_MY_SEAT — Booking lifecycle operations

## Approved behavior

- A seat reservation starts as `PENDING` and holds seats for **10 minutes**.
- The customer must press **Confirm reservation** to make it `CONFIRMED`.
- This is a demo confirmation only. No payment is collected or represented as paid.
- Email notifications and payment integration are out of scope.
- Existing `CONFIRMED` and `CANCELLED` records are preserved.

## 1. Back up before migration

From `backend/`, run `npm run db:backup` using the configured least-privilege backup account. Verify the generated backup file and test restoring it to a disposable MySQL database before changing the live project database.

## 2. Apply the migration once

Open `database/migrations/20261120_booking_lifecycle.sql` in MySQL Workbench, verify the selected schema is `book_my_seat`, and execute it exactly once. It is intentionally not run automatically by the application. The migration adds nullable timestamps and extends the status enum; it does not update or remove existing booking or seat rows.

Verify with:

```sql
SHOW COLUMNS FROM bookings LIKE 'status';
SHOW COLUMNS FROM bookings LIKE 'expires_at';
SHOW COLUMNS FROM bookings LIKE 'confirmed_at';
SHOW INDEX FROM bookings WHERE Key_name = 'idx_bookings_expiry';
SELECT status, COUNT(*) FROM bookings GROUP BY status;
```

Do not deploy the updated application before the migration is applied. If the migration has not been applied, the new booking endpoints will fail because the required columns/statuses do not exist.

## 3. Schedule expiry processing

The worker is a single bounded run, designed for a scheduler to invoke once per minute. From `backend/`:

```bash
npm run bookings:expire
```

Configure Windows Task Scheduler, cron, or the host scheduler to run that command every minute with `backend/` as the working directory and the same environment variables used by the backend. Multiple overlapping workers are safe: the worker uses row locks with `SKIP LOCKED`, rechecks the due condition, and releases only the seats belonging to the booking it expires.

A worker run reports the number of examined/expired bookings and released seats. Monitor non-zero exit codes. The API itself does not run an in-memory timer, so multiple web-server instances do not create competing timers.

## 4. Booking state transitions

```text
PENDING -> CONFIRMED
PENDING -> CANCELLED
PENDING -> EXPIRED
CONFIRMED -> CANCELLED (existing two-hour cutoff)
```

The server/database clock is authoritative. A confirmation after expiry fails and releases the expired hold transactionally. Pending cancellation does not use the confirmed-booking two-hour cutoff. Expired/cancelled bookings cannot be revived.

## 5. Verification and limitations

CI runs the backend/frontend regression tests and lifecycle unit/migration-safety tests. The GitHub runner does not have access to your local MySQL instance. Before using the feature locally, run the backup, migration, worker command, booking/confirmation/cancellation flows, and restore test against a disposable database. Do not claim a live database migration or restore has passed until you have run it in that environment.
