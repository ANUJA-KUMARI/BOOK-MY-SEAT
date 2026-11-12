import { initCommon, stateHtml } from '../components.js';
import { getCurrentUser, getUserBookings, getUserBooking, ApiError } from '../api.js';
import { escapeHtml, formatLongDate, formatPrice, formatTime, getParam, root } from '../utils.js';

initCommon();

const statusEl = document.getElementById('booking-status');
const contentEl = document.getElementById('booking-content');
const paginationEl = document.getElementById('booking-pagination');
const pageTitle = document.getElementById('page-title');
const pageIntro = document.getElementById('page-intro');
const PAGE_SIZE = 10;

function dateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return `${formatLongDate(date)} · ${formatTime(date)}`;
}

function statusPill(status) {
  const value = String(status || 'UNKNOWN').toUpperCase();
  const modifier = value === 'CONFIRMED' ? 'confirmed' : value === 'CANCELLED' ? 'cancelled' : '';
  return `<span class="booking-status-pill ${modifier ? `booking-status-pill--${modifier}` : ''}">${escapeHtml(value)}</span>`;
}

function seatLabels(seats) {
  return (seats || []).map((seat) => `${escapeHtml(seat.row_label)}${Number(seat.seat_number)}`).join(', ') || 'Seat details unavailable';
}

function bookingCard(booking) {
  const movie = booking.show?.movie?.title || 'Movie';
  const cinema = booking.show?.cinema?.name || 'Cinema';
  return `<article class="booking-card">
    <div>
      <div class="booking-card__top"><h2>${escapeHtml(movie)}</h2>${statusPill(booking.status)}</div>
      <p class="booking-card__meta">${escapeHtml(cinema)} · ${escapeHtml(dateTime(booking.show?.start_time))}</p>
      <p class="booking-card__seats"><strong>Seats:</strong> ${seatLabels(booking.seats)}</p>
      <p class="booking-card__ref">Reference: ${escapeHtml(booking.booking_ref)}</p>
    </div>
    <div class="booking-card__side">
      <strong class="booking-card__price">${formatPrice(booking.total_amount)}</strong>
      <a class="btn btn--outline btn--sm" href="my-bookings.html?id=${Number(booking.id)}">View details</a>
    </div>
  </article>`;
}

function renderPagination(pagination) {
  const { page, total_pages: totalPages, total } = pagination;
  paginationEl.hidden = totalPages <= 1;
  paginationEl.innerHTML = `
    <button class="btn btn--outline btn--sm" type="button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Previous</button>
    <span class="booking-pagination__label">Page ${page} of ${totalPages} · ${total} booking${total === 1 ? '' : 's'}</span>
    <button class="btn btn--outline btn--sm" type="button" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Next</button>`;
  paginationEl.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => loadList(Number(button.dataset.page)));
  });
}

async function loadList(page = 1) {
  pageTitle.textContent = 'My bookings';
  pageIntro.textContent = 'Your tickets, all in one place.';
  statusEl.textContent = 'Loading your bookings…';
  contentEl.innerHTML = '';
  paginationEl.hidden = true;
  try {
    const result = await getUserBookings({ page, limit: PAGE_SIZE });
    statusEl.textContent = '';
    if (!result.bookings.length) {
      contentEl.innerHTML = `<div class="booking-empty"><h2>No bookings yet</h2><p>When you book a movie, your tickets will appear here.</p><a class="btn btn--primary" href="${root()}pages/movies.html">Explore movies</a></div>`;
      return;
    }
    contentEl.innerHTML = `<div class="booking-list">${result.bookings.map(bookingCard).join('')}</div>`;
    renderPagination(result.pagination);
  } catch (error) {
    statusEl.innerHTML = stateHtml({
      title: error instanceof ApiError && error.status === 401 ? 'Please log in' : 'Could not load bookings',
      message: error.message || 'Something went wrong. Please try again.',
      actionHref: error instanceof ApiError && error.status === 401 ? `${root()}pages/login.html` : '',
      actionLabel: 'Log in',
      retry: !(error instanceof ApiError && error.status === 401),
    });
    const retry = statusEl.querySelector('[data-retry]');
    if (retry) retry.addEventListener('click', () => loadList(page));
  }
}

async function loadDetail(id) {
  pageTitle.textContent = 'Booking details';
  pageIntro.textContent = 'Your booking information and ticket details.';
  statusEl.textContent = 'Loading booking details…';
  contentEl.innerHTML = '';
  paginationEl.hidden = true;
  try {
    const { booking } = await getUserBooking(id);
    const movie = booking.show.movie;
    const cinema = booking.show.cinema;
    const seatRows = (booking.seats || []).map((seat) => `<tr><td>${escapeHtml(seat.row_label)}${Number(seat.seat_number)}</td><td>${escapeHtml(seat.category)}</td><td>${formatPrice(seat.price)}</td></tr>`).join('');
    statusEl.textContent = '';
    contentEl.innerHTML = `
      <a class="booking-back" href="my-bookings.html">← Back to My bookings</a>
      <article class="booking-detail">
        <div class="booking-detail__header"><h2>${escapeHtml(movie.title)}</h2>${statusPill(booking.status)}</div>
        <div class="booking-detail__grid">
          <div><p class="booking-detail__label">Booking reference</p><p class="booking-detail__value">${escapeHtml(booking.booking_ref)}</p></div>
          <div><p class="booking-detail__label">Booked on</p><p class="booking-detail__value">${escapeHtml(dateTime(booking.created_at))}</p></div>
          <div><p class="booking-detail__label">Cinema</p><p class="booking-detail__value">${escapeHtml(cinema.name)} · ${escapeHtml(cinema.city)}</p><p>${escapeHtml(cinema.address)}</p></div>
          <div><p class="booking-detail__label">Showtime</p><p class="booking-detail__value">${escapeHtml(dateTime(booking.show.start_time))}</p><p>${escapeHtml(booking.show.screen.name)}</p></div>
          <div><p class="booking-detail__label">Cancelled on</p><p class="booking-detail__value">${booking.cancelled_at ? escapeHtml(dateTime(booking.cancelled_at)) : '—'}</p></div>
        </div>
        <h3>Seats and price</h3>
        <div class="table-scroll"><table class="booking-detail__seats"><thead><tr><th>Seat</th><th>Category</th><th>Price</th></tr></thead><tbody>${seatRows || '<tr><td colspan="3">No seat details available.</td></tr>'}</tbody></table></div>
        <div class="booking-detail__total"><span>Total paid / payable</span><span>${formatPrice(booking.total_amount)}</span></div>
        <p class="summary-card__note">Demo project: no real payment is taken.</p>
      </article>`;
  } catch (error) {
    statusEl.innerHTML = stateHtml({
      title: error instanceof ApiError && error.status === 404 ? 'Booking not found' : error instanceof ApiError && error.status === 401 ? 'Please log in' : 'Could not load booking',
      message: error.message || 'Something went wrong. Please try again.',
      actionHref: error instanceof ApiError && error.status === 401 ? `${root()}pages/login.html` : 'my-bookings.html',
      actionLabel: error instanceof ApiError && error.status === 401 ? 'Log in' : 'Back to bookings',
    });
  }
}

async function start() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    statusEl.innerHTML = stateHtml({ title: 'Please log in', message: 'Sign in to view your bookings.', actionHref: 'login.html', actionLabel: 'Log in' });
    return;
  }
  const id = getParam('id');
  if (id !== null) {
    if (!/^[1-9]\\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
      statusEl.innerHTML = stateHtml({ title: 'Invalid booking', message: 'The booking link is not valid.', actionHref: 'my-bookings.html', actionLabel: 'Back to bookings' });
      return;
    }
    await loadDetail(id);
  } else {
    await loadList();
  }
}

start();
