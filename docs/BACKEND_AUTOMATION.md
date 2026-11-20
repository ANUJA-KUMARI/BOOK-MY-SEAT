# BOOK_MY_SEAT — Backend Automation & Hardening

This document records automation added during the post-Phase-8 hardening work and distinguishes it from features that require a future product decision or external credentials.

## Implemented in this branch

### Continuous integration

GitHub Actions runs the existing backend and frontend regression suites on pushes and pull requests that touch application code. It uses Node.js 22, installs from the backend lockfile with `npm ci`, and runs `npm run test:all`. Database-dependent tests retain their existing skip behavior when CI has no MySQL service configured.

### Database backup utility

Run from the `backend` directory:

```sh
npm run db:backup
```

Requirements:
- MySQL 8 client tools (`mysqldump`) installed and available on PATH, or set `MYSQLDUMP_PATH`.
- Existing database connection variables in `backend/.env`.
- The configured database account must have the privileges required by `mysqldump` for the selected database.
- Use a dedicated backup-capable account in production if the least-privilege runtime account cannot read routines/events. Do not broaden runtime application grants just to make backups work.

Optional settings:
- `DB_BACKUP_DIR`: backup destination; defaults to `backend/backups`.
- `DB_BACKUP_RETENTION_DAYS`: retention period from 1 to 365 days; defaults to 7.
- `MYSQLDUMP_PATH`: explicit path to the MySQL dump executable.

The utility writes to a temporary `.partial` file, verifies non-empty output, atomically renames the completed backup, and prunes only timestamped backup files created by this utility. Passwords are passed through the child process environment and are never included in command-line arguments or logs. The backup directory is git-ignored.

Schedule `npm run db:backup` with Windows Task Scheduler, cron, or the hosting provider's scheduled-job facility. Keep backups encrypted and outside the application server; test restore procedures regularly. This script does not automatically upload backups to a cloud destination.

## Existing protections retained

The main branch already contains transactional booking creation/cancellation, uniqueness-backed seat reservation integrity, role-based admin authorization, CSRF/same-origin checks, login/registration rate limiting, server-side validators, centralized API error responses, graceful server shutdown, and a substantial Node.js test suite. This branch does not duplicate those features.

## Product-flow limitations: do not fake automation

- Booking creation currently inserts bookings directly as `CONFIRMED`; there is no `PENDING` payment/reservation state, payment gateway, or expiry timestamp in the booking flow. Automatically expiring confirmed bookings would cancel valid demo reservations. A safe expiry workflow requires an approved pending-payment state, expiry column, and transactional state transition/migration.
- There is no payment provider integrated. Payment receipts and payment-success notifications cannot be truthfully generated.
- Email delivery requires a chosen provider, verified sender/domain, credentials, delivery/retry policy, and user consent/preferences. Add it only after those decisions; do not silently make SMTP a production dependency.
- The current rate limiter is in-process. A shared store is needed before deploying multiple application instances.
- Sentry/hosted monitoring requires an approved provider and DSN. Structured logs can be added without leaking credentials or personal data, but log retention and access policy must be configured at deployment.

## Verification

From `backend`:

```sh
npm ci
npm run test:all
npm run db:backup
```

The backup command should first be exercised against a non-production database. A successful dump is not proof of recoverability: restore it into a disposable database and verify schema and representative records.
