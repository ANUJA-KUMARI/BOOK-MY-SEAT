# Phase 8 — Stage 4: Cinema, Screen & Seat Layout Management

Branch: `phase-8/stage-4-cinema-screen-management`

## Delivered in this stage

- Admin cinema directory with cinema name, city and full address.
- Create and edit cinema records.
- Create screens under a selected cinema and rename screen records.
- Display screen and seat counts for each cinema.
- Inspect a screen's current seat layout.
- Build seat layouts by row, seat count and category (STANDARD, PREMIUM, RECLINER).
- Preview seat layouts before saving.
- Transactional seat-layout replacement with row/category/count validation.
- Protected admin endpoints using current database-backed ADMIN role verification and same-origin + CSRF checks for mutations.

## API

All endpoints are under `/api/admin`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/cinemas` | List cinemas and aggregate screen/seat counts |
| POST | `/cinemas` | Create cinema |
| PATCH | `/cinemas/:id` | Update cinema details |
| GET | `/cinemas/:cinemaId/screens` | List screens for a cinema |
| POST | `/cinemas/:cinemaId/screens` | Add screen to cinema |
| PATCH | `/screens/:id` | Rename screen |
| GET | `/screens/:screenId/seats` | Read screen seat layout |
| PUT | `/screens/:screenId/seats` | Replace layout transactionally |

## Data integrity and safety

- A screen name is unique within its cinema, enforced by the existing unique database key.
- Row labels must be unique, 1–5 uppercase letters/digits.
- Layouts are limited to 20 rows, 30 seats per row and 300 seats total.
- Every row has one category: STANDARD, PREMIUM or RECLINER.
- Layout replacement is rejected if the screen already has any show. This prevents changing seat IDs or positions after shows/bookings may reference them.
- Existing schema is reused; no SQL migration is needed.

## Files added/updated

- `backend/validators/admin-venues.js`
- `backend/services/admin-venues.service.js`
- `backend/controllers/admin-venues.controller.js`
- `backend/routes/admin-venues.routes.js`
- `backend/routes/index.js`
- `backend/tests/admin-venues-validator.test.js`
- `backend/tests/admin-venues.integration.test.js`
- `frontend/js/api.js`
- `frontend/admin/venues.html`
- `frontend/admin/venues.css`
- `frontend/admin/venues.js`
- `frontend/admin/index.html`
- `frontend/admin/movies.html`

## Verification

Run from the backend folder:

```powershell
cd "E:\BOOK MY SEAT\backend"
npm test
npm run test:frontend
npm run db:check
```

Then sign in with an ADMIN account and open `/admin/venues.html`. Verify cinema creation/editing, screen creation, row configuration, preview and save. Confirm that a USER and an unauthenticated visitor cannot read or mutate admin venue APIs.

Do not mark this stage complete until automated tests and browser/database checks pass.
