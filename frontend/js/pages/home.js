import { initCommon, movieCardHtml, skeletonCards, stateHtml } from '../components.js';
import { getMovies } from '../api.js';
import { escapeHtml, root } from '../utils.js';

initCommon();

const grid = document.getElementById('featured-grid');
const genreList = document.getElementById('genre-links');

// Decorative mini seat map in the hero (same .seat classes the seat selection page will reuse).
const seatMap = document.getElementById('hero-seats');
if (seatMap) {
  let html = '';
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const picked = row === 3 && (col === 3 || col === 4);
      const taken = !picked && (row * 3 + col * 5) % 7 < 2;
      html += `<span class="seat${picked ? ' seat--picked' : taken ? ' seat--taken' : ''}"></span>`;
    }
  }
  seatMap.innerHTML = html;
}

async function load() {
  grid.innerHTML = skeletonCards(4);
  grid.setAttribute('aria-busy', 'true');
  try {
    const movies = await getMovies();
    // "Featured" = the four most recent releases.
    const featured = [...movies].sort((a, b) => b.release_date.localeCompare(a.release_date)).slice(0, 4);
    grid.innerHTML = featured.map((m) => movieCardHtml(m)).join('');

    const genres = [...new Set(movies.flatMap((m) => m.genres))].sort();
    genreList.innerHTML = genres.map((g) =>
      `<li><a class="chip" href="${root()}pages/movies.html?genre=${encodeURIComponent(g)}">${escapeHtml(g)}</a></li>`).join('');
  } catch (err) {
    grid.innerHTML = stateHtml({ title: 'Could not load movies', message: 'Check your connection and try again.', retry: true });
  } finally {
    grid.removeAttribute('aria-busy');
  }
}

grid.addEventListener('click', (e) => { if (e.target.closest('[data-retry]')) load(); });
load();
