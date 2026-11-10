// Shared by login.html and register.html. The form's data-auth attribute ("login" or "register") selects the rules.
// Phase 3 scope: validation and messages only. Nothing is sent anywhere and nobody is actually logged in.

import { initCommon } from '../components.js';
import {
  validateName, validateEmail, validateLoginPassword, validateNewPassword, validateConfirm,
} from '../validators.js';

initCommon();

const form = document.querySelector('form[data-auth]');
const mode = form.dataset.auth;
const status = document.getElementById('form-status');

const rules = {
  name: (f) => validateName(f.elements.name.value),
  email: (f) => validateEmail(f.elements.email.value),
  password: (f) => (mode === 'register'
    ? validateNewPassword(f.elements.password.value)
    : validateLoginPassword(f.elements.password.value)),
  confirm: (f) => validateConfirm(f.elements.confirm.value, f.elements.password.value),
};

const fields = [...form.elements].filter((el) => el.name && rules[el.name]);
const touched = new Set();

function showError(input, message) {
  const errorEl = document.getElementById(`${input.id}-error`);
  errorEl.textContent = message;
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
  // Keep the hint (if any) and the error both linked to the input.
  const hint = document.getElementById(`${input.id}-hint`);
  input.setAttribute('aria-describedby', [hint && hint.id, message && errorEl.id].filter(Boolean).join(' '));
}

function validateField(input) {
  const message = rules[input.name](form);
  showError(input, message);
  return message === '';
}

fields.forEach((input) => {
  input.addEventListener('blur', () => { touched.add(input.name); validateField(input); });
  input.addEventListener('input', () => {
    status.hidden = true;
    if (touched.has(input.name)) validateField(input);
    // Changing the password can make an already-checked confirmation valid or invalid.
    if (input.name === 'password' && touched.has('confirm')) validateField(form.elements.confirm);
  });
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  status.hidden = true;
  fields.forEach((input) => touched.add(input.name));
  const results = fields.map((input) => [input, validateField(input)]);
  const firstInvalid = results.find(([, ok]) => !ok);
  if (firstInvalid) {
    firstInvalid[0].focus();
    return;
  }
  // Intentionally no fetch() here and the password is never logged or stored.
  status.textContent = mode === 'register'
    ? 'Your details look valid. Registration is not connected yet (the backend arrives in Phase 5), so nothing was sent or saved.'
    : 'Your details look valid. Login is not connected yet (the backend arrives in Phase 5), so nothing was sent and you are not signed in.';
  status.hidden = false;
});
