// Password hashing helpers for Phase 5 authentication.
// Keep the work factor fixed at the approved value; never store or log plain-text passwords.
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 12;

async function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new TypeError('Password must be a non-empty string.');
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function comparePassword(password, passwordHash) {
  if (typeof password !== 'string' || typeof passwordHash !== 'string' || !passwordHash) {
    return false;
  }
  return bcrypt.compare(password, passwordHash);
}

module.exports = { BCRYPT_ROUNDS, hashPassword, comparePassword };
