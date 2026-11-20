// Admin invitations, pending applications and first-admin approval.
const crypto = require('node:crypto');
const { getPool, toDatabaseError } = require('../config/db');
const { hashPassword } = require('../utils/password');
const AppError = require('../utils/AppError');

const TOKEN_TTL_HOURS = 48;
const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const makeAdminId = () => `ADM-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

async function createInvitation(creatorId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [first] = await connection.execute(
      'SELECT user_id FROM admin_accounts WHERE is_first_admin = TRUE AND status = \'APPROVED\' FOR UPDATE',
    );
    if (!first.length || Number(first[0].user_id) !== Number(creatorId)) {
      throw new AppError(403, 'Only the first administrator can issue admin invitations.');
    }
    let adminId;
    let token;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      adminId = makeAdminId();
      token = crypto.randomBytes(32).toString('base64url');
      try {
        await connection.execute(
          'INSERT INTO admin_invitations (admin_id, token_hash, expires_at, created_by) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR), ?)',
          [adminId, tokenHash(token), TOKEN_TTL_HOURS, creatorId],
        );
        break;
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY' || attempt === 4) throw error;
        adminId = null;
      }
    }
    await connection.commit();
    return { adminId, invitationCode: token, expiresInHours: TOKEN_TTL_HOURS };
  } catch (error) {
    await connection.rollback();
    if (error instanceof AppError) throw error;
    throw toDatabaseError(error);
  } finally { connection.release(); }
}

async function registerApplicant({ adminId, invitationCode, name, email, password }) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [invites] = await connection.execute(
      'SELECT admin_id, created_by FROM admin_invitations WHERE admin_id = ? AND token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP() FOR UPDATE',
      [adminId.trim().toUpperCase(), tokenHash(invitationCode)],
    );
    if (!invites.length) throw new AppError(400, 'This Admin ID or invitation code is invalid, expired, or already used.');
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await hashPassword(password);
    const [userResult] = await connection.execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, \'USER\')',
      [normalizedName, normalizedEmail, passwordHash],
    );
    await connection.execute(
      'INSERT INTO admin_accounts (user_id, admin_id, status, invited_by) VALUES (?, ?, \'PENDING\', ?)',
      [userResult.insertId, invites[0].admin_id, invites[0].created_by],
    );
    await connection.execute(
      'UPDATE admin_invitations SET used_at = UTC_TIMESTAMP() WHERE admin_id = ? AND used_at IS NULL',
      [invites[0].admin_id],
    );
    await connection.commit();
    return { adminId: invites[0].admin_id, status: 'PENDING' };
  } catch (error) {
    await connection.rollback();
    if (error instanceof AppError) throw error;
    if (error && error.code === 'ER_DUP_ENTRY') throw new AppError(409, 'An account with this email or Admin ID already exists.');
    throw toDatabaseError(error);
  } finally { connection.release(); }
}

async function listApplications(actorId) {
  const [first] = await getPool().execute(
    'SELECT user_id FROM admin_accounts WHERE is_first_admin = TRUE AND status = \'APPROVED\' LIMIT 1',
  );
  if (!first.length || Number(first[0].user_id) !== Number(actorId)) {
    throw new AppError(403, 'Only the first administrator can review admin applications.');
  }
  const [rows] = await getPool().execute(
    'SELECT a.user_id, a.admin_id, a.status, a.created_at, u.name, u.email FROM admin_accounts a JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC',
  );
  return rows.map((row) => ({ userId: Number(row.user_id), adminId: row.admin_id, status: row.status, createdAt: row.created_at, name: row.name, email: row.email }));
}

async function decideApplication({ actorId, userId, decision }) {
  if (!['APPROVED', 'REJECTED'].includes(decision)) throw new AppError(400, 'Choose approve or reject.');
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [first] = await connection.execute(
      'SELECT user_id FROM admin_accounts WHERE is_first_admin = TRUE AND status = \'APPROVED\' FOR UPDATE',
    );
    if (!first.length || Number(first[0].user_id) !== Number(actorId)) throw new AppError(403, 'Only the first administrator can review admin applications.');
    const [rows] = await connection.execute(
      'SELECT user_id, status FROM admin_accounts WHERE user_id = ? FOR UPDATE', [userId],
    );
    if (!rows.length) throw new AppError(404, 'Admin application not found.');
    if (rows[0].status !== 'PENDING') throw new AppError(409, 'This application has already been reviewed.');
    await connection.execute(
      'UPDATE admin_accounts SET status = ?, approved_by = ?, approved_at = IF(? = \'APPROVED\', UTC_TIMESTAMP(), NULL) WHERE user_id = ?',
      [decision, actorId, decision, userId],
    );
    await connection.execute('UPDATE users SET role = ? WHERE id = ?', [decision === 'APPROVED' ? 'ADMIN' : 'USER', userId]);
    await connection.commit();
    return { userId: Number(userId), status: decision };
  } catch (error) {
    await connection.rollback();
    if (error instanceof AppError) throw error;
    throw toDatabaseError(error);
  } finally { connection.release(); }
}

async function loginAdmin({ adminId, email, password }) {
  const { comparePassword } = require('../utils/password');
  const [rows] = await getPool().execute(
    `SELECT u.id, u.name, u.email, u.password_hash, u.role, a.admin_id
     FROM admin_accounts a JOIN users u ON u.id = a.user_id
     WHERE a.admin_id = ? AND u.email = ? AND a.status = 'APPROVED' AND u.role = 'ADMIN' LIMIT 1`,
    [adminId.trim().toUpperCase(), email.trim().toLowerCase()],
  );
  const user = rows[0];
  if (!user || !(await comparePassword(password, user.password_hash))) {
    throw new AppError(401, 'Invalid Admin ID, email, or password.');
  }
  return { id: Number(user.id), name: user.name, email: user.email, role: 'ADMIN', adminId: user.admin_id };
}

module.exports = { createInvitation, registerApplicant, listApplications, decideApplication, loginAdmin };
