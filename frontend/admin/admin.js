// Shared administrator dashboard session protection and live operational summary.
import { getCurrentUser, logoutUser, getAdminDashboard, ApiError } from '../js/api.js';

const userSlot = document.getElementById('admin-user');
const message = document.getElementById('admin-message');
const logoutButton = document.getElementById('admin-logout');

function showMessage(text) {
  message.textContent = text;
  message.hidden = false;
}
function formatMoney(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
}
function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
function element(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}
function renderDashboard(data) {
  const metrics = data.metrics;
  const values = {
    'metric-total-bookings': metrics.total_bookings,
    'metric-confirmed': metrics.confirmed_bookings,
    'metric-cancelled': metrics.cancelled_bookings,
    'metric-revenue': formatMoney(metrics.confirmed_revenue),
    'metric-upcoming-shows': metrics.upcoming_shows,
    'metric-active-movies': metrics.active_movies,
    'metric-cinemas': metrics.cinemas,
    'metric-screens': metrics.screens,
  };
  for (const [id, value] of Object.entries(values)) {
    const target = document.getElementById(id);
    if (target) target.textContent = String(value ?? 0);
  }

  const recent = document.getElementById('dashboard-recent');
  recent.replaceChildren();
  if (!data.recent_bookings.length) {
    recent.append(element('p', 'dashboard-empty', 'No bookings have been recorded yet.'));
  } else {
    for (const booking of data.recent_bookings) {
      const row = element('a', 'dashboard-booking', '');
      row.href = 'bookings.html';
      const details = element('span', 'dashboard-booking__details');
      details.append(element('strong', '', booking.booking_ref));
      details.append(element('small', '', booking.customer.name + ' · ' + booking.movie_title));
      const amount = element('span', 'dashboard-booking__amount');
      amount.append(element('strong', '', formatMoney(booking.total_amount)));
      amount.append(element('small', '', booking.status + ' · ' + booking.seat_count + ' seat(s)'));
      row.append(details, amount);
      recent.append(row);
    }
  }

  const upcoming = document.getElementById('dashboard-upcoming');
  upcoming.replaceChildren();
  if (!data.upcoming_shows.length) {
    upcoming.append(element('p', 'dashboard-empty', 'There are no upcoming shows scheduled.'));
  } else {
    for (const show of data.upcoming_shows) {
      const row = element('div', 'dashboard-show');
      row.append(element('strong', '', show.movie_title));
      row.append(element('small', '', show.cinema_name + ' · ' + show.screen_name));
      row.append(element('time', '', formatDate(show.start_time)));
      upcoming.append(row);
    }
  }
}

async function protectAdminPage() {
  try {
    const user = await getCurrentUser();
    if (!user) { window.location.replace('../pages/login.html'); return false; }
    if (user.role !== 'ADMIN') { window.location.replace('../index.html'); return false; }
    userSlot.textContent = `Signed in as ${user.name} · Administrator`;
    document.body.classList.add('admin-ready');
    return true;
  } catch (error) {
    userSlot.textContent = 'Administrator session could not be verified.';
    showMessage(error instanceof ApiError ? error.message : 'Could not verify your administrator session. Please try again.');
    logoutButton.disabled = true;
    return false;
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

(async () => {
  if (!(await protectAdminPage())) return;
  try {
    const dashboard = await getAdminDashboard();
    renderDashboard(dashboard);
  } catch (error) {
    showMessage(error.message || 'Could not load the administrator dashboard.');
    for (const id of ['dashboard-recent', 'dashboard-upcoming']) {
      const target = document.getElementById(id);
      if (target) target.replaceChildren(element('p', 'dashboard-empty', 'Dashboard information is temporarily unavailable.'));
    }
  }
})();
