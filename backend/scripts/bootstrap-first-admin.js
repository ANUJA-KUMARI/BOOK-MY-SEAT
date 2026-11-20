// One-time local bootstrap: promote an already-registered, trusted user as the first administrator.
// Usage: npm run admin:bootstrap -- trusted.admin@example.com
const { getPool, closePool } = require('../config/db');

async function main() {
  const email = process.argv[2];
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Usage: npm run admin:bootstrap -- trusted.admin@example.com');
  }
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [lock] = await connection.query('SELECT GET_LOCK(\'bms_first_admin_bootstrap\', 10) AS acquired');
    if (Number(lock[0].acquired) !== 1) throw new Error('Could not acquire first-admin setup lock.');
    const [admins] = await connection.execute('SELECT user_id FROM admin_accounts LIMIT 1 FOR UPDATE');
    if (admins.length) throw new Error('First admin is already configured; bootstrap is permanently closed.');
    const [users] = await connection.execute('SELECT id FROM users WHERE email = ? LIMIT 1 FOR UPDATE', [email.trim().toLowerCase()]);
    if (!users.length) throw new Error('Register this trusted person as a normal user before running bootstrap.');
    const userId = users[0].id;
    const adminId = 'ADM-' + require('node:crypto').randomBytes(5).toString('hex').toUpperCase();
    await connection.execute(
      'INSERT INTO admin_accounts (user_id, admin_id, status, is_first_admin, approved_at) VALUES (?, ?, \'APPROVED\', TRUE, UTC_TIMESTAMP())',
      [userId, adminId],
    );
    await connection.execute('UPDATE users SET role = \'ADMIN\' WHERE id = ?', [userId]);
    await connection.commit();
    process.stdout.write(`First administrator configured. Admin ID: ${adminId}\n`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    try { await connection.query('SELECT RELEASE_LOCK(\'bms_first_admin_bootstrap\')'); } catch {}
    connection.release();
    await closePool();
  }
}
main().catch((error) => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
