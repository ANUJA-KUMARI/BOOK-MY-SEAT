// HTTP handlers for authentication. Business logic and SQL live in auth.service.js.
const crypto = require('node:crypto');
const authService = require('../services/auth.service');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const { signAccessToken } = require('../utils/jwt');
const { config } = require('../config/env');
const { validateRegistration, validateEmail, validateLoginPassword } = require('../validators/auth');
const { issueCsrfCookie, clearCsrfCookie } = require('../middleware/csrf');

const AUTH_COOKIE = 'bms_token';

function authCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000,
  };
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true, secure: config.isProduction, sameSite: 'lax', path: '/',
  });
}

async function register(req, res) {
  const errors = validateRegistration(req.body);
  if (Object.keys(errors).length > 0) {
    throw new AppError(400, 'Please correct the highlighted fields.', errors);
  }
  const user = await authService.registerUser({
    name: req.body.name, email: req.body.email, password: req.body.password,
  });
  return sendSuccess(res, { user }, 201);
}

async function login(req, res) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const errors = {};
  const emailError = validateEmail(body.email);
  const passwordError = validateLoginPassword(body.password);
  if (emailError) errors.email = emailError;
  if (passwordError) errors.password = passwordError;
  if (Object.keys(errors).length) throw new AppError(400, 'Please correct the highlighted fields.', errors);

  if (!config.jwt.secret) {
    throw new AppError(503, 'Authentication is temporarily unavailable. Please configure the server signing key.');
  }

  const user = await authService.loginUser({ email: body.email, password: body.password });
  const token = signAccessToken(user);
  res.cookie(AUTH_COOKIE, token, authCookieOptions());
  issueCsrfCookie(res);
  return sendSuccess(res, { user });
}

async function currentUser(req, res) {
  const user = await authService.findUserById(req.auth.id);
  if (!user) throw new AppError(401, 'Your account is no longer available. Please log in again.');
  return sendSuccess(res, { user });
}

async function logout(req, res) {
  clearAuthCookie(res);
  clearCsrfCookie(res);
  return sendSuccess(res, { message: 'You have been logged out.' });
}

module.exports = { AUTH_COOKIE, authCookieOptions, register, login, currentUser, logout };
