# Phase 7 — Stage 3: Authentication UI Integration

**Branch:** `phase-7/stage-3-authentication-ui-integration`  
**Base:** `phase-7/stage-2-movie-showtime-integration`  
**Stage status:** Implementation committed; local verification pending.

## 1. Objective

Connect the existing login and registration pages to the Phase 5 authentication API and make the shared navigation reflect the authenticated session. Preserve the existing visual design and backend security contract.

## 2. Implemented changes

### `frontend/js/api.js`

Added same-origin API methods:
- `registerUser()` → `POST /api/auth/register`
- `loginUser()` → `POST /api/auth/login`
- `getCurrentUser()` → `GET /api/auth/me`
- `logoutUser()` → `POST /api/auth/logout`

Requests use same-origin credentials and JSON headers. Logout reads the non-HttpOnly `bms_csrf` cookie and sends it as `x-csrf-token`. The JWT remains in the backend's HttpOnly `bms_token` cookie; frontend JavaScript does not read or store it.

### `frontend/js/pages/auth.js`

- Replaced the previous validation-only submit behavior with real API calls.
- Preserved client-side validation and the existing form fields.
- Registration submits name, email and password; success asks the user to log in.
- Login submits email/password; success redirects to the home page.
- Server validation details are shown beside the corresponding fields when available.
- Duplicate-email and invalid-credential cases receive clear messages.
- Submit buttons are disabled while requests are in progress.
- Passwords are not logged or stored by frontend code.

### `frontend/js/components.js`

- Shared navigation checks `GET /api/auth/me` on page initialization.
- Logged-out visitors continue to see Log in and Register links.
- Authenticated users see their escaped display name and a Log out control.
- Logout calls the protected endpoint with the double-submit CSRF header.
- A successful logout returns the navigation to the logged-out links.

### `frontend/tests/api.test.js`

Added focused tests for registration, login, current-user lookup, CSRF-protected logout, and refusing logout when the CSRF cookie is missing.

## 3. Security contract preserved

- No JWT is placed in localStorage or sessionStorage.
- The HttpOnly authentication cookie is managed by the server.
- Browser requests remain same-origin.
- Logout sends the CSRF cookie value in the required header.
- Server-side validation, rate limits, password hashing, authentication and authorization remain authoritative.
- No backend authentication logic, database schema, grants, environment secrets or seed data were changed.

## 4. Explicitly not included

- Seat availability and booking UI integration (Stage 4).
- Booking history/detail/cancellation UI (Stage 5).
- Admin UI.
- Password reset, email verification or third-party login.
- Payment processing.
- Visual redesign.

## 5. Local verification

Pull the branch and run the focused API tests:

```powershell
Set-Location "E:\BOOK MY SEAT"
git fetch origin
git switch phase-7/stage-3-authentication-ui-integration
git pull origin phase-7/stage-3-authentication-ui-integration
node --experimental-default-type=module --test frontend/tests/api.test.js
```

Expected focused test count: 10 tests, all passing.

Start the backend in another PowerShell terminal:

```powershell
Set-Location "E:\BOOK MY SEAT\backend"
npm start
```

Browser checks:
1. Open `http://localhost:3000/pages/register.html`.
2. Register a new test account with a unique email address; confirm success and the link to log in.
3. Log in with that account; confirm redirect to the home page.
4. Confirm the navigation displays the user's name and Log out.
5. Refresh the page; confirm the session remains authenticated.
6. Log out; confirm Log in and Register return.
7. Refresh again; confirm the user remains logged out.
8. Try an incorrect password and duplicate registration; confirm clear errors.
9. In DevTools → Application → Cookies, confirm `bms_token` is HttpOnly and `bms_csrf` is readable by the page. Do not copy or share cookie values.

Then run backend regression and database checks:

```powershell
Set-Location "E:\BOOK MY SEAT\backend"
npm test
npm run db:check
```

## 6. Acceptance criteria

- [x] Frontend API methods added for register, login, current user and logout.
- [x] Existing login and registration forms submit to the backend.
- [x] Shared navigation reflects authenticated/logged-out state.
- [x] Logout includes the CSRF header.
- [x] Focused API tests added.
- [ ] Focused frontend API tests pass locally.
- [ ] Registration/login/session persistence/logout browser checks pass.
- [ ] Backend regression and database checks pass locally.

**Do not begin Stage 4 until Stage 3 verification is reported.**
