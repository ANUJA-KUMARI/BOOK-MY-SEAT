# BOOK_MY_SEAT — Render Deployment Guide

This guide prepares the existing single-origin Node.js/Express application for Render. The Express server serves both the frontend files and the `/api` endpoints. No frontend split or application workflow rewrite is required.

## Deployment architecture

- **Web service:** Render, Node.js, with `backend/` as the service root.
- **Database:** managed MySQL outside Render (Render's standard managed database offering is PostgreSQL, not MySQL). Aiven for MySQL is one compatible option; another managed MySQL provider is acceptable if it supports TLS connections from Render.
- **Public access:** Render HTTPS URL, with the option to add a custom domain later.

The repository includes a `render.yaml` Blueprint. It defines the web service, health check, production mode, TLS-enabled database connection and generated JWT signing secret. Database connection details and the provider CA certificate are deliberately entered privately in the Render dashboard.

## 1. Create the managed MySQL database

Create a new production MySQL 8.0 database with your chosen provider. Use a region close to the Render Singapore region where possible.

Record these values privately:
- Hostname
- Port (usually 3306)
- Database name (use `book_my_seat`)
- Database username
- Database password
- Provider CA certificate (PEM), if the provider supplies one

Enable TLS and configure the provider's network access controls so the database is reachable from the Render service. Do not expose MySQL to the entire internet if the provider supports IP allowlisting/private networking. Render outbound IP ranges can vary by plan and service; consult the provider's current Render connectivity guidance before restricting the database firewall.

## 2. Create schema and application data

Use the provider's SQL console or an administrator connection to create the application database and apply `database/schema.sql`. If the provider's restricted SQL console does not allow `CREATE DATABASE`, create `book_my_seat` in its dashboard first and run the table definitions after the `CREATE DATABASE` / `USE` lines.

For a new demonstration deployment only, review and then run `database/seed.sql` to load the sample movies, cinemas, screens, seats, shows and prices. The seed file is designed to be re-runnable, but it updates sample catalogue rows and refreshes unbooked demo shows. **Never run it against an existing database containing production customer data or bookings.**

The production database must have a dedicated application user. Create that account with the provider's user-management controls or run `database/create_managed_app_user.sql` using an administrator account. Use a unique password and keep it only in the provider/Render secret stores.

## 3. Create the Render service

1. Push the current `main` branch to GitHub.
2. In Render, choose **New → Blueprint** and connect `ANUJA-KUMARI/BOOK-MY-SEAT`.
3. Select the `main` branch and let Render read `render.yaml`.
4. Confirm the service name, Singapore region, Node runtime and `backend` root directory.
5. Before the first deploy, fill the private values for `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_SSL_CA` in Render. Paste the provider CA certificate as PEM text; leave it empty only if the provider documents that its server certificate chains to a trusted system root.
6. Keep the generated `JWT_SECRET`; do not replace it with a short or reused value.
7. Create the Blueprint/service and wait for the deploy to finish.

The health check is `GET /api/health`. The server verifies the database before opening its HTTP listener, so an incorrect database setting will fail startup rather than serving a broken app.

## 4. Production environment variables

The Blueprint configures:
- `NODE_ENV=production`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `DB_CONNECTION_LIMIT=5`
- `DB_SSL=true`, optional `DB_SSL_CA` (verified TLS; certificate validation is not disabled)
- generated `JWT_SECRET`
- JWT issuer, audience and expiry

The app trusts exactly one reverse-proxy hop in production for client IP handling and HTTPS-aware behavior. Auth cookies are HttpOnly, SameSite=Lax and Secure in production.

Never commit `.env`, credentials, database dumps containing personal data, CA/private keys, or screenshots exposing secret values.

## 5. Create the first administrator

Public registration deliberately creates `USER` accounts only. After the public app is deployed, register your own account through the website. Then use the managed database's secure SQL console to promote only that account:

```sql
UPDATE users
SET role = 'ADMIN'
WHERE email = 'YOUR-VERIFIED-ADMIN-EMAIL'
  AND role = 'USER';
```

Check that exactly one row was affected and verify the account can sign in and access the admin workspace. Do not create an admin registration endpoint or expose database credentials in the browser.

## 6. Pre-launch acceptance checklist

- [ ] Render deployment is healthy and `/api/health` returns HTTP 200.
- [ ] The production app connects to managed MySQL over verified TLS.
- [ ] Register a new customer account and sign in.
- [ ] Verify customer can browse movies, select a show and seats, and create a booking.
- [ ] Verify booking history/details and cancellation rules.
- [ ] Verify a normal USER receives HTTP 403 from admin APIs.
- [ ] Verify the promoted ADMIN can access admin modules.
- [ ] Verify Secure/HttpOnly auth cookies in browser developer tools.
- [ ] Verify no secrets appear in logs, browser bundles, or Git history.
- [ ] Configure automated database backups and test a restore before accepting real users.
- [ ] Add a custom domain only after the Render URL and HTTPS workflow pass.

## 7. Important product limitations to resolve before real public launch

- The current project records bookings as `CONFIRMED` without integrating a payment gateway. Do not represent these as paid tickets or collect real money until payment authorization, capture, refunds and reconciliation are implemented.
- Seed data is demonstration content. Replace or curate catalogue, cinema, show and poster data before public promotion.
- Authentication rate limits currently use in-process memory. For multiple Render instances, move rate limiting to a shared store (for example Redis) before scaling horizontally.
- Configure backups, retention, monitoring, incident response and privacy/legal pages appropriate to the audience and jurisdiction.
- The health endpoint confirms process health. Startup performs a database check, but operational monitoring and alerts still need to be configured.

## 8. Rollback and data safety

Deploy code changes independently from database migrations. Back up the managed database before schema changes. Do not run local reset scripts or the sample seed script against the production database. If a deployment fails, roll back the Render service to the previous successful deploy; preserve the database unless a reviewed migration rollback explicitly requires otherwise.
