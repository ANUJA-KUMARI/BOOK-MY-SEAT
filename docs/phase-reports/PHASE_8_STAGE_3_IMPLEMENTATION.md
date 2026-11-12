# Phase 8 — Stage 3: Movie & Genre Management

## Branch
`phase-8/stage-3-movie-genre-management`

## Scope implemented
- Admin movie inventory: list, search, filter by active/inactive status.
- Movie creation and partial updates.
- Assign multiple existing genres to a movie.
- Activate/deactivate movies without deleting records.
- Prevent deactivation while a movie has future scheduled shows.
- Genre creation, rename, usage counts, and guarded deletion.
- Admin dashboard navigation to the Movie & Genre Management page.
- Customer catalogue continues to read from the existing `/api/movies` endpoints and only returns active movies.

## API endpoints
All endpoints are mounted under `/api/admin` and require a valid session whose current database role is `ADMIN`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/movies` | List all, active or inactive movies; optional search |
| POST | `/movies` | Create a movie |
| PATCH | `/movies/:id` | Update movie fields and/or genre assignments |
| PATCH | `/movies/:id/status` | Activate/deactivate a movie |
| GET | `/genres` | List genres and linked movie counts |
| POST | `/genres` | Create a genre |
| PATCH | `/genres/:id` | Rename a genre |
| DELETE | `/genres/:id` | Delete an unused genre |

All mutation endpoints require same-origin and CSRF checks. SQL values use prepared parameters. Movie/genre mapping updates use database transactions.

## Security hardening
The authentication middleware now reloads the account from MySQL on each authenticated API request. The current database role, not the role snapshot embedded in the JWT, is used by authorization middleware. This makes a demoted or deleted account lose admin access immediately.

## Data safety decisions
- Movie records are deactivated, not hard-deleted, preserving foreign-key references from shows and bookings.
- A movie with upcoming scheduled shows cannot be deactivated.
- A genre assigned to a movie cannot be deleted until it is unassigned.
- Movie creation and movie/genre assignment updates are transactional.

## Files added/updated
- `backend/middleware/authenticate.js`
- `backend/routes/index.js`
- `backend/routes/admin.routes.js`
- `backend/controllers/admin-catalog.controller.js`
- `backend/services/admin-catalog.service.js`
- `backend/validators/admin.js`
- `backend/tests/admin-validator.test.js`
- `backend/tests/admin-catalog.integration.test.js`
- `frontend/js/api.js`
- `frontend/admin/index.html`
- `frontend/admin/movies.html`
- `frontend/admin/movies.js`
- `frontend/admin/movies.css`

## Verification still required
Run the complete release suite from the backend directory:

```powershell
cd "E:\BOOK MY SEAT\backend"
npm run test:release
```

Then sign in with the existing ADMIN account and verify:
1. Movie and genre lists load.
2. Create a genre, rename it, and remove it after it is unassigned.
3. Create a movie and assign multiple genres.
4. Edit the movie and verify changes.
5. Deactivate/reactivate a movie with no upcoming scheduled shows.
6. Confirm the customer movie catalogue reflects active movie changes.
7. Confirm USER and unauthenticated sessions receive 403/401 from admin APIs.

No schema migration is required; this stage uses the existing `movies`, `genres`, and `movie_genres` tables.
