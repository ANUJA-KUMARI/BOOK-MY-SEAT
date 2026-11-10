import { initCommon, movieCardHtml, skeletonCards, stateHtml } from '../components.js';
import { getMovies } from '../api.js';
import { debounce, escapeHtml } from '../utils.js';

initCommon();

const els = {
  form: document.getElementById('filters'),
  search: document.getElementById('search'),
  language: document.getElementById('language'),
  genres: document.getElementById('genre-chips'),
  clear: document.getElementById('clear-filters'),
  count: document.getElementById('results-count'),
  grid: document.getElementById('movie-grid'),
};

const state = { search: '', genre: '', language: '' };
let latestRequest = 0; // lets us ignore slow responses that arrive after a newer search

function readUrl() {
  const params = new URLSearchParams(window.location.search);
  state.search = params.get('search') || '';
  state.genre = params.get('genre') || '';
  state.language = params.get('language') || '';
}

function writeUrl() {
  const params = new URLSearchParams();
  Object.entries(state).forEach(([key, value]) => { if (value) params.set(key, value); });
  const qs = params.toString();
  history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
}

function syncControls() {
  els.search.value = state.search;
  els.language.value = state.language;
  els.genres.querySelectorAll('[data-genre]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.genre.toLowerCase() === state.genre.toLowerCase()));
  });
}

function renderFacets(allMovies) {
  const genres = [...new Set(allMovies.flatMap((m) => m.genres))].sort();
  const languages = [...new Set(allMovies.map((m) => m.language))].sort();
  els.language.innerHTML = '<option value="">All languages</option>'
    + languages.map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
  els.genres.innerHTML = ['', ...genres].map((g) =>
    `<button type="button" class="chip" data-genre="${escapeHtml(g)}" aria-pressed="false">${g ? escapeHtml(g) : 'All genres'}</button>`).join('');
  syncControls();
}

async function runSearch() {
  const requestId = ++latestRequest;
  writeUrl();
  els.grid.setAttribute('aria-busy', 'true');
  if (!els.grid.querySelector('.movie-card')) els.grid.innerHTML = skeletonCards(8);
  try {
    const movies = await getMovies(state);
    if (requestId !== latestRequest) return;
    els.count.textContent = movies.length === 1 ? '1 movie found' : `${movies.length} movies found`;
    els.grid.innerHTML = movies.length
      ? movies.map((m) => movieCardHtml(m)).join('')
      : stateHtml({ title: 'No movies match your filters', message: 'Try a different title, or clear the filters to see everything that is playing.' });
  } catch (err) {
    if (requestId !== latestRequest) return;
    els.count.textContent = '';
    els.grid.innerHTML = stateHtml({ title: 'Could not load movies', message: 'Check your connection and try again.', retry: true });
  } finally {
    if (requestId === latestRequest) els.grid.removeAttribute('aria-busy');
  }
}

function update(changes) {
  Object.assign(state, changes);
  syncControls();
  runSearch();
}

els.form.addEventListener('submit', (e) => e.preventDefault());
els.search.addEventListener('input', debounce(() => update({ search: els.search.value }), 250));
els.language.addEventListener('change', () => update({ language: els.language.value }));
els.genres.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-genre]');
  if (btn) update({ genre: btn.dataset.genre });
});
els.clear.addEventListener('click', () => update({ search: '', genre: '', language: '' }));
els.grid.addEventListener('click', (e) => { if (e.target.closest('[data-retry]')) runSearch(); });

async function init() {
  readUrl();
  try { renderFacets(await getMovies()); } catch { /* runSearch below shows the error */ }
  syncControls();
  runSearch();
}
init();
