import { initCommon } from '../js/components.js';
import { ApiError } from '../js/api.js';
import { validateName, validateEmail, validateNewPassword, validateConfirm } from '../js/validators.js';
initCommon();
const form = document.getElementById('admin-register-form');
const status = document.getElementById('form-status');
const rules = {
  adminId: (v) => /^ADM-[A-F0-9]{10}$/i.test(v.trim()) ? '' : 'Enter the Admin ID supplied by the first admin.',
  invitationCode: (v) => v.length >= 32 ? '' : 'Enter the invitation code supplied by the first admin.',
  name: validateName, email: validateEmail, password: validateNewPassword,
  confirm: (v) => validateConfirm(v, form.elements.password.value),
};
form.addEventListener('submit', async (event) => {
  event.preventDefault(); status.hidden = true;
  const values = Object.fromEntries([...form.elements].filter((e) => e.name).map((e) => [e.name, e.value]));
  let invalid = false;
  for (const [name, rule] of Object.entries(rules)) {
    const message = rule(values[name] || '');
    const input = form.elements[name];
    document.getElementById(name + '-error').textContent = message;
    if (message) { input.setAttribute('aria-invalid', 'true'); invalid = true; } else input.removeAttribute('aria-invalid');
  }
  if (invalid) return;
  const submit = form.querySelector('button'); submit.disabled = true;
  try {
    const response = await fetch('/api/admin-registration/register', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(values) });
    const body = await response.json();
    if (!response.ok || !body.success) throw new ApiError(body?.error?.message || 'Registration could not be submitted.', response.status, body?.error?.details);
    form.reset(); status.textContent = 'Application submitted. Your account remains inactive until the first administrator approves it.'; status.hidden = false;
  } catch (error) { status.textContent = error.message || 'Please try again.'; status.hidden = false; }
  finally { submit.disabled = false; }
});
