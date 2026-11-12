# BOOK_MY_SEAT — Phase 8 Report
## Administration, Management and Final Integration

| Item | Detail |
|---|---|
| Phase | 8 of 8 — Admin modules, dashboard, booking register and final QA |
| Audited branch | `phase-8/stage-6-booking-management-dashboard` |
| Security | JWT authentication, current database role, ADMIN authorization, same-origin and CSRF |
| Status | Implementation merged into main; owner-reported tests and browser checks completed |

## 1. Phase objective

Phase 8 added the administrative side of BOOK_MY_SEAT. It provides controlled management of the movie catalogue, genres, cinemas, screens, seat layouts, shows and category pricing, together with a dashboard and a read-only booking register.

The implementation reused the existing MySQL schema and authentication model. The admin functions were designed to preserve customer bookings and historical price snapshots rather than delete or rewrite referenced records.

## 2. Admin security architecture

All reviewed admin route groups apply the shared `authenticate` middleware followed by `authorize('ADMIN')`.

Authentication verifies the HttpOnly access-token cookie and reloads the current account from MySQL. Authorization uses the current database role rather than trusting a stale role value embedded in a JWT. Unauthenticated requests receive 401; authenticated USER accounts receive 403.

Mutation routes apply both `requireSameOrigin` and `requireCsrf`. Read-only GET routes do not mutate application state. SQL values are parameterized, and request-specific validators constrain route IDs, pagination, status filters, search text, movie fields, URLs, genre IDs, UTC timestamps, price categories/amounts, venue text and seat-layout dimensions/categories.

Public registration continues to force the USER role. Admin privileges are not available through public registration.

## 3. Movie and genre management

Admin movie/genre management provides:
- Movie inventory with list, search and active/inactive filtering.
- Movie creation and partial updates.
- Assignment of multiple existing genres to a movie.
- Activation/deactivation without hard deletion.
- Genre creation, rename, usage counts and guarded deletion.

API routes under `/api/admin`:
- `GET /movies`
- `POST /movies`
- `PATCH /movies/:id`
- `PATCH /movies/:id/status`
- `GET /genres`
- `POST /genres`
- `PATCH /genres/:id`
- `DELETE /genres/:id`

Movie/genre updates use transactions. A movie with future scheduled shows cannot be deactivated. A genre linked to a movie cannot be deleted until it is unassigned. Movie records are deactivated rather than hard-deleted, preserving foreign-key references from shows and bookings.

## 4. Cinema, screen and seat-layout management

Admin venue management provides:
- Cinema directory with name, city and address.
- Create/edit cinema records.
- Create screens under a cinema and rename screens.
- Display screen/seat counts and inspect a screen's seat layout.
- Configure row count, seats per row and category (STANDARD, PREMIUM, RECLINER).
- Preview a layout before saving.

API routes under `/api/admin`:
- `GET /cinemas`, `POST /cinemas`, `PATCH /cinemas/:id`
- `GET /cinemas/:cinemaId/screens`, `POST /cinemas/:cinemaId/screens`
- `PATCH /screens/:id`
- `GET /screens/:screenId/seats`, `PUT /screens/:screenId/seats`

A screen name is unique within its cinema. Row labels must be unique and 1–5 uppercase letters/digits. Layouts are limited to 20 rows, 30 seats per row and 300 seats total. Each row has one supported category. Layout replacement is rejected if the screen already has any show, preventing seat IDs/positions from changing after shows or bookings may reference them. Layout replacement is transactional. No schema migration was required.

## 5. Show scheduling and dynamic pricing

The admin show module allows administrators to:
- Select an active movie, cinema and screen.
- Schedule a future show using local browser date/time converted to ISO UTC.
- Set STANDARD, PREMIUM and RECLINER prices for each show.
- Edit prices only for future SCHEDULED shows.
- Cancel future scheduled shows.
- Mark shows COMPLETED only after the scheduled movie duration has elapsed.

API routes:
- `GET /shows`
- `POST /shows`
- `PATCH /shows/:id/prices`
- `PATCH /shows/:id/status`

Scheduling requires an active movie and a screen with configured seats. All three category prices are required, non-negative, limited to two decimal places and capped at 999999.99. Scheduling runs in a transaction and locks the screen row. Overlap detection compares movie duration against existing SCHEDULED shows on that screen. Cancelled/completed shows do not block new scheduling. The exact-time unique key remains an additional safeguard.

Show and price rows are inserted atomically. Shows are not deleted; cancellation preserves booking references. A started show cannot be cancelled. Price edits are limited to future scheduled shows.

The existing schema already contains `shows` and `show_prices`; no migration was required. The stage documentation identifies required INSERT/UPDATE grants for the application account, applied explicitly by a database administrator rather than silently by application startup.

## 6. Admin dashboard and booking register

Stage 6 delivered:
- Dashboard counts for total, confirmed and cancelled bookings.
- Confirmed booking revenue.
- Active movies, cinemas, screens and upcoming shows.
- Recent booking activity and the next five upcoming shows.
- Booking register searchable by booking reference, customer name or email.
- Status filter (all, confirmed, cancelled), page-size selection and pagination.
- Booking detail view with customer identity, movie, cinema, screen, showtime, timestamps, seat categories and historical price snapshots.

API endpoints:
- `GET /api/admin/dashboard`
- `GET /api/admin/bookings?search=&status=&page=&limit=`
- `GET /api/admin/bookings/:id`

These booking-management endpoints are read-only. They do not cancel reservations, change booking status or modify payment records. Confirmed revenue is the sum of `total_amount` for CONFIRMED bookings; cancelled bookings are excluded. Seat details use `booking_seats.price_snapshot`, not current show prices.

## 7. Data-integrity and concurrency safeguards

The reviewed implementation includes:
- Movie deactivation is rejected while future scheduled shows exist. The movie row is locked transactionally, serializing deactivation with show creation.
- Genre deletion is rejected while movies reference the genre.
- Show creation rejects overlapping scheduled shows on the same screen.
- Show creation requires an active movie and a configured screen with seats.
- Price changes are restricted to future scheduled shows.
- Show status transitions respect current status and show timing.
- Seat-layout replacement is rejected after shows exist on the screen.
- Booking administration is read-only and preserves historical snapshots.

The final audit identified and fixed a concurrency window between movie deactivation and show creation by locking the movie row inside a transaction.

## 8. Visual correction

The admin sidebar layout correction in `frontend/admin/admin.css` stabilizes the sidebar grid column, prevents brand/navigation items from shrinking or overflowing, and preserves a single-column mobile layout. Owner-provided browser screenshots showed the dashboard, booking management and Movies & genres module loading, with the sidebar aligned after the CSS correction.

## 9. Tests and owner-reported verification

The reviewed repository contains admin integration tests for booking/dashboard access, catalogue authorization and CSRF, show route authorization/validation and venue route authorization, together with validator and booking-service helper tests.

Owner-reported results:
- `tests/admin-bookings.service.test.js`: 4 passed, 0 failed.
- `tests/movie-service.test.js`: 49 passed, 0 failed after obsolete unbooked show 9415 was removed from the local database.
- The owner reported the complete backend `npm test` run ended with 0 failures.
- The owner reported browser verification of the admin dashboard and booking management; screenshots showed live booking rows, customer details, movie/show details, seat counts, amounts and confirmed statuses.
- A subsequent Movies & genres screenshot showed the module loaded and sidebar alignment corrected.

These are owner-reported local results, not a claim that this report independently executed the Windows/MySQL environment. The repository audit is not a penetration test or formal security certification.

## 10. Integration and project status

Phase 8 was integrated into `main` through PR #1 using a squash merge. The recorded merge commit was:

`96a5a774e4eda21b18e1e3d243f254f5efef299d`

The project owner confirmed that local `main` was synchronized with `origin/main` and the working tree was clean. Later deployment-preparation files were added, but public deployment was paused because the owner does not want hosting costs. Deployment is not required to demonstrate the completed local full-stack project.

## 11. Limitations and completion summary

- No payment gateway or payment processing is integrated. A booking is a demo reservation, not proof of payment or a paid ticket.
- Admin booking management is read-only; it does not edit/cancel bookings or process refunds.
- The in-memory rate limiter is not suitable for consistent enforcement across multiple instances; shared storage would be required before scaling.
- The project has not been publicly deployed.

Phase 8 delivered protected catalogue, venue, seat, show and pricing management, dashboard metrics, recent/upcoming activity and a read-only booking register. The phase was merged into main, and the owner reported successful backend tests and browser checks. The eight-phase local project is complete; public deployment remains intentionally deferred.
