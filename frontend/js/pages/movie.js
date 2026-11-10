import { initCommon, posterHtml, stateHtml } from '../components.js';
import { getMovie, getMovieShows, ApiError } from '../api.js';
import {
  escapeHtml, formatDuration, formatPrice, formatTime, formatReleaseDate,
  formatLongDate, formatDateParts, getParam, root, toDateKey,
} from '../utils.js';

initCommon();

const mount = document.getElementById('movie-root');
const movieId = getParam('id');

let movie = null;
let shows = [];
let selectedDate = '';
let selectedShowId = null;

// Link to the seat selection page for the chosen show.
const seatSelectionHref = (showId) => `${root()}pages/seats.html?show=${Number(showId)}`;

const categoryLabel = (cat) => cat.charAt(0) + cat.slice(1).toLowerCase();
const minPrice = (show) => Math.min(...Object.values(show.prices));
const dateKeys = () => [...new Set(shows.map((s) => toDateKey(s.start_time)))];
const $ = (id) => document.getElementById(id);

function loadingHtml() {
  return `<div class="container section" aria-hidden="true">
    <div class="skeleton" style="height: 18rem"></div>
    <div class="skeleton skeleton--line"></div><div class="skeleton skeleton--line skeleton--short"></div>
  </div>`;
}

async function load() {
  mount.innerHTML = loadingHtml();
  mount.setAttribute('aria-busy', 'true');
  try {
    [movie, shows] = await Promise.all([getMovie(movieId), getMovieShows(movieId)]);
    selectedDate = shows.length ? toDateKey(shows[0].start_time) : '';
    selectedShowId = null;
    render();
  } catch (err) {
    const missing = err instanceof ApiError && (err.status === 400 || err.status === 404);
    document.title = 'Movie not found | BOOK_MY_SEAT';
    mount.innerHTML = `<div class="container section">${missing
      ? stateHtml({ title: 'Movie not found', message: 'This movie does not exist, or the link is incorrect.', actionHref: `${root()}pages/movies.html`, actionLabel: 'Browse all movies' })
      : stateHtml({ title: 'Could not load this movie', message: 'Check your connection and try again.', retry: true })}</div>`;
  } finally {
    mount.removeAttribute('aria-busy');
  }
}

function render() {
  document.title = `${movie.title} | BOOK_MY_SEAT`;
  mount.innerHTML = `
    <section class="movie-hero">
      <div class="container movie-hero__grid">
        <div class="movie-hero__poster">${posterHtml(movie)}</div>
        <div>
          <nav class="breadcrumb" aria-label="Breadcrumb">
            <a href="${root()}pages/movies.html">Movies</a> / <span aria-current="page">${escapeHtml(movie.title)}</span>
          </nav>
          <h1>${escapeHtml(movie.title)}</h1>
          <ul class="meta-list">
            <li><span class="badge">${escapeHtml(movie.certificate)}</span></li>
            <li>${formatDuration(movie.duration_min)}</li>
            <li>${escapeHtml(movie.language)}</li>
            <li>Released ${formatReleaseDate(movie.release_date)}</li>
          </ul>
          <ul class="chip-list">${movie.genres.map((g) => `<li><span class="chip chip--static chip--on-dark">${escapeHtml(g)}</span></li>`).join('')}</ul>
          <p class="movie-hero__desc">${escapeHtml(movie.description)}</p>
        </div>
      </div>
    </section>
    <section class="section" aria-labelledby="shows-heading">
      <div class="container booking-layout">
        <div>
          <h2 id="shows-heading">Choose a date and showtime</h2>
          <div class="date-picker" id="date-picker" role="group" aria-label="Select a date"></div>
          <div id="show-list"></div>
        </div>
        <aside aria-label="Your selection"><div class="summary-card" id="summary" aria-live="polite"></div></aside>
      </div>
    </section>`;
  renderDates();
  renderShows();
  renderSummary();
}

function renderDates() {
  const todayKey = toDateKey(new Date());
  $('date-picker').innerHTML = dateKeys().map((key) => {
    const { weekday, dayMonth } = formatDateParts(`${key}T00:00:00`);
    return `<button type="button" class="date-btn" data-date="${key}" aria-pressed="${key === selectedDate}">
      <span class="date-btn__day">${key === todayKey ? 'Today' : weekday}</span>
      <span class="date-btn__num">${dayMonth}</span></button>`;
  }).join('');
}

function renderShows() {
  const list = $('show-list');
  if (!shows.length) {
    list.innerHTML = stateHtml({ title: 'No upcoming shows', message: 'There are no scheduled shows for this movie yet. Please check back later.' });
    return;
  }
  const byCinema = new Map();
  shows.filter((s) => toDateKey(s.start_time) === selectedDate).forEach((s) => {
    if (!byCinema.has(s.cinema.id)) byCinema.set(s.cinema.id, { cinema: s.cinema, items: [] });
    byCinema.get(s.cinema.id).items.push(s);
  });
  list.innerHTML = [...byCinema.values()].map(({ cinema, items }) => `
    <article class="cinema-block">
      <h3 class="cinema-block__name">${escapeHtml(cinema.name)}</h3>
      <p class="cinema-block__address">${escapeHtml(cinema.address)}, ${escapeHtml(cinema.city)}</p>
      <ul class="showtime-list">${items.map((s) => `
        <li><button type="button" class="showtime" data-show="${Number(s.id)}" aria-pressed="${s.id === selectedShowId}">
          <span class="showtime__time">${formatTime(s.start_time)}</span>
          <span class="showtime__price">from ${formatPrice(minPrice(s))}</span>
        </button></li>`).join('')}
      </ul>
    </article>`).join('');
}

function renderSummary() {
  const el = $('summary');
  const show = shows.find((s) => s.id === selectedShowId);
  if (!show) {
    el.innerHTML = '<h2 class="summary-card__title">Your selection</h2><p class="summary-card__empty">Pick a showtime to see the details and ticket prices.</p>';
    return;
  }
  el.innerHTML = `
    <h2 class="summary-card__title">Your selection</h2>
    <dl class="summary-list">
      <div><dt>Movie</dt><dd>${escapeHtml(movie.title)}</dd></div>
      <div><dt>Cinema</dt><dd>${escapeHtml(show.cinema.name)}</dd></div>
      <div><dt>Screen</dt><dd>${escapeHtml(show.screen.name)}</dd></div>
      <div><dt>Date</dt><dd>${formatLongDate(show.start_time)}</dd></div>
      <div><dt>Time</dt><dd>${formatTime(show.start_time)}</dd></div>
    </dl>
    <div class="price-block">
      <h3>Ticket prices</h3>
      <ul class="price-list">${Object.entries(show.prices).map(([cat, price]) =>
        `<li><span>${escapeHtml(categoryLabel(cat))}</span><strong>${formatPrice(price)}</strong></li>`).join('')}</ul>
    </div>
    <a class="btn btn--primary btn--block" href="${seatSelectionHref(show.id)}">Continue to seat selection</a>
    <p class="summary-card__note">Demo project: no real payment is taken.</p>`;
}

// Update pressed states in place (not by re-rendering) so keyboard focus stays on the button.
function syncDateButtons() {
  mount.querySelectorAll('.date-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.date === selectedDate)));
}
function syncShowButtons() {
  mount.querySelectorAll('.showtime').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.show) === selectedShowId)));
}

mount.addEventListener('click', (e) => {
  if (e.target.closest('[data-retry]')) { load(); return; }
  const dateBtn = e.target.closest('.date-btn');
  if (dateBtn) {
    selectedDate = dateBtn.dataset.date;
    selectedShowId = null;
    syncDateButtons();
    renderShows();
    renderSummary();
    return;
  }
  const showBtn = e.target.closest('.showtime');
  if (showBtn) {
    selectedShowId = Number(showBtn.dataset.show);
    syncShowButtons();
    renderSummary();
  }
});

load();
