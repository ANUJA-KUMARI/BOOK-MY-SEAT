// Verify the HttpOnly access-token cookie and attach the CURRENT database identity to the request.
// Roles in a JWT are only a signed snapshot. The database is authoritative so role revocation takes effect
// immediately instead of waiting for the token to expire.
const jwt = require('jsonwebtoken');
const { config } = require('../config/env');
const authService = require('../services/auth.service');
const AppError = require('../utils/AppError');

const AUTH_COOKIE = 'bms_token';

async function authenticate(req, res, next) {
  const token = req.cookies && req.cookies[AUTH_COOKIE];
  if (!token) return next(new AppError(401, 'Authentication is required.'));

  if (!config.jwt.secret) {
    return next(new AppError(503, 'Authentication is temporarily unavailable.'));
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });
  } catch {
    return next(new AppError(401, 'Your session is invalid or has expired. Please log in again.'));
  }

  if (
    typeof payload.sub !== 'string'
    || !/^[1-9]\d*$/.test(payload.sub)
    || !Number.isSafeInteger(Number(payload.sub))
    || !['USER', 'ADMIN'].includes(payload.role)
  ) {
    return next(new AppError(401, 'Your session is invalid or has expired. Please log in again.'));
  }

  try {
    const user = await authService.findUserById(Number(payload.sub));
    if (!user) {
      return next(new AppError(401, 'Your account is no longer available. Please log in again.'));
    }
    // Never trust the role embedded in the token for authorization decisions.
    req.auth = { id: user.id, role: user.role };
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = authenticate;
