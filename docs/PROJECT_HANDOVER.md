# BOOK_MY_SEAT — Project Handover

**Purpose:** Give a new developer an accurate starting point for continuing the existing project.  
**Current state:** Phase 4 — MySQL Integration is completed and locally verified as reported by the project owner.  
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
| Planned authentication | JWT and bcrypt/bcryptjs (Phase 5; not implemented yet) |

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
| 5 | Authentication | **Next** |
| 6 | Seat availability and booking workflows | Planned |
| 7 | Frontend-to-backend integration | Planned |
| 8 | Admin functionality and management | Planned |
| 9 | Broader testing, security, deployment and final release | **Optional proposed extension; see roadmap** |

The original approved project documentation describes an **eight-phase** plan. Phase 9 is not silently substituted for Phase 8; it is documented as a proposed post-Phase-8 release/hardening stage that requires owner approval if the project is to adopt a nine-phase plan.

## 5. Phase 4 backend and database state

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

- The frontend still uses local sample data. It has not been switched to the backend API; that is Phase 7.
- Backend read operations are implemented; create/update/delete operations are not.
- Login/register screens are frontend UI only. No server-side registration, login, password hashing, JWT or protected routes exist yet.
- No live seat availability, seat locking, booking creation, cancellation, payment or booking history workflow exists yet.
- `users`, `bookings` and `booking_seats` are schema foundations, not proof that those features are implemented.
- `backend/data/sample-data.js` is intentionally retained.
- Seed data is date-relative. The seed script is not a database reset tool and must not be casually rerun after bookings exist.
- The API's `/api/health` route does not replace database readiness checks.
- Do not change the existing API response contract without coordinating frontend impact.

## 10. Handover rules for the next developer

1. Read `docs/PHASE_1_REPORT.md` through `docs/phase-reports/PHASE_3_REPORT.md` and `docs/PHASE_4_COMPLETION_REPORT.md` before coding.
2. Preserve existing application behavior and the approved architecture.
3. Do not modify schema/seed/verification scripts without an explicit schema-change task and owner approval.
4. Keep credentials in local `.env`; never commit or share it.
5. Add tests for new behavior and run the full suite.
6. Do not begin Phase 6 booking work as part of Phase 5.
7. Do not connect the frontend to the API until Phase 7 is explicitly started.
8. Keep a clear distinction between implemented features, schema foundations and future plans.

## 11. Next step

The next approved development phase is **Phase 5 — Authentication**. Start with a source audit and a small implementation plan before modifying code. Confirm the authentication design in the Phase 1 report, including password hashing, JWT handling, protected routes, cookie/CSRF considerations and login/register rate limiting. Do not assume that a JWT package, bcrypt package or authentication middleware is already installed.
