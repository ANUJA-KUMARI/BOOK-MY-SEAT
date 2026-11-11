// JWT signing helper for authenticated sessions.
const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

function signAccessToken(user) {
  if (!config.jwt.secret) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.sign(
    { role: user.role },
    config.jwt.secret,
    {
      subject: String(user.id),
      expiresIn: config.jwt.expiresIn,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    },
  );
}

module.exports = { signAccessToken };
