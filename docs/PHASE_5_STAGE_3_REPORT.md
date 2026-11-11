# Phase 5 — Stage 3: Login and JWT Authentication

**Branch:** `phase-5/stage-3-login-jwt`  
**Status:** Completed; included in the project owner's final local verification of 200 passing tests across 48 suites and a successful database check.

## Scope

Stage 3 delivers the login and signed access-token flow on top of the approved Stage 2 registration foundation. It does not connect the frontend or implement bookings, seat availability, or admin CRUD.

## Delivered

- `POST /api/auth/login` validates the request before database access.
- Login delegates credential lookup and bcrypt comparison to the authentication service.
- Unknown email and incorrect password share the same generic `401` response.
- Successful login signs a JWT using HS256, the configured issuer/audience, the user's database ID as `sub`, and the approved 15-minute expiry.
- The access token is set in the `bms_token` cookie with `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in production.
- A separate CSRF cookie is issued for the subsequent state-changing request flow.
- Login fails closed with HTTP 503 if `JWT_SECRET` is not configured, rather than attempting to issue a token or surfacing a generic server error.
- Added focused tests for cookie attributes, token claims and lifetime, expiry rejection, algorithm pinning, and missing-secret behavior.

## Configuration

The signing secret is supplied only through the local environment as `JWT_SECRET`. It must be at least 32 characters and must not be committed. The approved defaults remain:

- Algorithm: HS256
- Expiry: 15 minutes
- Issuer: `book-my-seat`
- Audience: `book-my-seat-client`

## Verification

Local verification is pending. Run the complete backend suite and database check from the Windows project environment before accepting this stage:

```powershell
Set-Location "E:\BOOK MY SEAT\backend"
npm test
npm run db:check
```

Do not share the contents of `.env` or the JWT signing secret when reporting results.
