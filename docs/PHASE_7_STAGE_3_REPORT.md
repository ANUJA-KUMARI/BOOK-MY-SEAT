# Phase 7 — Stage 3: Authentication Integration

**Branch:** `phase-7/stage-3-authentication-integration`  
**Base:** `phase-7/stage-2-movie-showtime-integration`  
**Status:** Implementation committed; local automated and browser verification pending.

## Objective

Connect the existing login and registration pages to the Phase 5 authentication API without changing the established visual design or weakening the server-side security controls.

## Implemented

### Frontend API client — `frontend/js/api.js`

Added same-origin API methods:

- `registerUser()` → `POST /api/auth/register`
- `loginUser()` → `POST /api/auth/login`
- `getCurrentUser()` → `GET /api/auth/me`
- `logoutUser()` → `POST /api/auth/logout`

Requests include same-origin credentials. Logout reads the readable `bms_csrf` cookie and sends it as `x-csrf-token`. The HttpOnly `bms_token` is never read by frontend JavaScript. A 401 from the current-user endpoint is treated as an unauthenticated session; other API errors remain visible to callers.

### Login and registration forms — `frontend/js/pages/auth.js`

- Existing client-side field validation remains in place.
- Valid forms now submit JSON to the appropriate backend endpoint.
- Submit buttons are disabled while a request is in progress.
- Server-side field validation errors are displayed beside the relevant fields when supplied.
- General API errors are shown in the existing status region.
- Successful registration displays confirmation and a link to login.
- Successful login redirects to the home page.
- Passwords are not logged, persisted in browser storage, or placed in URLs.

### Shared navigation — `frontend/js/components.js`

- The header checks `GET /api/auth/me` to identify an existing session.
- Unauthenticated visitors retain the existing Log in and Register links.
- Authenticated users see their account name and a Log out control.
- Logout calls the protected backend endpoint with the CSRF header, then reloads the current page after success.
- A temporary current-user lookup failure does not block public navigation.

### Tests

Added `frontend/tests/auth-api.test.js` covering registration, login, current-user success/unauthenticated behavior, logout CSRF header handling, and missing-CSRF rejection.

## Security boundaries preserved

- JWT remains in the backend-issued HttpOnly cookie; JavaScript cannot access it.
- Cookie-authenticated logout uses the double-submit CSRF token.
- Authentication and authorization remain enforced by backend middleware.
- Same-origin credentials are used; no CORS relaxation was introduced.
- No secrets, passwords, or tokens are added to source files.

## Local verification required

From PowerShell:

```powershell
Set-Location "E:\BOOK MY SEAT"
git pull origin phase-7/stage-3-authentication-integration
Set-Location "E:\BOOK MY SEAT\backend"
npm test
npm run db:check
```

Then start the backend with `npm start` and verify in the browser:

1. Open `http://localhost:3000/pages/register.html`.
2. Register a new test account with a valid name, email and password.
3. Confirm the success message and follow the login link.
4. Log in with the new account; confirm redirect to the home page.
5. Confirm the header shows the account name and Log out.
6. Refresh the page; confirm the session remains recognized.
7. Log out; confirm Log in and Register return.
8. Try an incorrect password; confirm a safe error appears and the page remains usable.
9. Inspect browser Network requests for `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout`. Do not copy or share cookie values.

**Do not mark Stage 3 complete until the local test suite, database check and browser flow have been verified.**
