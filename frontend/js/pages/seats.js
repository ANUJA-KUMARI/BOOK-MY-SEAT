// Seat selection page: loads the show (?show=ID), draws the seat layout and lets the user pick seats.
// Pricing and the real booking are NOT built yet. Nothing is stored in the browser or sent to a server.

import { initCommon, stateHtml } from '../components.js';
import { getMovie, getMovieShows, ApiError } from '../api.js';
import { escapeHtml, formatLongDate, formatPrice, formatTime, getParam, root } from '../utils.js';

initCommon();

const summary = document.getElementById('show-summary');
const message = document.getElementById('seat-message');
const layout = document.getElementById('seat-layout');
const grid = document.getElementById('seat-grid');
const panel = document.getElementById('booking-panel');

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const SEATS_PER_ROW = 10;
const AISLE_AFTER = 5; // the central aisle sits after seat 5
const MAX_SEATS = 6;

// ---------- Pricing configuration ----------
// Same shape as the database: every seat has a category (seats.category) and every show has one price per
// category (show_prices). Prices come from the show itself, so each cinema can charge differently and the
// movie details page and this page always agree. The row-to-category map below is TEMPORARY sample data
// (it becomes the seats.category column in Phase 7).
const CATEGORY_LABELS = { STANDARD: 'Standard', PREMIUM: 'Premium', RECLINER: 'Recliner' };
const SAMPLE_ROW_CATEGORIES = {
  A: 'STANDARD', B: 'STANDARD', C: 'STANDARD',
  D: 'PREMIUM', E: 'PREMIUM', F: 'PREMIUM',
  G: 'RECLINER', H: 'RECLINER',
};

// ---------- State ----------
// selectedIds is the single source of truth for what the user has picked.
// bookedIds comes from the (sample) server data and is never changed by clicks.
const selectedIds = new Set();
let bookedIds = new Set();
let seatsById = new Map();
let buttonGrid = []; // buttons by [row][column], used for arrow-key movement
let panelEls = null; // elements inside the booking panel, created once by initPanel()
let prices = {}; // price per category for the current show, e.g. { STANDARD: 220, ... }

const seatLabel = (seat) => `${seat.row_label}${seat.seat_number}`;

// Seat limit message: created once, placed above the seat map, and kept visible (sticky) while scrolling the map.
const alertEl = document.createElement('p');
alertEl.className = 'seat-alert';
alertEl.setAttribute('role', 'alert');
alertEl.hidden = true;
document.querySelector('.seat-main').prepend(alertEl);

const showAlert = (text) => { alertEl.textContent = text; alertEl.hidden = false; };
const clearAlert = () => { alertEl.textContent = ''; alertEl.hidden = true; };

// ---------- Data loading ----------
// TEMPORARY (sample data): the API has no "get one show" call yet, and sample show ids start with the
// movie id (movieId * 1000 + ...). Phase 7 replaces this function with the real API call.
async function loadShow(rawId) {
  const showId = Number(rawId);
  if (!Number.isInteger(showId) || showId < 1) throw new ApiError('Invalid show id', 400);
  const movieId = Math.floor(showId / 1000);
  if (movieId < 1) throw new ApiError('Show not found', 404);
  const [movie, shows] = await Promise.all([getMovie(movieId), getMovieShows(movieId)]);
  const show = shows.find((s) => s.id === showId);
  if (!show) throw new ApiError('Show not found', 404);
  return { movie, show };
}

// TEMPORARY (sample data): the real call is GET /api/shows/:id/seats (Phase 7), which returns one entry per seat
// with its status for this show. Here a fixed pseudo-random pattern marks ~22% of seats as booked, and the
// pattern differs from show to show.
function isSampleBooked(showId, seatId) {
  let h = Math.imul(showId, 2654435761) ^ Math.imul(seatId, 40503);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return (h >>> 0) % 100 < 22;
}

async function loadSeats(showId) {
  const seats = [];
  ROWS.forEach((row, r) => {
    for (let n = 1; n <= SEATS_PER_ROW; n += 1) {
      const id = r * SEATS_PER_ROW + n;
      seats.push({
        id, row_label: row, seat_number: n,
        category: SAMPLE_ROW_CATEGORIES[row],
        status: isSampleBooked(showId, id) ? 'BOOKED' : 'AVAILABLE',
      });
    }
  });
  return seats;
}

// Prices per category (INR) for this show, e.g. { STANDARD: 220, PREMIUM: 320, RECLINER: 520 }.
// Sample data: taken from the show object. Phase 7: the same values arrive from the API (show_prices).
async function loadPrices(show) {
  return { ...show.prices };
}

// ---------- Rendering ----------
function seatHtml(seat, tabbable) {
  const booked = bookedIds.has(seat.id);
  const aisle = seat.seat_number === AISLE_AFTER ? ' cinema-seat--aisle-after' : '';
  const name = seatLabel(seat);
  const category = CATEGORY_LABELS[seat.category];
  const label = booked ? `Seat ${name}, ${category}, booked` : `Seat ${name}, ${category}, ${formatPrice(prices[seat.category])}`;
  // Booked seats are disabled buttons: not focusable, not clickable. Free seats are toggle buttons.
  return `<button type="button" class="cinema-seat cinema-seat--${booked ? 'booked' : 'available'}${aisle}"
    data-seat-id="${Number(seat.id)}" data-category="${escapeHtml(seat.category)}" data-row="${ROWS.indexOf(seat.row_label)}" data-col="${Number(seat.seat_number) - 1}"
    tabindex="${tabbable ? 0 : -1}" aria-label="${escapeHtml(label)}"${booked ? ' disabled' : ' aria-pressed="false"'}>${Number(seat.seat_number)}</button>`;
}

function categoryHeaderHtml(category) {
  return `<div class="seat-category">
      <span class="seat-category__name">${escapeHtml(CATEGORY_LABELS[category])}</span>
      <span class="seat-category__price">${formatPrice(prices[category])} per seat</span>
    </div>`;
}

function renderSeatGrid(seats) {
  const rows = new Map();
  seats.forEach((seat) => {
    if (!rows.has(seat.row_label)) rows.set(seat.row_label, []);
    rows.get(seat.row_label).push(seat);
  });
  const firstFreeId = (seats.find((s) => !bookedIds.has(s.id)) || {}).id; // the only seat in the Tab order at first
  let lastCategory = '';
  grid.innerHTML = [...rows].map(([label, rowSeats]) => {
    const category = rowSeats[0].category;
    const header = category !== lastCategory ? categoryHeaderHtml(category) : ''; // a heading at the start of each category
    lastCategory = category;
    return `${header}
    <div class="seat-row">
      <span class="seat-row__label" aria-hidden="true">${escapeHtml(label)}</span>
      <div class="seat-row__seats" role="group" aria-label="Row ${escapeHtml(label)}">
        ${rowSeats.sort((a, b) => a.seat_number - b.seat_number).map((s) => seatHtml(s, s.id === firstFreeId)).join('')}
      </div>
      <span class="seat-row__label" aria-hidden="true">${escapeHtml(label)}</span>
    </div>`;
  }).join('');
  buttonGrid = [...grid.querySelectorAll('.seat-row')].map((row) => [...row.querySelectorAll('.cinema-seat')]);
}

function initPanel() {
  panel.innerHTML = `
    <h2 class="summary-card__title">Your booking</h2>
    <div id="selection-empty" class="booking-empty">
      <p class="booking-empty__title">No seats selected yet.</p>
      <p>Choose up to ${MAX_SEATS} available seats on the map. Seat prices and your total will appear here.</p>
    </div>
    <div id="selection-details" hidden>
      <dl class="summary-list">
        <div><dt>Seats selected</dt><dd id="selection-count">0</dd></div>
      </dl>
      <ul class="price-lines" id="selection-lines" aria-label="Selected seats and prices"></ul>
    </div>
    <div class="booking-total">
      <span class="booking-total__label">Total</span>
      <strong class="booking-total__amount" id="selection-total">${formatPrice(0)}</strong>
    </div>
    <p class="booking-panel__status" id="confirm-note" role="status" hidden></p>
    <button class="btn btn--primary btn--block booking-panel__action" id="confirm-btn" type="button" disabled>Confirm booking</button>
    <p class="summary-card__note">Demo project: no real payment is taken.</p>
    <p class="sr-only" id="selection-announce" role="status"></p>`;
  const $ = (id) => panel.querySelector(`#${id}`);
  panelEls = {
    empty: $('selection-empty'), details: $('selection-details'), count: $('selection-count'),
    lines: $('selection-lines'), total: $('selection-total'), note: $('confirm-note'),
    confirm: $('confirm-btn'), announce: $('selection-announce'),
  };
}

// The one place where the selection is turned into seats, categories, prices and a total.
// Everything shown in the panel is derived from selectedIds, so nothing can get out of sync.
function getSelection() {
  const items = [...selectedIds].sort((a, b) => a - b).map((id) => {
    const seat = seatsById.get(id);
    return { id, label: seatLabel(seat), category: seat.category, price: prices[seat.category] };
  });
  return { items, count: items.length, total: items.reduce((sum, item) => sum + item.price, 0) };
}

function renderPanel() {
  const { items, count, total } = getSelection();
  panelEls.empty.hidden = count > 0;
  panelEls.details.hidden = count === 0;
  panelEls.count.textContent = String(count);
  panelEls.lines.innerHTML = items.map((item) => `
    <li class="price-line">
      <span class="price-line__seat">${escapeHtml(item.label)}</span>
      <span class="price-line__category">${escapeHtml(CATEGORY_LABELS[item.category])}</span>
      <span class="price-line__amount">${formatPrice(item.price)}</span>
    </li>`).join('');
  panelEls.total.textContent = formatPrice(total);
  panelEls.confirm.disabled = count === 0;
  panelEls.note.hidden = true;
  panelEls.announce.textContent = count === 0
    ? `No seats selected. Total ${formatPrice(0)}.`
    : `${count} ${count === 1 ? 'seat' : 'seats'} selected: ${items.map((i) => i.label).join(', ')}. Total ${formatPrice(total)}.`;
}

function syncSeatButton(id) {
  const btn = grid.querySelector(`[data-seat-id="${id}"]`);
  const on = selectedIds.has(id);
  btn.classList.toggle('cinema-seat--selected', on);
  btn.classList.toggle('cinema-seat--available', !on);
  btn.setAttribute('aria-pressed', String(on));
}

// ---------- Selection logic ----------
function toggleSeat(id) {
  if (!seatsById.has(id) || bookedIds.has(id)) return; // booked seats can never be selected
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
  } else if (selectedIds.size >= MAX_SEATS) {
    showAlert(`You can select a maximum of ${MAX_SEATS} seats.`);
    return;
  } else {
    selectedIds.add(id);
  }
  clearAlert();
  syncSeatButton(id);
  renderPanel();
}

// One click listener for all seats (event delegation). Enter and Space on a focused button also fire "click".
grid.addEventListener('click', (e) => {
  const btn = e.target.closest('.cinema-seat');
  if (btn) toggleSeat(Number(btn.dataset.seatId));
});

// Keep exactly one seat in the Tab order (the last one focused), so Tab does not stop on all 80 seats.
grid.addEventListener('focusin', (e) => {
  const btn = e.target.closest('.cinema-seat');
  if (!btn || btn.disabled) return;
  const current = grid.querySelector('.cinema-seat[tabindex="0"]');
  if (current) current.setAttribute('tabindex', '-1');
  btn.setAttribute('tabindex', '0');
});

// Arrow keys move between free seats; booked seats are skipped.
const ARROWS = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
grid.addEventListener('keydown', (e) => {
  const step = ARROWS[e.key];
  const btn = e.target.closest('.cinema-seat');
  if (!step || !btn) return;
  e.preventDefault(); // stop the arrow key from scrolling the page
  let r = Number(btn.dataset.row) + step[0];
  let c = Number(btn.dataset.col) + step[1];
  while (r >= 0 && r < buttonGrid.length && c >= 0 && c < buttonGrid[r].length) {
    if (!buttonGrid[r][c].disabled) { buttonGrid[r][c].focus(); return; }
    r += step[0];
    c += step[1];
  }
});

// Confirm booking is not implemented yet: say so instead of silently doing nothing.
panel.addEventListener('click', (e) => {
  if (!e.target.closest('#confirm-btn') || panelEls.confirm.disabled) return;
  panelEls.note.textContent = 'Confirming a booking is not connected yet, so nothing was booked.';
  panelEls.note.hidden = false;
});

// ---------- Page ----------
function renderSummary({ movie, show }) {
  document.title = `Select seats: ${movie.title} | BOOK_MY_SEAT`;
  summary.innerHTML = `
    <div class="container show-summary__inner">
      <div>
        <h1>Select your seats</h1>
        <p class="show-summary__movie">${escapeHtml(movie.title)}</p>
      </div>
      <dl class="show-summary__list">
        <div><dt>Cinema</dt><dd>${escapeHtml(show.cinema.name)}, ${escapeHtml(show.screen.name)}</dd></div>
        <div><dt>Date</dt><dd>${formatLongDate(show.start_time)}</dd></div>
        <div><dt>Showtime</dt><dd>${formatTime(show.start_time)}</dd></div>
      </dl>
      <a class="btn btn--ghost btn--sm" href="${root()}pages/movie.html?id=${Number(movie.id)}">Change showtime</a>
    </div>`;
  summary.hidden = false;
  layout.hidden = false;
  message.hidden = true;
}

function renderError(err) {
  const missing = err instanceof ApiError && (err.status === 400 || err.status === 404);
  document.title = 'Show not found | BOOK_MY_SEAT';
  message.innerHTML = missing
    ? stateHtml({
      title: 'Show not found',
      message: 'This show does not exist, has already started, or the link is incorrect. Choose a movie and showtime to continue.',
      actionHref: `${root()}pages/movies.html`,
      actionLabel: 'Browse movies',
    })
    : stateHtml({ title: 'Could not load this show', message: 'Check your connection and try again.', retry: true });
}

async function load() {
  message.setAttribute('aria-busy', 'true');
  try {
    const { movie, show } = await loadShow(getParam('show'));
    const seats = await loadSeats(show.id);
    const showPrices = await loadPrices(show);
    if (!seats.every((seat) => Number.isFinite(showPrices[seat.category]))) throw new Error('A seat category has no price');
    prices = showPrices;
    selectedIds.clear();
    clearAlert();
    seatsById = new Map(seats.map((s) => [s.id, s]));
    bookedIds = new Set(seats.filter((s) => s.status === 'BOOKED').map((s) => s.id));
    renderSummary({ movie, show });
    renderSeatGrid(seats);
    initPanel();
    renderPanel();
  } catch (err) {
    renderError(err);
  } finally {
    message.removeAttribute('aria-busy');
  }
}

message.addEventListener('click', (e) => { if (e.target.closest('[data-retry]')) load(); });
load();
