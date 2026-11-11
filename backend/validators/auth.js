// Server-side authentication validation.
// These rules intentionally mirror frontend/js/validators.js. Client-side checks are only for UX;
// these server checks remain authoritative.
const EMAIL_PATTERN = /^[^\\s@]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\\.)+([A-Za-z]{2,})$/;
const COMMON_ENDINGS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name', 'pro',
  'dev', 'app', 'online', 'site', 'tech', 'store', 'xyz', 'cloud', 'email', 'blog',
  'shop', 'live', 'space', 'link', 'club',
]);

const PASSWORD_MIN = 8;
const PASSWORD_MAX_BYTES = 72; // bcrypt only uses the first 72 bytes.

function validateName(value) {
  if (typeof value !== 'string') return 'Enter your full name.';
  const name = value.trim();
  if (!name) return 'Enter your full name.';
  if (name.length < 2) return 'Your name must be at least 2 characters.';
  if (name.length > 60) return 'Your name must be 60 characters or fewer.';
  return '';
}

function validateEmail(value) {
  if (typeof value !== 'string') return 'Enter your email address.';
  const email = value.trim();
  if (!email) return 'Enter your email address.';
  const message = 'Enter a valid email address, like name@example.com.';
  if (email.length > 254) return message;
  const match = EMAIL_PATTERN.exec(email);
  if (!match) return message;
  const ending = match[1].toLowerCase();
  return ending.length === 2 || COMMON_ENDINGS.has(ending) ? '' : message;
}

function validateLoginPassword(value) {
  return typeof value === 'string' && value.length > 0 ? '' : 'Enter your password.';
}

function validateNewPassword(value) {
  if (typeof value !== 'string' || value.length === 0) return 'Create a password.';
  if (value.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (Buffer.byteLength(value, 'utf8') > PASSWORD_MAX_BYTES) {
    return `Use at most ${PASSWORD_MAX_BYTES} bytes (about 72 characters).`;
  }
  return '';
}

function validateRegistration(input) {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const errors = {};
  for (const [field, message] of [
    ['name', validateName(body.name)],
    ['email', validateEmail(body.email)],
    ['password', validateNewPassword(body.password)],
  ]) {
    if (message) errors[field] = message;
  }
  return errors;
}

module.exports = {
  PASSWORD_MIN,
  PASSWORD_MAX_BYTES,
  validateName,
  validateEmail,
  validateLoginPassword,
  validateNewPassword,
  validateRegistration,
};
