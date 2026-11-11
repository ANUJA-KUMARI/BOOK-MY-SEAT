// In-process limits for authentication endpoints. Deployments with multiple instances should use a shared store.
const { rateLimit } = require('express-rate-limit');

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many registration attempts. Please try again in an hour.' } },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many login attempts. Please try again in 15 minutes.' } },
});

module.exports = { registrationLimiter, loginLimiter };
