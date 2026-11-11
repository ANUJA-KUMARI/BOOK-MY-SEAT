// Verify the HttpOnly access-token cookie and attach a minimal identity to the request.
const jwt = require('jsonwebtoken');
const { config } = require('../config/env');
const AppError = require('../utils/AppError');

const AUTH_COOKIE = 'bms_token';

function authenticate(req, res, next) {
  const token = req.cookies && req.cookies[AUTH_COOKIE];
  if (!token) return next(new AppError(401, 'Authentication is required.'));

  if (!config.jwt.secret) {
    return next(new AppError(503, 'Authentication is temporarily unavailable.'));
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });

    if (
      typeof payload.sub !== 'string'
      || !/^[1-9]\\d*$/.test(payload.sub)
      || !Number.isSafeInteger(Number(payload.sub))
      || !['USER', 'ADMIN'].includes(payload.role)
    ) {
      throw new Error('Invalid token claims');
    }

    req.auth = { id: Number(payload.sub), role: payload.role };
    return next();
  } catch {
    return next(new AppError(401, 'Your session is invalid or has expired. Please log in again.'));
  }
}

module.exports = authenticate;
