// Run from the frontend folder:  node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEmail } from '../js/validators.js';

const valid = [
  'anuja@gmail.com',
  'anuja@gmail.com.in',
  'name.surname+tag@mail.example.in',
  '  anuja@gmail.com  ',          // surrounding spaces are trimmed
  'Anuja@Gmail.COM',               // case does not matter
];

const invalid = [
  'anuja@gmail.comextra',          // unknown ending
  'anuja@gmail.com123',            // digits in the ending
  'anuja2170@gmail.comanuja21',    // the originally reported input
  'anuja@',                        // no domain
  '@gmail.com',                    // no name before @
  'anuja@gmail',                   // no dot in domain
  'anuja@gmail.c',                 // ending too short
  'anuja@@gmail.com',              // two @ signs
  'anu ja@gmail.com',              // space inside
  'anuja@-gmail.com',              // label starts with a hyphen
  'anuja@gmail..com',              // empty label
  '',                              // empty
  `${'a'.repeat(250)}@gmail.com`,  // longer than 254 characters
];

for (const email of valid) {
  test(`valid: "${email}"`, () => assert.equal(validateEmail(email), ''));
}
for (const email of invalid) {
  test(`invalid: "${email.length > 40 ? `${email.slice(0, 20)}...` : email}"`, () => assert.notEqual(validateEmail(email), ''));
}
