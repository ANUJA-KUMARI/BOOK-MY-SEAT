# BOOK_MY_SEAT — Booking Lifecycle Automation Design

**Status:** Design proposal only. No production schema, API, or customer-flow changes are made by this document.

## 1. Why this stage starts with a design

The current customer flow is a demo reservation: `POST /api/bookings` inserts a booking directly as `CONFIRMED`, reserves its seats in `booking_seats`, and explicitly tells the customer that no real payment is taken. There is no payment provider, payment-intent record, pending state, or expiry timestamp.

Automatically expiring current `CONFIRMED` bookings would therefore be incorrect: it could release a customer's valid demo reservation. A pending lifecycle must be introduced deliberately and migrated without changing the meaning of existing records.

## 2. Current invariants to preserve

- Booking creation and cancellation run inside MySQL transactions.
- The unique key `uq_booking_seats_show_seat_active (show_id, seat_id, active)` prevents two active reservations for the same seat/show.
- `booking_seats.active = 1` means a seat is reserved; `NULL` means it was released.
- `price_snapshot` preserves the price charged/quoted at booking time.
- Cancellation is owner-scoped and currently disallowed within two hours of showtime.
- Admin booking lookup is read-only.
- The API returns the established `{ success, data }` / `{ success: false, error }` envelope.
- Existing confirmed/cancelled booking history must remain readable and unchanged.

## 3. Proposed lifecycle

Proposed statuses:

| Status | Meaning | Holds seats? | Terminal? |
|---|---|---:|---:|
| `PENDING` | A temporary reservation awaiting the configured confirmation action | Yes | No |
| `CONFIRMED` | Customer completed the confirmation action | Yes | No |
| `CANCELLED` | Customer or an authorized workflow cancelled it | No | Yes |
| `EXPIRED` | The pending reservation passed its expiry deadline | No | Yes |

Allowed transitions:

```text
PENDING -> CONFIRMED
PENDING -> CANCELLED
PENDING -> EXPIRED
CONFIRMED -> CANCELLED (existing two-hour policy)
```

No transition out of `CANCELLED` or `EXPIRED`. A confirmation arriving after expiry must not revive the old booking or reacquire seats; the customer must start a new reservation.

### Important product decision

Because this project currently has no payment integration, `CONFIRMED` must not be described as paid. There are two valid product directions:

1. **Demo confirmation (recommended for the current academic project):** the user explicitly confirms a temporary seat hold. The UI continues to say that no real payment is taken. This demonstrates expiry and lifecycle automation without pretending a payment happened.
2. **Real payment later:** keep the booking pending until a verified provider webhook confirms a payment intent. This requires provider selection, payment-intent persistence, signature verification, idempotency, refund/late-payment handling, and secrets. It is not part of this stage.

Do not build a fake payment-success screen or send a payment receipt for the demo path.

## 4. Proposed database migration (not yet applied)

A forward-only migration should:

- Extend the booking status enum to include `PENDING` and `EXPIRED`.
- Add nullable `expires_at DATETIME` and `confirmed_at DATETIME` columns.
- Add an index supporting expiry scans, e.g. `(status, expires_at, id)`.
- Preserve all existing `CONFIRMED` and `CANCELLED` rows as-is.
- Leave existing seat rows and historical price snapshots untouched.

Existing records must not be backfilled as pending or assigned an expiry. The original `schema.sql` remains a fresh-install schema; a separately numbered migration must support existing installations. Migration execution must be an explicit DBA/operator action, not an automatic server-startup side effect.

Before applying the migration, verify the exact MySQL version and inspect the live schema. Take and test a backup first.

## 5. Transaction design

### Create a pending hold

Within one transaction:

1. Validate the authenticated user, show, seat count, and IDs.
2. Lock/read the scheduled show and validate its start time.
3. Read seats belonging to the show's screen and authoritative show prices.
4. Calculate totals on the server.
5. Insert a `PENDING` booking with `expires_at` based on the approved hold duration.
6. Insert each `booking_seats` row with `active = 1` and the price snapshot.
7. Commit. A duplicate-key conflict remains HTTP 409 and means another active reservation won the race.

The unique active-seat key remains the final concurrency guard. A pre-check alone is never sufficient.

### Confirm a pending hold

Within one transaction, lock the booking row using `SELECT ... FOR UPDATE`, verify ownership, `PENDING` status, and that `expires_at > UTC_TIMESTAMP()`. Change status to `CONFIRMED`, set `confirmed_at`, clear `expires_at`, and commit. Repeated confirmation requests must be idempotent or return a clear conflict without duplicating side effects.

### Expire pending holds

A scheduled worker periodically selects a bounded batch of due pending rows. For each row (or a safely bounded batch):

1. Lock the booking row.
2. Re-check `status = 'PENDING'` and `expires_at <= UTC_TIMESTAMP()` under the lock.
3. Change status to `EXPIRED`.
4. Release only that booking's active seat rows by setting `active = NULL`.
5. Commit both changes together.

This must be safe when expiry races with customer confirmation or cancellation. The row lock and conditional state check decide the winner. A retry must never release seats belonging to a later booking.

The worker must be safe to run more than once, process bounded batches, log counts/duration without customer secrets, and expose failures to the operator. Do not rely on an in-memory timer inside every web-server instance; multiple instances could run duplicate jobs and process restarts could miss work. For the local project, a separately invoked Node script or a single OS-scheduled process is sufficient.

## 6. API and UI changes proposed

Candidate API contract:

- `POST /api/bookings`: creates a pending hold and returns `expires_at` and remaining hold time.
- `POST /api/bookings/:id/confirm`: owner-scoped confirmation of a pending demo hold, protected by same-origin and CSRF middleware.
- Existing `DELETE /api/bookings/:id`: allow pending cancellation (without the two-hour confirmed-show cutoff) and preserve the existing cutoff for confirmed bookings.
- Booking history/detail: return `expires_at` and the new status values.
- Seat map: continue to show any active hold as unavailable; optionally distinguish temporary holds only to the owner in a future UI enhancement.

Frontend should show a clear countdown using server-provided `expires_at`, refresh status from the API, and never decide expiry authoritatively from browser time. If the hold expires, show a message and refresh the seat map. The server/database remains authoritative.

Admin reporting must count `PENDING` and `EXPIRED` separately. Confirmed revenue must continue to exclude pending, cancelled, and expired reservations.

## 7. Notification architecture proposal

Do not send email inside a booking transaction. A mail provider outage must not roll back a valid reservation.

Use a transactional outbox if notifications are approved:

- Insert an outbox event in the same transaction as the state transition.
- A separate worker claims due events, sends through the selected provider, and records attempts/status.
- Use a unique event key to prevent duplicate notifications.
- Retry transient failures with bounded exponential backoff; dead-letter permanent failures.
- Never log access tokens, passwords, full payment data, or unnecessary personal data.
- Respect user notification preferences and provide a clear sender identity.

For the demo path, messages should be reservation/confirmation/cancellation/expiry notices, not payment receipts. Provider, verified sender, credentials, privacy/consent and delivery policy must be selected before implementing email.

## 8. Required tests before release

- New hold creates `PENDING`, expiry timestamp and active seat rows atomically.
- Invalid show/seat/pricing and duplicate seat requests create no partial rows.
- Two users racing for one seat: exactly one active reservation succeeds.
- Confirmation before expiry succeeds once and preserves seats.
- Confirmation after expiry fails and cannot reacquire seats.
- Expiry worker releases seats and marks `EXPIRED` atomically.
- Confirmation-versus-expiry race has exactly one valid terminal outcome.
- Re-running expiry is idempotent.
- Pending cancellation releases seats; confirmed cancellation retains the two-hour rule.
- Owner isolation and CSRF/same-origin protections remain enforced.
- Booking history and admin dashboard/register correctly handle all statuses.
- Existing confirmed/cancelled rows and historical prices remain intact.
- Migration and restore are tested against a disposable MySQL database.

## 9. Decisions required before implementation

The following values affect customer-visible behavior and should be explicitly approved:

1. Hold duration: proposed default **10 minutes**.
2. Confirmation action for the academic demo: proposed **explicit “Confirm reservation”**, with a persistent “No real payment is taken” notice.
3. Expiry worker cadence: proposed **every minute**, using one scheduled worker process.
4. Email: defer until a provider and sender are selected; do not block core booking lifecycle on email.
5. Payment: out of scope until a real provider is chosen.

## 10. Safe implementation order

1. Approve the lifecycle semantics and hold duration.
2. Write and review the forward-only MySQL migration.
3. Add service-level transition functions and unit/integration tests.
4. Add the bounded expiry worker and operational command.
5. Update customer booking UI and admin reporting.
6. Add transactional outbox and provider-backed email only after provider/consent decisions.
7. Back up a disposable database, apply migration, run full regression tests, exercise concurrency, and test restore.

**No production database changes have been made by this proposal.**
