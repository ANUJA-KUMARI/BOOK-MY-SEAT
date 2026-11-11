// Focused unit tests for Phase 5 authentication primitives. No database or HTTP server is required.
process.env.NODE_ENV = 'test';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  BCRYPT_ROUNDS,
  hashPassword,
  comparePassword,
} = require('../utils/password');
const {
  PASSWORD_MIN,
  PASSWORD_MAX_BYTES,
  validateName,
  validateEmail,
  validateLoginPassword,
  validateNewPassword,
  validateRegistration,
} = require('../validators/auth');

describe('password utilities', () => {
  it('uses the approved bcrypt work factor', () => {
    assert.equal(BCRYPT_ROUNDS, 12);
  });

  it('hashes a password and compares it without exposing the original value', async () => {
    const plainText = 'correct-horse-battery';
    const hash = await hashPassword(plainText);
    assert.notEqual(hash, plainText);
    assert.match(hash, /^\\$2[aby]\\$12\\$/);
    assert.equal(await comparePassword(plainText, hash), true);
    assert.equal(await comparePassword('incorrect-password', hash), false);
  });

  it('rejects invalid input when creating a hash and safely rejects invalid comparison input', async () => {
    await assert.rejects(() => hashPassword(''), /non-empty password/);
    await assert.rejects(() => hashPassword(null), /non-empty password/);
    assert.equal(await comparePassword(null, 'not-a-hash'), false);
    assert.equal(await comparePassword('password', ''), false);
  });
});

describe('authentication validators', () => {
  it('validates names using the frontend limits', () => {
    assert.equal(validateName('Anuja Kumari'), '');
    assert.equal(validateName(' A '), 'Your name must be at least 2 characters.');
    assert.equal(validateName(''), 'Enter your full name.');
    assert.equal(validateName('x'.repeat(61)), 'Your name must be 60 characters or fewer.');
    assert.notEqual(validateName(null), '');
  });

  it('validates email format and supported endings', () => {
    assert.equal(validateEmail('anuja@example.com'), '');
    assert.equal(validateEmail('anuja@university.in'), '');
    assert.equal(validateEmail(' name@example.com '), '');
    for (const email of ['', 'plain-text', 'a@@example.com', 'a@-example.com', 'a@example.c', 'a@example.comextra']) {
      assert.notEqual(validateEmail(email), '', email);
    }
    assert.notEqual(validateEmail('a'.repeat(250) + '@example.com'), '');
  });

  it('checks login passwords without imposing registration rules', () => {
    assert.equal(validateLoginPassword('x'), '');
    assert.notEqual(validateLoginPassword(''), '');
    assert.notEqual(validateLoginPassword(null), '');
  });

  it('enforces new-password length and bcrypt byte limit', () => {
    assert.equal(PASSWORD_MIN, 8);
    assert.equal(PASSWORD_MAX_BYTES, 72);
    assert.notEqual(validateNewPassword('short7'), '');
    assert.equal(validateNewPassword('long-enough-password'), '');
    assert.notEqual(validateNewPassword('é'.repeat(37)), ''); // 74 UTF-8 bytes
    assert.equal(validateNewPassword('é'.repeat(36)), '');
  });

  it('returns field-specific registration errors and accepts valid details', () => {
    assert.deepEqual(validateRegistration({
      name: 'Anuja Kumari',
      email: 'anuja@example.com',
      password: 'long-enough-password',
    }), {});
    const errors = validateRegistration({ name: '', email: 'bad', password: 'short' });
    assert.deepEqual(Object.keys(errors).sort(), ['email', 'name', 'password']);
    assert.deepEqual(validateRegistration(null), {
      name: 'Enter your full name.',
      email: 'Enter your email address.',
      password: 'Create a password.',
    });
  });
});
