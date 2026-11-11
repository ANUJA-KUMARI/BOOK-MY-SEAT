// Registration business logic. Controllers never contain SQL or password-hashing rules.
const { getPool, toDatabaseError } = require('../config/db');
const { hashPassword } = require('../utils/password');
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

module.exports = { registerUser };
