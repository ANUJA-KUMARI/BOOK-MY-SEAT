# Phase 5 — Stage 5: CSRF, Logout and Abuse Controls

**Branch:** `phase-5/stage-5-security-controls`  
**Status:** Completed; included in the project owner's final local verification of 200 passing tests across 48 suites and a successful database check.

## Scope

Stage 5 consolidates and verifies the session-adjacent security controls already introduced with the authentication endpoints. It does not add a new token/session model.

## Controls retained and tested

- Same-origin validation requires an Origin header whose protocol, host and port match the request.
- State-changing logout requires a double-submit CSRF token: the readable `bms_csrf` cookie must match the `x-csrf-token` request header.
- CSRF comparison uses a timing-safe comparison after checking equal lengths.
- Logout clears both `bms_token` and `bms_csrf` cookies with matching path and security attributes.
- Login attempts are limited to 5 per 15-minute window.
- Registration attempts are limited to 5 per one-hour window.
- Rate-limit responses are HTTP 429 and use the configured safe generic messages.

## Token logout semantics

The approved strategy is stateless JWT with a 15-minute expiry and no server-side token revocation list. Logout clears the browser cookies. A copied token remains cryptographically valid until its expiry; this is an explicit property of the approved design, not immediate global revocation.

## New tests

- CSRF cookie flags and lifetime.
- Missing, unequal-length and mismatched CSRF tokens.
- Same-origin protocol/host/port enforcement.
- Logout clearing both cookies.
- Login and registration route-level rate-limit behavior (six requests: five allowed through the limiter, sixth returns 429).

## Deployment note

The current rate limiter uses the default in-process memory store. For a multi-instance production deployment, configure a shared rate-limit store so limits are consistent across instances. This stage does not add external infrastructure.

## Verification

Local verification is pending. Run from the Windows project environment:

```powershell
Set-Location "E:\BOOK MY SEAT"
git pull origin phase-5/stage-5-security-controls

Set-Location "E:\BOOK MY SEAT\backend"
npm test
npm run db:check
```

Do not share the contents of `.env` or the JWT signing secret.
