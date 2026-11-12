# BOOK_MY_SEAT — Project Handover

**Purpose:** Give a new developer an accurate starting point for continuing the existing project.  
**Current state:** Phases 1–6 are completed. Phase 7 Stage 6 final integration QA tooling is committed; unified local regression and final browser acceptance are pending.  
**Project root (Windows):** `E:\BOOK MY SEAT`

---

## 1. Product overview

BOOK_MY_SEAT is a movie-ticket booking web application. Its planned user experience includes movie discovery, movie details, cinema/show selection, seat selection, user accounts, booking/cancellation and booking history.

The frontend is an existing HTML/CSS/Vanilla JavaScript application with a cinematic visual direction. Preserve its existing design and behavior unless a task explicitly authorizes changes.

## 2. Technology stack

| Area | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript ES6+ |
| Backend runtime | Node.js |
| HTTP framework | Express.js 5 |
| Database | MySQL Server 8.0 |
| MySQL client | `mysql2` / `mysql2/promise` |
| Environment config | `dotenv` |
| HTTP security headers | `helmet` |
| Automated tests | Node.js built-in test runner |
| Development tools | VS Code, Windows PowerShell, MySQL Workbench |
| Authentication | JWT, bcrypt, HttpOnly session cookie and CSRF protection (Phase 5 completed) |

The checked-in backend dependencies are declared in `backend/package.json` and locked in `backend/package-lock.json`. Do not add dependencies without an approved task.

## 3. Architecture

```text
BOOK MY SEAT/
├── frontend/                 Existing static website
├── backend/
│   ├── app.js                Builds Express application
│   ├── server.js             Startup readiness and server lifecycle
│   ├── config/
│   │   ├── env.js            Environment loading and validation
│   │   └── db.js             MySQL pool, diagnostics and DB errors
│   ├── routes/               HTTP route definitions
│   ├── controllers/          Request validation/orchestration
│   ├── services/             Business/data access logic
│   ├── middleware/           Logging, 404 and central error handling
│   ├── validators/           Request parameter validation
│   ├── utils/                SQL, time, response and error helpers
│   ├── scripts/check-db.js   Database connectivity/seed diagnostics
│   ├── tests/                Automated tests
│   ├── data/sample-data.js   Retained legacy/sample module
│   ├── .env.example          Safe configuration template
│   └── package.json
├── database/
│   ├── schema.sql
│   ├── seed.sql
│   ├── verify_seed.sql
│   └── create_app_user.sql
└── docs/
    ├── PHASE_4_COMPLETION_REPORT.md
    ├── PHASE_4_REPORT.md     Earlier preliminary report; preserved
    ├── PROJECT_HANDOVER.md
    ├── PROJECT_ROADMAP.md
    └── phase-reports/
        ├── PHASE_1_REPORT.md
        ├── PHASE_2_REPORT.md
        └── PHASE_3_REPORT.md
```

### Request path

```text
Browser / API client
  -> Express app (Helmet, logger, JSON parser)
  -> /api routes
  -> controller (parse/validate HTTP input)
  -> service (parameterized SQL)
  -> shared mysql2 promise pool
  -> MySQL
  -> service mapping
  -> existing JSON response envelope
```

`app.js` builds and exports the Express application. `server.js` is the process entry point: it verifies database connectivity before opening the HTTP listener. Express also serves the frontend as static files, so the project uses a single origin and does not currently need CORS configuration.

## 4. Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Product requirements, architecture, data model and API design | **Completed** |
| 2 | Frontend foundation, responsive pages and client-side interactions | **Completed** |
| 3 | Node/Express backend foundation and initial API | **Completed** |
| 4 | MySQL integration, read endpoints, readiness, error handling and shutdown | **Completed** |
| 5 | Authentication | **Completed** |
| 6 | Seat availability and booking workflows | **Completed** |
| 7 | Frontend-to-backend integration | **Stage 6 final QA in progress** |
| 8 | Admin functionality and management | Planned |
| 9 | Broader testing, security, deployment and final release | **Optional proposed extension; see roadmap** |

The original approved project documentation describes an **eight-phase** plan. Phase 9 is not silently substituted for Phase 8; it is documented as a proposed post-Phase-8 release/hardening stage that requires owner approval if the project is to adopt a nine-phase plan.

## 5. Backend, database and customer workflow state

### 5.1 Implemented read API

- `GET /api/health`
- `GET /api/movies?search=&genre=&language=`
- `GET /api/movies/:id`
- `GET /api/movies/:id/shows?date=YYYY-MM-DD`

Movie and show reads are database-backed. The API preserves the established response envelope:

```json
{ "success": true, "data": ... }
{ "success": false, "error": { "message": "..." } }
```

`GET /api/health` is an application health endpoint, not a continuous database monitoring endpoint.

### 5.2 Database

Database name: `book_my_seat`  
Verified local database server: MySQL 8.0.44  
Application account: `bms_app`  
Tables:

1. `users`
2. `movies`
3. `genres`
4. `movie_genres`
5. `cinemas`
6. `screens`
7. `seats`
8. `shows`
9. `show_prices`
10. `bookings`
11. `booking_seats`

The schema and SQL scripts are in `database/`. They are authoritative; do not casually rerun seed scripts against a database that may contain bookings.

### 5.3 Important backend behavior

- The MySQL pool is shared and lazily created.
- The application rejects the MySQL `root` account.
- SQL values are parameterized.
- Database connectivity is verified before the HTTP server starts.
- Genuine database availability failures map to HTTP 503.
- Other database/programming errors are not automatically classified as outages.
- SIGINT/SIGTERM trigger idempotent graceful shutdown of the HTTP server and database pool.
- Show timestamps use a UTC storage convention; the optional date filter is based on the India calendar day.

Detailed implementation and schema notes are in `PHASE_4_COMPLETION_REPORT.md`.

## 6. Local setup

### 6.1 Prerequisites

Install or confirm:

- Node.js 20 or later (the verified local version was v22.21.0).
- MySQL Server 8.0 (verified local version 8.0.44).
- MySQL Workbench or another MySQL client for database administration.

### 6.2 Configure environment variables

The backend reads its local environment file from `backend/.env`. Start by copying the example:

```powershell
Set-Location "E:\BOOK MY SEAT\backend"
Copy-Item ".env.example" ".env"
```

Edit `backend/.env` locally. The file should contain the required database connection settings, using the dedicated `bms_app` account:

```dotenv
NODE_ENV=development
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=bms_app
DB_PASSWORD=YOUR_LOCAL_PASSWORD
DB_NAME=book_my_seat
DB_CONNECTION_LIMIT=10
```

`YOUR_LOCAL_PASSWORD` is a placeholder, not a real project credential. Never paste the actual password into documentation, source code, chat logs or Git commits. If `.env` already exists and works, do not overwrite it.

The schema, seed and app-user SQL have already been applied in the verified local environment. A new developer must coordinate before creating or seeding a database that may contain valuable data. Do not drop/recreate the existing database as a setup shortcut.

### 6.3 Install backend dependencies

```powershell
Set-Location "E:\BOOK MY SEAT\backend"
npm ci
```

`npm ci` installs the exact dependency versions from the lockfile. It does not require committing `node_modules`.

### 6.4 Start MySQL

On Windows, confirm the MySQL service (commonly named `MySQL80`) is running through Services or the approved local MySQL administration method. Do not assume the service name if the installation uses a custom name.

### 6.5 Verify and start

```powershell
Set-Location "E:\BOOK MY SEAT\backend"
npm run db:check
npm test
npm start
```

The backend verifies MySQL before opening the HTTP listener. On success, it prints the local website and API health URLs. Press `Ctrl+C` for graceful shutdown.

Development watch mode:

```powershell
npm run dev
```

## 7. Useful developer commands

Run these from `E:\BOOK MY SEAT\backend` unless stated otherwise.

| Command | Purpose |
|---|---|
| `npm ci` | Install locked dependencies |
| `npm start` | Start server after DB readiness check |
| `npm run dev` | Start in Node watch mode |
| `npm test` | Run all automated tests |
| `npm run db:check` | Verify configured database connection and expected database state |
| `npm run db:check -- --verbose` | Print additional database diagnostic details locally |

Useful local URLs when using the default port:

- Website: `http://localhost:3000/`
- Health endpoint: `http://localhost:3000/api/health`
- Movie list: `http://localhost:3000/api/movies`

## 8. Verified Phase 4 results

The project owner reports that the local Windows environment completed the following:

- Windows development machine.
- Node.js v22.21.0.
- MySQL Server 8.0.44.
- Database `book_my_seat`, account `bms_app`.
- `npm run db:check`: **ALL CHECKS PASSED**.
- Automated suite: **143 passed, 0 failed, 0 skipped**, across **34 test suites**.

These are project-owner supplied local results, not a claim that the handover author independently reran the tests. See `PHASE_4_COMPLETION_REPORT.md` for scope and provenance.

## 9. Current limitations and cautions

- Phase 7 Stage 6 final QA is not complete until the project owner runs the unified regression command, database check and remaining browser acceptance items.
- The project is a local demo; no real payment gateway or payment processing is integrated.
- Phase 8 admin functionality has not been implemented.
- `backend/data/sample-data.js` is intentionally retained as legacy/sample data; customer-facing integrated flows use the API.
- Seed data is date-relative. Do not rerun `seed.sql`, drop tables or reset the database after bookings exist.
- Keep `backend/.env` local and untracked. Never share database passwords or JWT secrets.
- The API's `/api/health` route does not replace database readiness checks.
- Do not change the existing API response contract without coordinating frontend impact.

## 10. Handover rules for the next developer

1. Read the Phase 1–7 reports and this handover before coding.
2. Preserve the existing cinematic frontend design and approved architecture.
3. Do not modify schema/seed/verification scripts without an explicit schema-change task and owner approval.
4. Keep credentials in local `.env`; never commit or share `.env`.
5. Run `npm run test:all` from `E:\\BOOK MY SEAT\\backend` and `npm run db:check` before accepting integration changes.
6. Follow the stage boundaries and do not begin Phase 8 admin CRUD until Phase 7 exits.
7. Keep a clear distinction between implemented features, verified behavior and future plans.

## 11. Next step

Complete **Phase 7 Stage 6 — Final Integration, Regression Testing and QA** on branch `phase-7/stage-6-final-integration-qa`. Follow `docs/PHASE_7_STAGE_6_REPORT.md`. Run `npm run test:all` and `npm run db:check` (or `npm run test:release`) locally, then complete the browser acceptance checklist. Once all exit criteria pass, mark Phase 7 complete and prepare a separate Phase 8 admin-scope and authorization plan.
