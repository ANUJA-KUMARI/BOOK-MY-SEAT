// Authentication business logic. SQL and password hashing stay outside controllers.
const { getPool, toDatabaseError } = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');
const AppError = require('../utils/AppError');
async function registerUser({ name, email, password }) {
  const normalizedName = name.trim(), normalizedEmail = email.trim().toLowerCase();
  try {
    const passwordHash = await hashPassword(password);
    const [result] = await getPool().execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [normalizedName, normalizedEmail, passwordHash, 'USER']);
    return { id: Number(result.insertId), name: normalizedName, email: normalizedEmail, role: 'USER' };
  } catch (error) { if (error?.code === 'ER_DUP_ENTRY') throw new AppError(409, 'An account with this email address already exists.'); throw toDatabaseError(error); }
}
async function loginUser({ email, password }) {
  try {
    const [rows] = await getPool().execute("SELECT id, name, email, password_hash, role FROM users WHERE email = ? AND role = 'USER' LIMIT 1", [email.trim().toLowerCase()]);
    const user = rows[0];
    if (!user || !(await comparePassword(password, user.password_hash))) throw new AppError(401, 'Invalid email or password.');
    return { id: Number(user.id), name: user.name, email: user.email, role: user.role };
  } catch (error) { if (error instanceof AppError) throw error; throw toDatabaseError(error); }
}
async function findUserById(id) {
  try {
    const [rows] = await getPool().execute("SELECT u.id, u.name, u.email, u.role FROM users u LEFT JOIN admin_accounts a ON a.user_id = u.id WHERE u.id = ? AND (u.role = 'USER' OR (u.role = 'ADMIN' AND a.status = 'APPROVED')) LIMIT 1", [id]);
    const user = rows[0];
    return user ? { id: Number(user.id), name: user.name, email: user.email, role: user.role } : null;
  } catch (error) { throw toDatabaseError(error); }
}
module.exports = { registerUser, loginUser, findUserById };
