import { getCurrentUser, logoutUser, getAdminBookings, getAdminBooking } from '../js/api.js';

const $ = (selector) => document.querySelector(selector);
const body = $('#booking-table-body');
const pageMessage = $('#page-message');
let page = 1;
let totalPages = 0;
let searchTimer;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function showMessage(text, error = false) {
  pageMessage.textContent = text;
  pageMessage.hidden = false;
  pageMessage.classList.toggle('admin-message--error', error);
}
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
}
async function protectPage() {
  const user = await getCurrentUser();
  if (!user) { location.replace('../pages/login.html'); return false; }
  if (user.role !== 'ADMIN') { location.replace('../index.html'); return false; }
  $('#admin-user').textContent = 'Signed in as ' + user.name + ' · Administrator';
  return true;
}
function renderBookings(result) {
  body.replaceChildren();
  const bookings = result.bookings || [];
  const pagination = result.pagination || {};
  totalPages = Number(pagination.total_pages || 0);
  $('#booking-count').textContent = Number(pagination.total || 0) + ' booking(s)';
  $('#booking-page-info').textContent = 'Page ' + page + ' of ' + Math.max(totalPages, 1);
  $('#booking-prev').disabled = page <= 1;
  $('#booking-next').disabled = page >= totalPages;
  if (!bookings.length) {
    const row = node('tr'); const cell = node('td', 'booking-empty', 'No bookings match your search.');
    cell.colSpan = 7; row.append(cell); body.append(row); return;
  }
  for (const booking of bookings) {
    const row = node('tr');
    const ref = node('td'); ref.append(node('span', 'booking-primary', booking.booking_ref), node('span', 'booking-secondary', 'Created ' + formatDate(booking.created_at)));
    const customer = node('td'); customer.append(node('span', 'booking-primary', booking.customer.name), node('span', 'booking-secondary', booking.customer.email));
    const show = node('td'); show.append(node('span', 'booking-primary', booking.show.movie.title), node('span', 'booking-secondary', booking.show.cinema.name + ' · ' + booking.show.screen.name + ' · ' + formatDate(booking.show.start_time)));
    const seats = node('td', '', booking.seats.length + ' seat(s)');
    const amount = node('td', 'booking-primary', money(booking.total_amount));
    const status = node('td'); status.append(node('span', 'booking-status booking-status--' + booking.status.toLowerCase(), booking.status));
    const actions = node('td'); const view = node('button', 'booking-view', 'View details'); view.type = 'button';
    view.addEventListener('click', () => openDetails(booking.id)); actions.append(view);
    row.append(ref, customer, show, seats, amount, status, actions); body.append(row);
  }
}
async function loadBookings() {
  $('#booking-count').textContent = 'Loading…';
  try {
    const result = await getAdminBookings({
      search: $('#booking-search').value.trim(),
      status: $('#booking-status').value,
      page,
      limit: Number($('#booking-limit').value),
    });
    renderBookings(result);
  } catch (error) {
    showMessage(error.message || 'Could not load bookings.', true);
    body.replaceChildren();
    const row = node('tr'); const cell = node('td', 'booking-empty', 'Booking data could not be loaded.');
    cell.colSpan = 7; row.append(cell); body.append(row);
  }
}
function detailItem(label, value) {
  const item = node('div', 'booking-detail-item');
  item.append(node('small', '', label), node('strong', '', value || '—'));
  return item;
}
async function openDetails(id) {
  const dialog = $('#booking-dialog');
  const content = $('#booking-detail-content');
  content.replaceChildren(node('p', '', 'Loading booking details…'));
  dialog.showModal();
  try {
    const { booking } = await getAdminBooking(id);
    $('#booking-dialog-title').textContent = booking.booking_ref;
    const grid = node('div', 'booking-detail-grid');
    grid.append(
      detailItem('Booking status', booking.status),
      detailItem('Total amount', money(booking.total_amount)),
      detailItem('Customer', booking.customer.name),
      detailItem('Email', booking.customer.email),
      detailItem('Movie', booking.show.movie.title),
      detailItem('Cinema / screen', booking.show.cinema.name + ' · ' + booking.show.screen.name),
      detailItem('Showtime', formatDate(booking.show.start_time)),
      detailItem('Booked on', formatDate(booking.created_at)),
      detailItem('Cancelled on', formatDate(booking.cancelled_at)),
    );
    const seats = node('section', 'booking-detail-seats');
    seats.append(node('h3', '', 'Seats (' + booking.seats.length + ')'));
    if (!booking.seats.length) seats.append(node('p', '', 'No seat records were found.'));
    for (const seat of booking.seats) {
      const chip = node('span', 'booking-seat-chip', seat.row_label + seat.seat_number + ' · ' + seat.category + ' · ' + money(seat.price));
      seats.append(chip);
    }
    content.replaceChildren(grid, seats);
  } catch (error) {
    content.replaceChildren(node('p', '', error.message || 'Could not load booking details.'));
  }
}
$('#booking-close').addEventListener('click', () => $('#booking-dialog').close());
$('#booking-dialog').addEventListener('click', (event) => {
  if (event.target === $('#booking-dialog')) $('#booking-dialog').close();
});
$('#booking-prev').addEventListener('click', () => { if (page > 1) { page -= 1; loadBookings(); } });
$('#booking-next').addEventListener('click', () => { if (page < totalPages) { page += 1; loadBookings(); } });
$('#booking-status').addEventListener('change', () => { page = 1; loadBookings(); });
$('#booking-limit').addEventListener('change', () => { page = 1; loadBookings(); });
$('#booking-search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { page = 1; loadBookings(); }, 250);
});
$('#admin-logout').addEventListener('click', async () => {
  try { await logoutUser(); location.replace('../pages/login.html'); }
  catch (error) { showMessage(error.message || 'Logout failed.', true); }
});
(async () => {
  try { if (await protectPage()) await loadBookings(); }
  catch (error) { showMessage(error.message || 'Could not verify administrator access.', true); }
})();
