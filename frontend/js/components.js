// Shared UI pieces: header, footer, poster, movie card and state messages.
// Every value that comes from data goes through escapeHtml() before it enters an HTML string.

import { escapeHtml, formatDuration, root } from './utils.js';

const LOGO_SVG = '<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="8" fill="#7b1d36"/><path d="M10 6h12a2 2 0 0 1 2 2v11H8V8a2 2 0 0 1 2-2z" fill="#f6eee8"/><rect x="5" y="20" width="22" height="6" rx="2.5" fill="#ec6a7e"/></svg>';

export function renderHeader() {
  const el = document.getElementById('site-header');
  if (!el) return;
  const r = root();
  const active = document.body.dataset.nav;
  const links = [['home', 'index.html', 'Home'], ['movies', 'pages/movies.html', 'Movies']];

  el.innerHTML = `
    <div class="site-header__inner container">
      <a class="brand" href="${r}index.html" aria-label="BOOK_MY_SEAT home">
        ${LOGO_SVG}
        <span>BOOK<span class="brand__sep">_</span>MY<span class="brand__sep">_</span>SEAT</span>
      </a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav">
        <span class="sr-only">Menu</span><span class="nav-toggle__bar" aria-hidden="true"></span>
      </button>
      <nav id="primary-nav" class="site-nav" aria-label="Primary">
        <ul class="site-nav__list">
          ${links.map(([key, href, label]) =>
            `<li><a class="site-nav__link" href="${r}${href}"${key === active ? ' aria-current="page"' : ''}>${label}</a></li>`).join('')}
        </ul>
        <div class="site-nav__auth">
          <a class="btn btn--ghost btn--sm" href="${r}pages/login.html">Log in</a>
          <a class="btn btn--primary btn--sm" href="${r}pages/register.html">Register</a>
        </div>
      </nav>
    </div>`;

  const toggle = el.querySelector('.nav-toggle');
  const nav = el.querySelector('#primary-nav');
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
}

export function renderFooter() {
  const el = document.getElementById('site-footer');
  if (!el) return;
  const r = root();
  el.innerHTML = `
    <div class="container site-footer__grid">
      <div>
        <span class="site-footer__brand">BOOK_MY_SEAT</span>
        <p>An academic Full Stack Development project. No real payments are taken, and it is not affiliated with any ticketing company. Movies and cinemas shown are sample data.</p>
      </div>
      <nav class="site-footer__links" aria-label="Footer">
        <a href="${r}index.html">Home</a>
        <a href="${r}pages/movies.html">Movies</a>
      </nav>
    </div>
    <div class="container"><p>&copy; ${new Date().getFullYear()} BOOK_MY_SEAT</p></div>`;
}

/** Remove a poster image that fails to load, so the styled fallback underneath shows instead. */
function registerImageFallback() {
  // "error" events do not bubble, so listen in the capture phase on the document.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img instanceof HTMLImageElement && img.classList.contains('poster__img')) img.remove();
  }, true);
}

export function initCommon() {
  registerImageFallback();
  renderHeader();
  renderFooter();
}

/** Poster: gradient + title always rendered; the real image (if any) covers them and is removed if it fails. */
export function posterHtml(movie, { decorative = false } = {}) {
  const variant = (Number(movie.id) % 6) + 1;
  const alt = decorative ? '' : `${escapeHtml(movie.title)} poster`;
  const img = movie.poster_url
    ? `<img class="poster__img" src="${escapeHtml(movie.poster_url)}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer">`
    : '';
  return `<div class="poster poster--v${variant}">
      <span class="poster__fallback" aria-hidden="true">${escapeHtml(movie.title)}</span>
      ${img}
      <span class="poster__cert">${escapeHtml(movie.certificate)}</span>
    </div>`;
}

export function movieCardHtml(movie) {
  return `<article class="movie-card">
    <a class="movie-card__link" href="${root()}pages/movie.html?id=${Number(movie.id)}">
      ${posterHtml(movie, { decorative: true })}
      <div class="movie-card__body">
        <h3 class="movie-card__title">${escapeHtml(movie.title)}</h3>
        <p class="movie-card__meta"><span>${escapeHtml(movie.language)}</span><span>${formatDuration(movie.duration_min)}</span></p>
        <p class="movie-card__genres">${movie.genres.map((g) => escapeHtml(g)).join(', ')}</p>
      </div>
    </a>
  </article>`;
}

export function skeletonCards(count) {
  return Array.from({ length: count }, () => `<div class="movie-card" aria-hidden="true">
      <div class="skeleton skeleton--poster"></div>
      <div class="skeleton skeleton--line"></div>
      <div class="skeleton skeleton--line skeleton--short"></div>
    </div>`).join('');
}

/** Empty / error message block. Pass retry:true to render a button the page can wire to [data-retry]. */
export function stateHtml({ title, message, actionHref = '', actionLabel = '', retry = false }) {
  const action = actionHref
    ? `<a class="btn btn--primary" href="${escapeHtml(actionHref)}">${escapeHtml(actionLabel)}</a>`
    : retry ? '<button class="btn btn--primary" type="button" data-retry>Try again</button>' : '';
  return `<div class="state" role="status"><h2 class="state__title">${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${action}</div>`;
}
