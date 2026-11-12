# Phase 8 — Stage 5: Show Scheduling & Dynamic Pricing

Branch: `phase-8/stage-5-show-scheduling-pricing`

## Scope delivered

- Admin-only show inventory and scheduling UI.
- Select an active movie, cinema and screen.
- Schedule a future show using the browser's local date/time; the browser converts it to ISO UTC before sending it to the API.
- Set all three category prices (STANDARD, PREMIUM, RECLINER) for every show.
- Edit prices only while a show is future-dated and SCHEDULED.
- Cancel future scheduled shows and mark shows COMPLETED only after their movie duration has elapsed.
- Protect all mutations with the existing same-origin and double-submit CSRF middleware.
- Protect all routes with database-backed ADMIN authorization.

## API

All endpoints are under `/api/admin`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/shows` | List the latest 500 shows with movie, venue, screen, UTC start time, status and category prices |
| POST | `/shows` | Schedule a show and create its three category prices atomically |
| PATCH | `/shows/:id/prices` | Update prices for a future scheduled show |
| PATCH | `/shows/:id/status` | Cancel a future show or complete a show after its duration |

## Scheduling rules and data integrity

- A show must use an existing active movie and existing screen.
- A screen must have at least one configured seat.
- A show must be scheduled in the future.
- All three category prices are required, numeric, non-negative, limited to two decimal places and capped at 999999.99.
- Scheduling runs in a transaction and locks the screen row. This serializes concurrent scheduling attempts for the same screen.
- Overlap detection compares the requested movie duration against every existing SCHEDULED show on that screen. Cancelled and completed shows do not block new scheduling.
- The database's unique key on (screen_id, start_time) remains an additional exact-time safeguard.
- Every new show and its three show_prices rows commit together; failures roll back the entire operation.
- Show records are not deleted. Cancellation preserves references from bookings.
- A show that has started cannot be cancelled. A show can only be marked completed after its scheduled movie duration has elapsed.
- Prices can only be edited for future SCHEDULED shows.

## Time convention

The project stores show DATETIME values in UTC. The admin browser accepts local date/time, converts it with JavaScript `Date` to an ISO-8601 UTC timestamp ending in `Z`, and the backend validates and stores the UTC value. Existing public movie-show APIs continue returning UTC ISO timestamps, which the browser renders in local time.

## Database permissions

The schema already contains `shows` and `show_prices`; no migration is required. The dedicated app user needs table-level INSERT and UPDATE on both tables. The updated `database/create_app_user.sql` also documents the existing Stage 4 cinema/screen/seat permissions. Run it in MySQL Workbench as the database administrator to apply the grants to both supported `bms_app` host accounts.

## Files added/updated

- `backend/validators/admin-shows.js`
- `backend/services/admin-shows.service.js`
- `backend/controllers/admin-shows.controller.js`
- `backend/routes/admin-shows.routes.js`
- `backend/routes/index.js`
- `backend/tests/admin-shows-validator.test.js`
- `backend/tests/admin-shows.integration.test.js`
- `frontend/js/api.js`
- `frontend/tests/api.test.js`
- `frontend/admin/shows.html`
- `frontend/admin/shows.css`
- `frontend/admin/shows.js`
- `frontend/admin/index.html`
- `frontend/admin/movies.html`
- `frontend/admin/venues.html`
- `database/create_app_user.sql`

## Verification required before sign-off

Run from the backend folder:

```powershell
cd "E:\BOOK MY SEAT\backend"
npm run test:release
```

Then verify in MySQL Workbench that the app user has INSERT and UPDATE on `shows` and `show_prices`.

Run the app, sign in with an ADMIN account and open `/admin/shows.html`. Verify:
1. Active movies, cinemas and screens load in the selectors.
2. A show can be scheduled on a screen with a configured seat layout.
3. The show and all three prices persist after refresh.
4. A second show that overlaps the first on the same screen is rejected.
5. A show on a different screen can be scheduled at the same time.
6. Category prices can be updated for a future scheduled show and persist after refresh.
7. A scheduled show can be cancelled; cancelled shows remain in the inventory.
8. A future show cannot be marked completed; a past show can only be completed after its duration.

Do not mark Stage 5 complete until automated tests and browser/database checks pass.
