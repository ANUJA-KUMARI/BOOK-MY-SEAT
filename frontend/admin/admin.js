// Admin pages are static files, so verify the session against the API before rendering admin identity.
import { getCurrentUser, logoutUser, ApiError } from '../js/api.js';

const userSlot = document.getElementById('admin-user');
const message = document.getElementById('admin-message');
const logoutButton = document.getElementById('admin-logout');

function showMessage(text) {
  message.textContent = text;
  message.hidden = false;
}

async function protectAdminPage() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      window.location.replace('../pages/login.html');
      return;
    }

    if (user.role !== 'ADMIN') {
      window.location.replace('../index.html');
      return;
    }

    userSlot.textContent = `Signed in as ${user.name} · Administrator`;
    document.body.classList.add('admin-ready');
  } catch (error) {
    // A server/database outage is not the same as an unauthenticated session.
    userSlot.textContent = 'Administrator session could not be verified.';
    showMessage(error instanceof ApiError
      ? error.message
      : 'Could not verify your administrator session. Please try again.');
    logoutButton.disabled = true;
  }
}

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    await logoutUser();
    window.location.replace('../pages/login.html');
  } catch (error) {
    showMessage(error.message || 'Logout failed. Please try again.');
    logoutButton.disabled = false;
  }
});

protectAdminPage();