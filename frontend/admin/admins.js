import { getCurrentUser, logoutUser, ApiError } from '../js/api.js';
const $ = (id) => document.getElementById(id);
const message = (text) => { $('message').textContent = text; $('message').hidden = false; };
const csrf = () => { const m = document.cookie.match(/(?:^|; )bms_csrf=([^;]*)/); return m ? decodeURIComponent(m[1]) : ''; };
async function api(path, options = {}) {
  const response = await fetch('/api/admin-registration' + path, { credentials: 'same-origin', headers: { Accept: 'application/json', ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.method && options.method !== 'GET' ? {'x-csrf-token':csrf()} : {}) }, ...options });
  const body = await response.json();
  if (!response.ok || !body.success) throw new ApiError(body?.error?.message || 'Request failed.', response.status);
  return body.data;
}
function el(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
async function loadApplications() {
  try {
    const { applications } = await api('/applications');
    const root = $('applications'); root.replaceChildren();
    if (!applications.length) { root.append(el('p', 'No admin applications yet.')); return; }
    for (const app of applications) {
      const card = el('article', 'admin-module');
      card.append(el('span', 'admin-module__number', app.adminId));
      card.append(el('h3', app.name));
      card.append(el('p', app.email + ' · ' + app.status));
      if (app.status === 'PENDING') {
        for (const decision of ['APPROVED', 'REJECTED']) {
          const button = el('button', 'btn ' + (decision === 'APPROVED' ? 'btn--primary' : 'btn--ghost'), decision === 'APPROVED' ? 'Approve' : 'Reject');
          button.type = 'button';
          button.addEventListener('click', async () => {
            button.disabled = true;
            try { await api('/applications/' + app.userId, { method: 'PATCH', body: JSON.stringify({ decision }) }); await loadApplications(); }
            catch (error) { message(error.message); button.disabled = false; }
          });
          card.append(button);
        }
      }
      root.append(card);
    }
  } catch (error) { $('applications').replaceChildren(el('p', error.message)); }
}
(async () => {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') { location.replace('login.html'); return; }
    $('identity').textContent = 'Signed in as ' + user.name;
    await loadApplications();
  } catch (error) { message(error.message); }
})();
$('create-invite').addEventListener('click', async () => {
  const button = $('create-invite'); button.disabled = true;
  try {
    const invite = await api('/invitations', { method: 'POST', body: '{}' });
    const root = $('invite-result'); root.hidden = false; root.replaceChildren(
      el('h3', 'Invitation created — share these details securely'),
      el('p', 'Admin ID: ' + invite.adminId),
      el('p', 'One-time invitation code: ' + invite.invitationCode),
      el('p', 'Expires in ' + invite.expiresInHours + ' hours. The code is shown only now; copy it before leaving this page.')
    );
    const copy = el('button', 'btn btn--ghost', 'Copy invitation details'); copy.type = 'button';
    copy.addEventListener('click', async () => navigator.clipboard.writeText('Admin ID: ' + invite.adminId + '\nInvitation code: ' + invite.invitationCode));
    root.append(copy);
  } catch (error) { message(error.message); }
  finally { button.disabled = false; }
});
$('refresh').addEventListener('click', loadApplications);
$('logout').addEventListener('click', async () => { try { await logoutUser(); location.replace('login.html'); } catch (error) { message(error.message); } });
