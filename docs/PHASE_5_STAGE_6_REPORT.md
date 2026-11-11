# Phase 5 — Stage 6: Authentication Integration and Final Regression

**Branch:** `phase-5/stage-6-auth-integration`  
**Status:** Implementation committed; local verification pending.

## Objective

Verify the complete authentication request flow across the existing registration, login, JWT, current-user, CSRF and logout components. This is a final integration and regression stage; it does not introduce another authentication mechanism.

## Delivered

- Added an HTTP-level integration test for the complete sequence:
  1. Register a new account request.
  2. Confirm the server forces the role to `USER` and does not issue a session during registration.
  3. Log in and receive the HttpOnly `bms_token` and readable double-submit `bms_csrf` cookies.
  4. Call `GET /api/auth/me` using the issued cookies and confirm a safe profile is returned.
  5. Log out with same-origin and matching CSRF proof.
  6. Confirm both cookies are cleared and a subsequent `GET /api/auth/me` is unauthorized.
- The integration test stubs only the service/database boundary. It exercises the real Express routes, controllers, cookie middleware, JWT signing/verification, CSRF middleware and error handling without inserting test accounts into the owner's MySQL database.
- The test is skipped only when `JWT_SECRET` is not configured; all non-secret-dependent tests continue to run.

## Final authentication contract

| Method | Endpoint | Expected behavior |
|---|---|---|
| POST | `/api/auth/register` | Validates input, hashes password, forces USER role, returns safe profile |
| POST | `/api/auth/login` | Verifies credentials and issues 15-minute JWT + CSRF cookies |
| GET | `/api/auth/me` | Verifies JWT and reloads safe user profile |
| POST | `/api/auth/logout` | Requires same-origin, authenticated session and matching CSRF token; clears both cookies |

## Scope boundaries

- No frontend API wiring (Phase 7).
- No booking/seat workflows (Phase 6).
- No admin CRUD (Phase 8).
- No database schema or privilege changes.
- No server-side JWT revocation list; a copied token remains valid until its approved expiry.
- No real MySQL account is created by the new integration test.

## Verification

Local verification is pending. Run from the Windows project environment:

```powershell
Set-Location "E:\BOOK MY SEAT"
git pull origin phase-5/stage-6-auth-integration

Set-Location "E:\BOOK MY SEAT\backend"
npm test
npm run db:check
```

The project owner should report the full test summary. Do not share the contents of `.env` or the JWT signing secret.
