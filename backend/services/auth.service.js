// Authentication business logic. SQL and password hashing stay outside controllers.
const { getPool, toDatabaseError } = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');
const AppError = require('../utils/AppError');

async function registerUser({ name, email, password }) {
  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const passwordHash = await hashPassword(password);
    const [result] = await getPool().execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [normalizedName, normalizedEmail, passwordHash, 'USER'],
    );

    return {
      id: Number(result.insertId),
      name: normalizedName,
      email: normalizedEmail,
      role: 'USER',
    };
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'An account with this email address already exists.');
    }
    throw toDatabaseError(error);
  }
}

async function loginUser({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const [rows] = await getPool().execute(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail],
    );

    const user = rows[0];

    // Use the same response for unknown email and incorrect password.
    if (!user || !(await comparePassword(password, user.password_hash))) {
      throw new AppError(401, 'Invalid email or password.');
    }

    return {
      id: Number(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw toDatabaseError(error);
  }
}

module.exports = { registerUser, loginUser };
