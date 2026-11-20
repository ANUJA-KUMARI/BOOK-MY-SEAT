const adminRegistration = require('../services/admin-registration.service');
const authService = require('../services/auth.service');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const { signAccessToken } = require('../utils/jwt');
const { config } = require('../config/env');
const { validateName, validateEmail, validateNewPassword } = require('../validators/auth');
const { issueCsrfCookie } = require('../middleware/csrf');

function validateAdminRegistration(body) {
  const errors = {};
  for (const [key, fn] of [['name', validateName], ['email', validateEmail], ['password', validateNewPassword]]) {
    const error = fn(body[key]);
    if (error) errors[key] = error;
  }
  if (typeof body.adminId !== 'string' || !/^ADM-[A-F0-9]{10}$/i.test(body.adminId.trim())) errors.adminId = 'Enter a valid Admin ID.';
  if (typeof body.invitationCode !== 'string' || body.invitationCode.length < 32 || body.invitationCode.length > 128) errors.invitationCode = 'Enter the invitation code supplied by the first admin.';
  return errors;
}

async function register(req, res) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const errors = validateAdminRegistration(body);
  if (Object.keys(errors).length) throw new AppError(400, 'Please correct the highlighted fields.', errors);
  const result = await adminRegistration.registerApplicant({
    adminId: body.adminId, invitationCode: body.invitationCode,
    name: body.name, email: body.email, password: body.password,
  });
  return sendSuccess(res, result, 201);
}

async function login(req, res) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const errors = {};
  if (typeof body.adminId !== 'string' || !/^ADM-[A-F0-9]{10}$/i.test(body.adminId.trim())) errors.adminId = 'Enter your Admin ID.';
  if (validateEmail(body.email)) errors.email = validateEmail(body.email);
  if (typeof body.password !== 'string' || !body.password) errors.password = 'Enter your password.';
  if (Object.keys(errors).length) throw new AppError(400, 'Please correct the highlighted fields.', errors);
  if (!config.jwt.secret) throw new AppError(503, 'Authentication is temporarily unavailable.');
  const user = await adminRegistration.loginAdmin({ adminId: body.adminId, email: body.email, password: body.password });
  const token = signAccessToken(user);
  res.cookie(authService.AUTH_COOKIE || 'bms_token', token, authService.authCookieOptions ? authService.authCookieOptions() : {
    httpOnly: true, secure: config.isProduction, sameSite: 'lax', path: '/', maxAge: 15 * 60 * 1000,
  });
  issueCsrfCookie(res);
  return sendSuccess(res, { user });
}

async function createInvitation(req, res) {
  return sendSuccess(res, await adminRegistration.createInvitation(req.auth.id), 201);
}
async function listApplications(req, res) {
  return sendSuccess(res, { applications: await adminRegistration.listApplications(req.auth.id) });
}
async function decideApplication(req, res) {
  const id = Number(req.params.userId);
  if (!Number.isSafeInteger(id) || id < 1) throw new AppError(400, 'Invalid application id.');
  const result = await adminRegistration.decideApplication({ actorId: req.auth.id, userId: id, decision: req.body?.decision });
  return sendSuccess(res, result);
}

module.exports = { register, login, createInvitation, listApplications, decideApplication };
