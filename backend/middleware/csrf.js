// Same-origin checks plus a double-submit CSRF token for cookie-authenticated mutations.
const crypto = require('node:crypto');
const AppError = require('../utils/AppError');
const { config } = require('../config/env');

const CSRF_COOKIE = 'bms_csrf';

function cookieOptions() {
  return {
    httpOnly: false,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000,
  };
}

function requireSameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return next(new AppError(403, 'A valid same-origin request is required.'));
  try {
    const parsed = new URL(origin);
    if (parsed.host !== req.get('host') || parsed.protocol !== (req.secure ? 'https:' : 'http:')) {
      return next(new AppError(403, 'A valid same-origin request is required.'));
    }
  } catch {
    return next(new AppError(403, 'A valid same-origin request is required.'));
  }
  return next();
}

function issueCsrfCookie(res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, cookieOptions());
  return token;
}

function requireCsrf(req, res, next) {
  const cookieToken = req.cookies && req.cookies[CSRF_COOKIE];
  const headerToken = req.get('x-csrf-token');
  if (
    typeof cookieToken !== 'string'
    || typeof headerToken !== 'string'
    || cookieToken.length !== headerToken.length
    || !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    return next(new AppError(403, 'The security token is missing or invalid. Refresh the page and try again.'));
  }
  return next();
}

function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE, { httpOnly: false, secure: config.isProduction, sameSite: 'lax', path: '/' });
}

module.exports = { CSRF_COOKIE, cookieOptions, requireSameOrigin, issueCsrfCookie, requireCsrf, clearCsrfCookie };
