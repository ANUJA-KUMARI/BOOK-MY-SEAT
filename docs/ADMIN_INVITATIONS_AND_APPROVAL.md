# Admin invitations and approval workflow

## Overview
- The first administrator is bootstrapped once from an existing, trusted customer account.
- Only that first administrator can create invitations and approve/reject admin applications.
- Each invitation receives a cryptographically random Admin ID (ADM- plus 10 hex characters) and a separate 256-bit one-time invitation code.
- Invitation codes are stored only as SHA-256 hashes, expire after 48 hours, and are consumed once.
- Applicant registration creates a normal USER row and a PENDING admin application. It does not grant admin permissions.
- Approval changes the application to APPROVED and the user role to ADMIN in one database transaction.
- Admin login requires Admin ID + email + password and only accepts approved applications. Normal customer login intentionally excludes admins.
- Admin authorization re-checks the current user and approved admin application in the database on each authenticated request.

## Safe deployment order
1. Back up the database and verify the backup.
2. Run database/migrations/20261121_admin_invitations.sql exactly once.
3. Ensure the trusted first administrator has already registered through the normal customer registration page.
4. From backend/, run npm run admin:bootstrap -- trusted.admin@example.com using that exact trusted email. The command refuses to run if any admin account already exists and prints the first Admin ID once.
5. Sign in at /admin/login.html with the first Admin ID, email and password.
6. Open Admin access / approvals, generate an invitation, and securely share both the Admin ID and one-time invitation code with the intended applicant.
7. The applicant registers at /admin/register.html. Their access remains inactive until the first admin approves the application.

## Important
- Never commit or share invitation codes in source control, screenshots, or public chat. The code is displayed once when generated.
- The first-admin bootstrap is intentionally a local operator command, not a public HTTP endpoint.
- The migration is forward-only and does not modify existing users or roles.
- Do not rerun the migration after it succeeds.
- Run the full test suite and verify the flow on a backed-up local database before merging.
