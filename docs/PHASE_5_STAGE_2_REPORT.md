# Phase 5 — Stage 2 Implementation Report

**Branch:** `phase-5/stage-2-batch-3`  
**Status:** Completed; included in the project owner's final local verification of 200 passing tests across 48 suites and a successful database check.

## Delivered

- Registration endpoint: `POST /api/auth/register`; validates input, hashes passwords with bcrypt (12 rounds), normalizes email, forces the `USER` role and returns no password/hash.
- Login endpoint: `POST /api/auth/login`; checks credentials using a parameterized query and bcrypt comparison, returns a generic invalid-credentials message, signs a 15-minute JWT and sets it in an HttpOnly cookie.
- Current-user endpoint: `GET /api/auth/me`; verifies the JWT cookie and reloads the current account from MySQL before returning the safe user profile.
- Logout endpoint: `POST /api/auth/logout`; clears the access-token and CSRF cookies. As approved, already-copied JWTs naturally expire rather than being revoked server-side.
- JWT validation is pinned to HS256 and checks issuer, audience and expiry.
- Authentication middleware attaches only the verified user id and role. A reusable role-authorization middleware is available for later admin routes.
- Cookie parsing is enabled in the Express app.
- CSRF protection uses same-origin Origin validation plus a double-submit cookie/header token for logout. Login and registration also require same-origin Origin validation.
- Rate limiting: 5 login attempts per 15 minutes and 5 registration attempts per hour.
- Added focused tests for login/register validation, CSRF primitives, role authorization and protected route behavior.

## Endpoints

| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/register` | Same-origin; registration limiter |
| POST | `/api/auth/login` | Same-origin; login limiter |
| GET | `/api/auth/me` | Valid access-token cookie |
| POST | `/api/auth/logout` | Valid access-token cookie, same-origin and CSRF token |

## Security decisions preserved

- bcrypt work factor: 12.
- JWT expiry: 15 minutes.
- JWT stored in an HttpOnly cookie; JavaScript cannot read it.
- `Secure` cookie flag enabled in production.
- `SameSite=Lax`, path `/`.
- Registration cannot choose or escalate its role.
- No schema changes, database grants, booking features or frontend integration were made.
- The actual `.env` and JWT secret are not committed.

## Verification status

No test result is claimed in this report. The user requested one consolidated test run after Stage 2 implementation is complete. Run `npm test` and the database-backed checks from the local Windows environment before accepting Stage 2. If failures occur, fix them before proceeding to the next stage.
