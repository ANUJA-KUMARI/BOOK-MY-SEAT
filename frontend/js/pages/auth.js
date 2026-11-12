// Shared login/register page behavior. Server-side validation and authentication remain authoritative.
import { initCommon } from '../components.js';
import { registerUser, loginUser, ApiError } from '../api.js';
import {
  validateName, validateEmail, validateLoginPassword, validateNewPassword, validateConfirm,
} from '../validators.js';
import { root } from '../utils.js';

initCommon();

const form = document.querySelector('form[data-auth]');
const mode = form?.dataset.auth;
if (form && (mode === 'login' || mode === 'register')) {
  const status = document.getElementById('form-status');
  const submitButton = form.querySelector('button[type="submit"]');

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
    if (!errorEl) return;
    errorEl.textContent = message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    const hint = document.getElementById(`${input.id}-hint`);
    input.setAttribute('aria-describedby', [hint && hint.id, message && errorEl.id].filter(Boolean).join(' '));
  }

  function validateField(input) {
    const message = rules[input.name](form);
    showError(input, message);
    return message === '';
  }

  function showStatus(message, isError = false) {
    status.replaceChildren(document.createTextNode(message));
    status.hidden = false;
    status.setAttribute('role', isError ? 'alert' : 'status');
  }

  function applyServerFieldErrors(details) {
    if (!details || typeof details !== 'object') return false;
    let applied = false;
    for (const input of fields) {
      const message = details[input.name];
      if (typeof message === 'string' && message) {
        showError(input, message);
        touched.add(input.name);
        applied = true;
      }
    }
    return applied;
  }

  fields.forEach((input) => {
    input.addEventListener('blur', () => { touched.add(input.name); validateField(input); });
    input.addEventListener('input', () => {
      status.hidden = true;
      if (touched.has(input.name)) validateField(input);
      if (input.name === 'password' && touched.has('confirm')) validateField(form.elements.confirm);
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.hidden = true;
    fields.forEach((input) => touched.add(input.name));
    const results = fields.map((input) => [input, validateField(input)]);
    const firstInvalid = results.find(([, valid]) => !valid);
    if (firstInvalid) {
      firstInvalid[0].focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = mode === 'register' ? 'Creating account…' : 'Logging in…';
    try {
      if (mode === 'register') {
        await registerUser({
          name: form.elements.name.value.trim(),
          email: form.elements.email.value.trim(),
          password: form.elements.password.value,
        });
        showStatus('Your account has been created. Please log in to continue.');
        const link = document.createElement('a');
        link.className = 'text-link';
        link.href = `${root()}pages/login.html`;
        link.textContent = ' Go to log in';
        status.append(link);
        form.reset();
        fields.forEach((input) => { touched.delete(input.name); showError(input, ''); });
      } else {
        await loginUser({
          email: form.elements.email.value.trim(),
          password: form.elements.password.value,
        });
        window.location.assign(`${root()}index.html`);
      }
    } catch (error) {
      const hasFieldErrors = error instanceof ApiError && applyServerFieldErrors(error.details);
      if (hasFieldErrors) showStatus('Please correct the highlighted fields.', true);
      else if (error instanceof ApiError && error.status === 409) showStatus(error.message, true);
      else if (error instanceof ApiError && error.status === 401) showStatus('Invalid email or password. Please try again.', true);
      else showStatus(error?.message || 'Something went wrong. Please try again.', true);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = mode === 'register' ? 'Create account' : 'Log in';
    }
  });
}
