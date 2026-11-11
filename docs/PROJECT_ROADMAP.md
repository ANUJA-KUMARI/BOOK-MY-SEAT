# BOOK_MY_SEAT — Project Roadmap

**Current status:** Phase 5 completed and locally verified by the project owner.  
**Baseline plan:** The original approved project documentation defines eight phases. This roadmap preserves those eight phases and separately records a possible Phase 9 release/hardening extension.

---

## 1. Roadmap at a glance

| Phase | Name | Status |
|---|---|---|
| 1 | Requirements, product planning and system design | **Completed** |
| 2 | Frontend foundation and user-interface implementation | **Completed** |
| 3 | Backend foundation and REST API | **Completed** |
| 4 | MySQL database integration | **Completed** |
| 5 | Authentication and account security | **Completed** |
| 6 | Seat availability and booking management | Planned |
| 7 | Frontend-to-backend integration | Planned |
| 8 | Admin functionality and management | Planned |
| 9 | Testing, security, deployment and final release | **Proposed extension — owner approval required** |

The Phase 1 report records an eight-phase plan. The user handover request mentions a Phase 9 release phase. To avoid silently changing the approved baseline, Phase 9 is shown as a proposed extension after Phase 8, not as an already-approved replacement for the eight-phase plan.

## 2. Completed phases

### Phase 1 — Requirements and system design

**Status: Completed**

- Product scope and functional requirements.
- Application architecture and technology decisions.
- Relational data model and API contract.
- Project folder structure and phase plan.
- Design decisions recorded in `docs/phase-reports/PHASE_1_REPORT.md`.

### Phase 2 — Frontend development

**Status: Completed**

- Static frontend pages and navigation.
- Movie browsing and movie detail experiences.
- Showtime selection.
- Seat selection interface and client-side selection rules.
- Login and registration interfaces with client-side validation.
- Responsive styling and local sample-data behavior.

The frontend still uses sample data. Its API switch/integration is intentionally reserved for Phase 7.

### Phase 3 — Backend foundation

**Status: Completed**

- Node.js and Express 5 application.
- Routes, controllers, services, validators and middleware.
- Static frontend serving from the backend origin.
- Initial read-only API and response contract.
- Centralized error handling and automated tests.

### Phase 4 — MySQL integration

**Status: Completed**

- MySQL 8 schema with 11 tables.
- Seed and 40-check verification scripts.
- Dedicated `bms_app` account and environment configuration.
- `mysql2/promise` shared connection pool.
- Parameterized movie and show reads.
- UTC timestamp convention and India calendar-day filtering.
- Startup database readiness check.
- HTTP 503 handling for genuine database outages.
- Graceful HTTP server and pool shutdown.
- Project owner reports local verification: database checks all passed; 143 tests passed, 0 failed, 0 skipped, 34 suites.

See `docs/PHASE_4_COMPLETION_REPORT.md`.

---

## 3. Remaining approved baseline phases

### Phase 5 — Authentication

**Status: Completed — locally verified by the project owner**

**Objective:** Implement secure server-side user registration, login, logout and identity verification.

**Delivered and verified:**

- Registration endpoint and server-side validation.
- Password hashing with bcrypt (12 rounds).
- Login credential verification and generic invalid-credential responses.
- JWT issuance and verification (HS256, 15-minute expiry, configured issuer/audience).
- HttpOnly access-token cookie and separate CSRF cookie.
- Protected-route authentication middleware and strict user-ID claim validation.
- Current-user endpoint that reloads the user from MySQL and returns a safe profile.
- Role-aware authorization middleware; registration always assigns USER.
- Same-origin validation and double-submit CSRF protection for logout.
- Login rate limiting (5 attempts/15 minutes) and registration rate limiting (5 attempts/hour).
- Logout clears authentication and CSRF cookies. Copied stateless JWTs remain valid until expiry, as approved.
- Stage reports and consolidated completion report in `docs/PHASE_5_COMPLETION_REPORT.md`.

**Local verification reported by the project owner:** 200 tests passed, 0 failed, 0 skipped across 48 suites; `npm run db:check` reported `ALL CHECKS PASSED`.

**Not included:** booking creation, seat availability, frontend API switching, admin CRUD, schema changes or server-side JWT revocation.

**Operational note:** The current rate limiter uses an in-process memory store. A shared store is needed before multi-instance production deployment.

### Phase 6 — Seat availability and booking management

**Status: Planned**

**Objective:** Implement correct, persistent booking workflows on top of the Phase 4 schema.

Planned scope:

- Read seat layout and show-specific seat availability.
- Validate that selected seats belong to the screen used by the show.
- Enforce the six-seat booking limit from the approved requirements.
- Create bookings using database transactions.
- Prevent double booking under concurrent requests.
- Recompute totals on the server using `show_prices`; never trust browser-submitted prices.
- Store per-seat `price_snapshot`.
- Enforce booking ownership.
- Booking history and booking detail reads.
- Cancellation rules and released-seat handling.
- Test concurrent booking attempts, rollback behavior, duplicate-seat conflicts, cancellation and seat reuse.

**Depends on:** Phase 4 schema and Phase 5 authentication.

**Not included:** frontend API integration or admin management.

### Phase 7 — Frontend-to-backend integration

**Status: Planned**

**Objective:** Replace frontend sample-data reads with calls to the existing backend API and later booking/auth endpoints.

Planned scope:

- Audit the existing frontend API abstraction (the Phase 2 report identifies `js/api.js` as the integration seam).
- Switch the data source from sample data to the Express API.
- Connect movie listing, movie details and showtime browsing.
- Integrate authentication UI with Phase 5 endpoints.
- Integrate seat availability and booking flows with Phase 6 endpoints.
- Add loading, empty, validation, authentication and server-error states.
- Verify existing navigation, responsive behavior and visual design are preserved.
- Add integration tests for browser/API contracts where appropriate.

**Important:** The frontend is not currently connected to the database-backed API. Do not describe Phase 7 as complete until the actual browser workflows use the backend.

### Phase 8 — Admin functionality and management

**Status: Planned**

**Objective:** Provide authorized administrative management of the platform's catalogue and operational data.

The Phase 1 report identifies admin management of movies, cinemas, screens, seats, shows, prices and bookings as planned Phase 8 scope. The precise interface and authorization rules should be confirmed before implementation.

Potential work within that approved scope:

- Admin-only authorization and protected admin routes.
- Movie catalogue management.
- Genre assignment.
- Cinema and screen management.
- Seat layout management, with integrity checks.
- Show scheduling and cancellation/management.
- Show category pricing management.
- Booking lookup and operational management consistent with user privacy and booking rules.
- Auditability and validation for administrative changes.
- Tests proving ordinary users cannot access admin operations.

**Depends on:** authentication/authorization (Phase 5), booking domain rules (Phase 6), and integrated API/UI foundations (Phase 7).

---

## 4. Proposed Phase 9 — Testing, security, deployment and final release

**Status: Proposed extension; not part of the original eight-phase baseline unless approved.**

The requested Phase 9 can be adopted as a final release/hardening phase after Phase 8. Its purpose would be to consolidate end-to-end quality and prepare a deployable release, rather than to silently absorb or replace work from Phases 5–8.

Possible scope:

- End-to-end regression testing of customer and admin workflows.
- Security review of authentication, authorization, cookies/CSRF, rate limiting, input validation, SQL access and secret management.
- Concurrency and resilience testing.
- Accessibility and responsive-browser checks.
- Performance and database query review.
- Production environment configuration and secret injection.
- Deployment pipeline and hosting configuration.
- Database backup/restore and migration/release procedure.
- Logging, health/readiness monitoring and incident response basics.
- Production build/release checklist, rollback plan and final documentation.
- Final demo and release acceptance.

**Approval needed:** Confirm whether the project owner wants to formally expand the plan from eight phases to nine. Until then, keep Phase 9 marked proposed.

---

## 5. Cross-phase constraints and dependencies

- Keep the existing frontend design and functionality unless a specific phase task approves a change.
- Preserve the API response contract or document and test any approved breaking change.
- Keep database credentials in local environment configuration; never commit `.env`.
- Do not rerun seed scripts casually against a database containing bookings.
- Keep schema changes explicit, reviewed and accompanied by migration/verification steps.
- Use parameterized SQL for all database values.
- Validate requests on the server even when the frontend also validates them.
- Recompute prices and enforce seat availability on the server in Phase 6.
- Test transaction and concurrency behavior before claiming booking correctness.
- Clearly distinguish database schema foundations from implemented application workflows.

## 6. Immediate next action

Begin **Phase 6 — Seat Availability and Booking Management** with a focused audit of the Phase 1 booking requirements and Phase 4 database schema. Confirm seat ownership/screen relationships, six-seat limit, server-side price calculation, transaction boundaries, concurrency/double-booking prevention, cancellation rules and booking ownership before implementation. Keep frontend API integration in Phase 7 and admin management in Phase 8.
