# BOOK_MY_SEAT — Phase 5 Report
## Authentication and Authorization

| Item | Detail |
|---|---|
| Phase | 5 of 8 — Registration, login, JWT authentication and security middleware |
| Core technologies | bcrypt, jsonwebtoken, HttpOnly cookies, CSRF protection, express-rate-limit |
| Status | Implementation completed; later project records report successful regression verification |

## 1. Phase objective

Phase 5 added the authentication foundation required for customer booking and protected administration. It implemented registration, login, current-user identity, logout, signed access tokens, role authorization, same-origin validation, CSRF protection and rate limiting.

The original Phase 5 audit/plan was planning-only. This report consolidates the subsequent implementation stages and does not treat the plan itself as proof of delivery.

## 2. Authentication architecture

The request path is:

`Frontend form → Express route → controller → authentication service → MySQL users table`

For protected requests:

`Browser cookie → authenticate middleware → JWT verification → database user lookup → authorize middleware → protected route`

The access token is stored in an HttpOnly cookie. Browser JavaScript cannot read the JWT. A separate readable CSRF cookie supplies the value that the frontend echoes in a request header for state-changing operations.

The backend serves frontend and API from the same origin. Same-origin credentials and Origin validation are therefore used without introducing a separate CORS configuration.

## 3. User registration

Endpoint: `POST /api/auth/register`

The registration flow:
1. Validates the submitted name, email and password.
2. Normalizes the email before storage.
3. Hashes the password using bcrypt with 12 rounds.
4. Inserts the user into MySQL.
5. Forces the role to `USER`; the client cannot select ADMIN.
6. Returns a safe user profile without password or password hash.

Duplicate email is handled as a conflict. The unique email constraint in MySQL remains the final integrity guarantee even when application validation is also performed.

Registration does not issue an authenticated session. Admin privilege is not granted through public registration.

## 4. Login and JWT issuance

Endpoint: `POST /api/auth/login`

The login service retrieves the account using parameterized SQL and compares the submitted password with the stored bcrypt hash. Unknown email and incorrect password share a generic invalid-credentials response to reduce account enumeration.

On success, the server signs a JWT using:
- Algorithm: HS256 (pinned during verification).
- Subject: database user ID.
- Expiry: 15 minutes.
- Issuer: `book-my-seat`.
- Audience: `book-my-seat-client`.

The token is set in the `bms_token` cookie with HttpOnly, SameSite=Lax and Path=/. Secure is enabled in production. A separate `bms_csrf` cookie is issued for the double-submit CSRF flow.

`JWT_SECRET` is supplied only through environment configuration, must meet the configured strength requirement, and must not be committed or shared. Login fails closed if the secret is missing.

## 5. Authentication middleware and current identity

The `authenticate` middleware reads the access token only from the HttpOnly `bms_token` cookie. It verifies the signature, expiry, HS256 algorithm, issuer and audience. The subject must be a positive decimal user ID within JavaScript's safe-integer range.

Verified identity is attached to `req.auth`. The current-user endpoint `GET /api/auth/me` reloads the account from MySQL using the verified user ID and returns only safe profile fields.

The reusable `authorize(...roles)` middleware rejects unauthenticated requests with HTTP 401 and authenticated users without the required role with HTTP 403.

The admin implementation later reloads the current database role rather than trusting a potentially stale role snapshot in the JWT. This allows a demoted/deleted account to lose admin access when the next request is evaluated.

## 6. CSRF protection, same-origin checks and logout

State-changing requests validate the Origin header against the request protocol, host and port. Logout requires a double-submit CSRF token:
- The browser sends the readable `bms_csrf` cookie.
- The same value is sent in the `x-csrf-token` request header.
- Comparison uses a timing-safe comparison after checking equal lengths.

Login and registration also enforce same-origin Origin validation. Logout clears both `bms_token` and `bms_csrf` cookies using matching path/security attributes.

Endpoint: `POST /api/auth/logout`.

**JWT logout semantics:** the approved design is stateless JWT with a 15-minute expiry and no server-side revocation list. Logout clears browser cookies. A copied token remains cryptographically valid until its expiry; logout is not immediate global token revocation.

## 7. Rate limiting

- Login: 5 attempts per 15-minute window.
- Registration: 5 attempts per one-hour window.
- Excess requests receive HTTP 429 with safe generic messages.

The implementation uses the default in-process memory store. A multi-instance deployment would require a shared rate-limit store for consistent limits across instances.

## 8. Authentication API contract

| Method | Endpoint | Behavior |
|---|---|---|
| POST | `/api/auth/register` | Validate, hash password, force USER role, return safe profile |
| POST | `/api/auth/login` | Verify credentials and issue access/CSRF cookies |
| GET | `/api/auth/me` | Verify cookie and return current safe profile |
| POST | `/api/auth/logout` | Require authenticated same-origin request and CSRF proof; clear cookies |

## 9. Integration tests and verification

The final authentication integration stage added an HTTP-level test for the complete sequence:
1. Register a new account request.
2. Confirm USER role is forced and registration does not issue a session.
3. Log in and receive HttpOnly `bms_token` and readable `bms_csrf` cookies.
4. Call `GET /api/auth/me` with the issued cookies.
5. Log out with same-origin and matching CSRF proof.
6. Confirm both cookies are cleared and a subsequent current-user request is unauthorized.

The test stubs the service/database boundary, while exercising the Express routes, controllers, cookie middleware, JWT signing/verification, CSRF middleware and error handling. It does not insert test accounts into the owner's MySQL database.

Stage-level tests also cover validation, hashing, duplicate email, forced role, safe response fields, cookie flags, JWT claims/lifetime/expiry/algorithm, missing secret, middleware identity validation, role authorization, CSRF behavior, same-origin enforcement and rate limits.

Stage documents originally marked owner-local verification as pending at the time they were written. Later project handover and regression records mark Phase 5 as completed and report successful project-level testing. No separate Phase-5-only final test count is asserted here.

## 10. Security decisions and known limitations

- Passwords are stored as bcrypt hashes, not plaintext.
- JWT is HttpOnly and not exposed to JavaScript.
- Public registration always creates USER.
- Protected routes use verified identity and role authorization.
- State-changing requests use same-origin and CSRF checks.
- Logout clears browser cookies but does not revoke copied JWTs before expiry.
- In-memory rate limiting is not shared across multiple server instances.
- Secrets and cookie behavior still require environment-specific review before any production deployment.

## 11. Phase 5 completion summary

Phase 5 delivered secure registration, login, password hashing, short-lived JWT cookies, current-user lookup, role authorization, CSRF protection, logout and rate limiting. It provided the security foundation reused by booking endpoints in Phase 6 and admin endpoints in Phase 8.
