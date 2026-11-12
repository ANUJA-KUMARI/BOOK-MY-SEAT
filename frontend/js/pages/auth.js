// Shared by login.html and register.html. The form's data-auth attribute ("login" or "register") selects the rules.
// Phase 7: validated forms submit to the same-origin authentication API.

import { initCommon } from '../components.js';
import { loginUser, registerUser, ApiError } from '../api.js';
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

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.hidden = true;
  fields.forEach((input) => touched.add(input.name));
  const results = fields.map((input) => [input, validateField(input)]);
  const firstInvalid = results.find(([, ok]) => !ok);
  if (firstInvalid) {
    firstInvalid[0].focus();
    return;
  }
  const submit = form.querySelector('button[type="submit"]');
  const originalLabel = submit.textContent;
  submit.disabled = true;
  submit.textContent = mode === 'register' ? 'Creating account…' : 'Logging in…';
  status.hidden = true;

  try {
    const values = Object.fromEntries(fields.map((input) => [input.name, input.value]));
    if (mode === 'register') {
      await registerUser({ name: values.name, email: values.email, password: values.password });
      form.reset();
      touched.clear();
      fields.forEach((input) => showError(input, ''));
      status.textContent = 'Your account has been created. Please log in to continue.';
      status.hidden = false;
      const loginLink = document.createElement('a');
      loginLink.className = 'text-link';
      loginLink.href = 'login.html';
      loginLink.textContent = ' Go to login';
      status.append(loginLink);
    } else {
      await loginUser({ email: values.email, password: values.password });
      window.location.assign('../index.html');
    }
  } catch (error) {
    if (error instanceof ApiError && error.details && typeof error.details === 'object') {
      for (const input of fields) {
        if (error.details[input.name]) showError(input, String(error.details[input.name]));
      }
    }
    status.textContent = error.message || 'Something went wrong. Please try again.';
    status.hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = originalLabel;
  }
});
