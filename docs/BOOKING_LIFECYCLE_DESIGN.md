# BOOK_MY_SEAT — Booking lifecycle design

- New reservations enter `PENDING` for 10 minutes.
- Explicit customer confirmation changes `PENDING` to `CONFIRMED`.
- Pending reservations can be cancelled or expire.
- Confirmed bookings retain the existing two-hour cancellation cutoff.
- Expiry applies only to overdue `PENDING` rows; it never touches legacy `CONFIRMED` bookings.
- `booking_seats.active = 1` reserves a seat; setting it to NULL releases it.
- Booking and seat state transitions are committed together in transactions.
- The unique active-seat key remains the final concurrency guard.
- Email and real payment are deferred. Confirmation is a demo action, not proof of payment.
- Migration is forward-only and manually applied after a backup. See [BOOKING_LIFECYCLE_OPERATIONS.md](BOOKING_LIFECYCLE_OPERATIONS.md).
