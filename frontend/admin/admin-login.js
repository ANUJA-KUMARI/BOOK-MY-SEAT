import { ApiError } from '../js/api.js';
const form = document.getElementById('admin-login-form');
const status = document.getElementById('form-status');
form.addEventListener('submit', async (event) => {
  event.preventDefault(); status.hidden = true;
  const values = Object.fromEntries([...form.elements].filter((e) => e.name).map((e) => [e.name, e.value]));
  let invalid = false;
  for (const [name, message] of Object.entries({
    adminId: /^ADM-[A-F0-9]{10}$/i.test(values.adminId.trim()) ? '' : 'Enter your Admin ID.',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) ? '' : 'Enter a valid email.',
    password: values.password ? '' : 'Enter your password.',
  })) {
    document.getElementById(name + '-error').textContent = message;
    if (message) invalid = true;
  }
  if (invalid) return;
  const submit = form.querySelector('button'); submit.disabled = true;
  try {
    const response = await fetch('/api/admin-registration/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(values) });
    const body = await response.json();
    if (!response.ok || !body.success) throw new ApiError(body?.error?.message || 'Admin login failed.', response.status);
    window.location.assign('index.html');
  } catch (error) { status.textContent = error.message || 'Please try again.'; status.hidden = false; }
  finally { submit.disabled = false; }
});
