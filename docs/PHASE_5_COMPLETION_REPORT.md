# BOOK_MY_SEAT — Phase 5 Completion Report

**Phase:** 5 — Authentication and Account Security  
**Status:** Implementation complete; locally verified by the project owner  
**Documentation branch:** `phase-5/documentation`  
**Final implementation branch:** `phase-5/stage-6-auth-integration`

---

## 1. Executive summary

Phase 5 implements the server-side authentication foundation for BOOK_MY_SEAT. It adds registration, login, JWT-based request authentication, current-user identity retrieval, logout, CSRF protection, rate limiting and role-aware authorization middleware.

The project owner ran the complete backend test suite and database verification from the local Windows development environment after Stage 6.

**Final reported verification:**
- Test suites: **48**
- Tests passed: **200**
- Tests failed: **0**
- Tests skipped: **0**
- Database check: **RESULT: ALL CHECKS PASSED**

These are project-owner supplied local results. They are recorded here as such; they were not independently executed by the documentation author.

## 2. Phase objectives and delivered scope

The Phase 5 objective was to implement secure server-side user registration, login, logout and identity verification without prematurely connecting the frontend or implementing booking workflows.

Delivered:
- Server-side registration and input validation.
- Password hashing with bcrypt using 12 rounds.
- Email normalization and duplicate-account handling through the authentication service.
- Registration role forced to `USER`; clients cannot self-assign `ADMIN`.
- Login credential verification using bcrypt.
- Generic invalid-credential response to avoid revealing whether an email exists.
- Signed JWT access token using HS256.
- Token claims include subject (database user ID), issuer, audience, role and expiry.
- JWT expiry: 15 minutes.
- HttpOnly access-token cookie.
- JWT verification middleware and verified request identity.
- Current-user endpoint that reloads the user from the database and returns a safe profile.
- Reusable role-aware authorization middleware.
- Same-origin validation for authentication state-changing requests.
- Double-submit CSRF protection for logout.
- Login and registration rate limiting.
- Logout cookie clearing.
- Automated unit, route and end-to-end authentication-flow tests.

## 3. Authentication API contract

| Method | Endpoint | Access / behavior |
|---|---|---|
| POST | `/api/auth/register` | Same-origin; rate-limited; validates and creates a USER account |
| POST | `/api/auth/login` | Same-origin; rate-limited; verifies credentials and issues cookies |
| GET | `/api/auth/me` | Requires a valid access-token cookie; returns current safe user profile |
| POST | `/api/auth/logout` | Requires authentication, same-origin validation and CSRF proof; clears cookies |

Responses follow the project's established JSON envelope:
- Success: `{ success: true, data: ... }`
- Error: `{ success: false, error: { message: ... } }`

The safe user response includes account identity fields such as ID, name, email and role. Passwords, password hashes and raw JWT values are not returned in JSON.

## 4. Security design and configuration

### Password handling
- bcrypt work factor: **12**.
- Password hashes are stored in the existing `users.password_hash` column.
- Plaintext passwords are not stored or returned.

### JWT
- Algorithm: **HS256**, explicitly pinned during verification.
- Expiry: **15 minutes**.
- Issuer: `book-my-seat`.
- Audience: `book-my-seat-client`.
- Subject: positive decimal database user ID, validated as a safe integer.
- Signing secret is supplied through local `JWT_SECRET`; it must be at least 32 characters.
- The real `.env` and secret are not committed.

### Cookies
- Access token cookie: `bms_token`.
- Access token cookie is HttpOnly.
- `SameSite=Lax`, path `/`.
- `Secure` is enabled in production.
- CSRF cookie: `bms_csrf`, readable by browser code so it can be copied into the request header.
- CSRF header: `x-csrf-token`.

### CSRF and origin checks
- Login, registration and logout enforce same-origin validation.
- Logout requires the CSRF cookie and request header to match.
- Token comparison checks lengths and uses a timing-safe comparison.
- The current design is appropriate to the approved same-origin application model.

### Rate limiting
- Login: **5 attempts per 15-minute window**.
- Registration: **5 attempts per one-hour window**.
- The current implementation uses the default in-process memory store. A shared store should be configured before deploying multiple application instances so limits are consistent across instances.

### Logout semantics
The approved design uses stateless JWTs and does not maintain a server-side token revocation list. Logout clears the browser's authentication and CSRF cookies. A copied JWT remains valid until its 15-minute expiry. This limitation is intentional under the approved design and should be considered if stronger immediate revocation is required in a future security review.

## 5. Stage-by-stage completion

| Stage | Scope | Completion evidence |
|---|---|---|
| Stage 1 | Baseline verification and authentication configuration | Approved dependencies, JWT environment configuration and focused config tests |
| Stage 2 | Authentication foundation and endpoints | Registration/login/current-user/logout controllers, routes, service and security middleware |
| Stage 3 | Login and JWT authentication | Token signing, cookie issuance and JWT validation tests |
| Stage 4 | Authentication middleware and user identity | Strict JWT subject validation, protected-route and safe-profile tests |
| Stage 5 | CSRF, logout and abuse controls | CSRF/origin/logout tests and login/registration rate-limit tests |
| Stage 6 | End-to-end integration and final regression | HTTP-level registration → login → current user → logout integration test |

Stage-specific implementation details are recorded in:
- `PHASE_5_STAGE_2_REPORT.md`
- `PHASE_5_STAGE_3_REPORT.md`
- `PHASE_5_STAGE_4_REPORT.md`
- `PHASE_5_STAGE_5_REPORT.md`
- `PHASE_5_STAGE_6_REPORT.md`

Stage 1 configuration is also documented in the Stage 2 report and the relevant environment template/configuration files.

## 6. Final verification record

The project owner reported the following output after checking out `phase-5/stage-6-auth-integration` and running the commands locally.

| Check | Reported result |
|---|---:|
| Test suites | 48 |
| Total tests | 200 |
| Passed | **200** |
| Failed | **0** |
| Skipped | **0** |
| Cancelled | 0 |
| Database diagnostic | **ALL CHECKS PASSED** |

The database diagnostic also reported:
- Upcoming shows: 108.
- Movies without upcoming shows: 0.

Commands used:

```powershell
Set-Location "E:\BOOK MY SEAT\backend"
npm test
npm run db:check
```

## 7. Explicit exclusions and unchanged areas

Phase 5 did **not** implement:
- Booking creation, cancellation or booking history.
- Seat availability, seat locking or double-booking prevention.
- Frontend login/register API wiring.
- Frontend switch from sample data to backend API.
- Admin CRUD or management screens.
- Database schema changes or database privilege grants.
- Server-side JWT revocation/blacklisting.
- A distributed rate-limit store.

These boundaries preserve the original phase separation:
- Phase 6: seat availability and booking management.
- Phase 7: frontend-to-backend integration.
- Phase 8: admin functionality and management.
- Phase 9 remains a proposed extension unless separately approved.

## 8. Operational notes and follow-up considerations

1. Configure a strong unique `JWT_SECRET` in each deployment environment; never commit it.
2. Use HTTPS in production so Secure cookies are transmitted only over secure connections.
3. Configure a shared rate-limit store before horizontally scaling the API.
4. Keep the API and frontend same-origin unless the cookie, CORS and CSRF design is deliberately reviewed and changed.
5. Revisit token revocation requirements if immediate logout invalidation becomes a product/security requirement.
6. Continue running the full test suite after future authentication changes.
7. Do not expose `.env`, passwords, password hashes or JWT signing secrets in logs, documentation or support messages.

## 9. Phase 5 acceptance

Phase 5 is recorded as **completed and locally verified by the project owner**, based on the 200/200 passing test result and successful database check reported after Stage 6.

The next approved baseline phase is **Phase 6 — Seat Availability and Booking Management**. Begin it with a focused requirements/schema audit and an implementation plan; do not fold Phase 7 frontend integration or Phase 8 admin CRUD into Phase 6.
