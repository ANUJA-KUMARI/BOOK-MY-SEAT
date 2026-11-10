// Pure validation rules (no DOM), so they are easy to test and to mirror on the server in Phase 5.
// Each rule returns an error message, or '' when the value is valid.
// IMPORTANT: client-side checks only improve the user experience. The server must repeat them.

// name@ + one or more domain labels, each followed by a dot + a letters-only ending (the last part).
// The pattern is anchored (^ ... $) so it checks the WHOLE input, and the ending captured in group 1
// is checked separately below. Labels may contain letters, digits and hyphens, but not start/end with a hyphen.
const EMAIL_PATTERN = /^[^\s@]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+([A-Za-z]{2,})$/;

// A pattern alone cannot tell "com" from "comextra", so the last part must be a two-letter country ending
// (in, uk, us, ...) or one of these common endings. Trade-off: rarer real endings (.museum, .photography)
// are rejected. The server is still the final authority; real proof of an address is a confirmation email.
const COMMON_ENDINGS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name', 'pro',
  'dev', 'app', 'online', 'site', 'tech', 'store', 'xyz', 'cloud', 'email', 'blog', 'shop', 'live', 'space', 'link', 'club',
]);

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX_BYTES = 72; // bcrypt ignores anything beyond 72 bytes

export function validateName(value) {
  const name = value.trim();
  if (!name) return 'Enter your full name.';
  if (name.length < 2) return 'Your name must be at least 2 characters.';
  if (name.length > 60) return 'Your name must be 60 characters or fewer.';
  return '';
}

export function validateEmail(value) {
  const email = value.trim();
  if (!email) return 'Enter your email address.';
  const message = 'Enter a valid email address, like name@example.com.';
  if (email.length > 254) return message;
  const match = EMAIL_PATTERN.exec(email);
  if (!match) return message;
  const ending = match[1].toLowerCase();
  return ending.length === 2 || COMMON_ENDINGS.has(ending) ? '' : message;
}

/** Login only checks that something was typed; the server decides if it is correct. */
export function validateLoginPassword(value) {
  return value ? '' : 'Enter your password.';
}

export function validateNewPassword(value) {
  if (!value) return 'Create a password.';
  if (value.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES) return `Use at most ${PASSWORD_MAX_BYTES} bytes (about 72 characters).`;
  return '';
}

export function validateConfirm(value, password) {
  if (!value) return 'Re-enter your password.';
  return value === password ? '' : 'Passwords do not match.';
}
