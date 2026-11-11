// HTTP handlers for authentication. Business logic and SQL live in auth.service.js.
const authService = require('../services/auth.service');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const { validateRegistration } = require('../validators/auth');

async function register(req, res) {
  const errors = validateRegistration(req.body);
  if (Object.keys(errors).length > 0) {
    throw new AppError(400, 'Please correct the highlighted fields.', errors);
  }

  const user = await authService.registerUser({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
  });

  // Never return the password or password hash.
  return sendSuccess(res, { user }, 201);
}

module.exports = { register };
