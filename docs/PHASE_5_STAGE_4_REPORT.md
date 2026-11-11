# Phase 5 — Stage 4: Authentication Middleware and User Identity

**Branch:** `phase-5/stage-4-auth-middleware`  
**Status:** Completed; included in the project owner's final local verification of 200 passing tests across 48 suites and a successful database check.

## Agreed scope

Stage 4 establishes verified request identity for protected routes and a role-aware authorization foundation. It builds on the existing Stage 2/3 authentication flow; it does not add duplicate endpoints or middleware.

## Existing functionality audited and retained

- `authenticate` reads the access token only from the HttpOnly `bms_token` cookie.
- JWT verification pins HS256 and validates signature, expiry, issuer and audience.
- Verified identity is attached to the request as `req.auth`.
- `GET /api/auth/me` reloads the account from MySQL using the verified user ID and returns a safe profile.
- `authorize(...roles)` rejects unauthenticated requests with 401 and disallowed roles with 403.
- The `/api/auth/me` route is protected by authentication middleware.

## Stage 4 changes

- Tightened JWT subject validation: the subject must be a positive decimal user ID that is a JavaScript safe integer.
- Added middleware tests for missing tokens, valid USER/ADMIN identities, expiry, issuer/audience mismatch, algorithm rejection and malformed identity claims.
- Added current-user controller tests proving the identity is reloaded by verified ID, only safe profile fields are returned, and a deleted/unavailable account receives 401.

## Security boundaries

- The token remains HttpOnly and is not exposed to frontend JavaScript.
- Role claims are accepted only from a cryptographically verified token.
- This stage does not add admin CRUD or change role assignment/registration behavior.
- No database schema, grants, booking workflow or frontend integration changes were made.
- Logout and CSRF behavior remain in the prior approved stage and are not duplicated here.

## Verification

Local verification is pending. From the Windows project environment:

```powershell
Set-Location "E:\BOOK MY SEAT"
git pull origin phase-5/stage-4-auth-middleware

Set-Location "E:\BOOK MY SEAT\backend"
npm test
npm run db:check
```

Do not share the contents of `.env` or the JWT signing secret.
