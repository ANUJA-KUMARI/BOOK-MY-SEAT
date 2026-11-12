import {
  getCurrentUser, logoutUser, ApiError, getAdminMovies, getAdminGenres,
  createAdminMovie, updateAdminMovie, setAdminMovieActive,
  createAdminGenre, updateAdminGenre, deleteAdminGenre,
} from '../js/api.js';

const $ = (selector) => document.querySelector(selector);
const pageMessage = $('#page-message');
const userSlot = $('#admin-user');
const logoutButton = $('#admin-logout');
const movieForm = $('#movie-form');
const genreForm = $('#genre-form');
const movieBody = $('#movie-table-body');
const genreList = $('#genre-list');
const genreOptions = $('#movie-genre-options');
let genres = [];
let movies = [];

function message(text, isError = false) {
  pageMessage.textContent = text;
  pageMessage.hidden = false;
  pageMessage.classList.toggle('admin-message--error', isError);
  pageMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(label, action, className = 'catalog-small-btn') {
  const node = make('button', className, label);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
async function protectPage() {
  try {
    const user = await getCurrentUser();
    if (!user) { window.location.replace('../pages/login.html'); return false; }
    if (user.role !== 'ADMIN') { window.location.replace('../index.html'); return false; }
    userSlot.textContent = 'Signed in as ' + user.name + ' · Administrator';
    return true;
  } catch (error) {
    userSlot.textContent = 'Administrator session could not be verified.';
    message(error.message || 'Could not verify your session.', true);
    logoutButton.disabled = true;
    return false;
  }
}
function renderGenreOptions(selected = []) {
  genreOptions.replaceChildren();
  if (!genres.length) { genreOptions.append(make('p', '', 'No genres yet. Add one using the Genre Library.')); return; }
  for (const genre of genres) {
    const label = make('label', 'genre-option');
    const input = make('input');
    input.type = 'checkbox'; input.name = 'genre_ids'; input.value = String(genre.id);
    input.checked = selected.includes(genre.id);
    label.append(input, document.createTextNode(genre.name));
    genreOptions.append(label);
  }
}
function renderGenres() {
  genreList.replaceChildren();
  if (!genres.length) { genreList.append(make('li', '', 'No genres have been created yet.')); return; }
  for (const genre of genres) {
    const item = make('li');
    const info = make('div');
    info.append(make('span', 'genre-list__name', genre.name));
    info.append(make('span', 'genre-list__meta', genre.movie_count + ' linked movie(s)'));
    const actions = make('div', 'genre-list__actions');
    actions.append(button('Rename', async () => {
      const name = window.prompt('Enter the new genre name:', genre.name);
      if (name === null) return;
      try { await updateAdminGenre(genre.id, name); await loadGenres(); message('Genre renamed successfully.'); }
      catch (error) { message(error.message, true); }
    }));
    const remove = button('Remove', async () => {
      if (!window.confirm('Remove the genre "' + genre.name + '"?')) return;
      try { await deleteAdminGenre(genre.id); await loadGenres(); message('Genre removed.'); }
      catch (error) { message(error.message, true); }
    });
    remove.disabled = genre.movie_count > 0;
    remove.title = remove.disabled ? 'Unassign this genre from all movies first.' : 'Remove genre';
    actions.append(remove);
    item.append(info, actions);
    genreList.append(item);
  }
}
function resetMovieForm() {
  movieForm.reset();
  movieForm.elements.movie_id.value = '';
  $('#movie-form-title').textContent = 'Add a movie';
  $('#save-movie').textContent = 'Save movie';
  renderGenreOptions();
}
function editMovie(movie) {
  movieForm.elements.movie_id.value = String(movie.id);
  movieForm.elements.title.value = movie.title;
  movieForm.elements.description.value = movie.description;
  movieForm.elements.language.value = movie.language;
  movieForm.elements.duration_min.value = String(movie.duration_min);
  movieForm.elements.certificate.value = movie.certificate;
  movieForm.elements.release_date.value = movie.release_date ? String(movie.release_date).slice(0, 10) : '';
  movieForm.elements.poster_url.value = movie.poster_url;
  const selected = genres.filter((genre) => movie.genres.includes(genre.name)).map((genre) => genre.id);
  renderGenreOptions(selected);
  $('#movie-form-title').textContent = 'Edit movie · ' + movie.title;
  $('#save-movie').textContent = 'Save changes';
  movieForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderMovies() {
  movieBody.replaceChildren();
  $('#movie-count').textContent = movies.length + ' record(s)';
  if (!movies.length) {
    const row = make('tr'); const cell = make('td', 'empty-row', 'No movies match these filters.');
    cell.colSpan = 6; row.append(cell); movieBody.append(row); return;
  }
  for (const movie of movies) {
    const row = make('tr');
    const title = make('td'); title.append(make('span', 'movie-table__title', movie.title));
    title.append(make('span', 'movie-table__sub', 'ID #' + movie.id));
    const language = make('td', '', movie.language || '—');
    const duration = make('td', '', movie.duration_min + ' min');
    const movieGenres = make('td', 'movie-table__genres', movie.genres.join(', ') || '—');
    const statusCell = make('td');
    statusCell.append(make('span', 'movie-status ' + (movie.is_active ? 'movie-status--active' : 'movie-status--inactive'), movie.is_active ? 'Active' : 'Inactive'));
    const actions = make('td'); const actionWrap = make('div', 'movie-actions');
    actionWrap.append(button('Edit', () => editMovie(movie)));
    actionWrap.append(button(movie.is_active ? 'Deactivate' : 'Activate', async () => {
      const verb = movie.is_active ? 'deactivate' : 'activate';
      if (!window.confirm('Are you sure you want to ' + verb + ' "' + movie.title + '"?')) return;
      try {
        await setAdminMovieActive(movie.id, !movie.is_active);
        await loadMovies(); message('Movie ' + (movie.is_active ? 'deactivated' : 'activated') + ' successfully.');
      } catch (error) { message(error.message, true); }
    }));
    actions.append(actionWrap);
    row.append(title, language, duration, movieGenres, statusCell, actions);
    movieBody.append(row);
  }
}
async function loadGenres() {
  genres = await getAdminGenres();
  renderGenres(); renderGenreOptions();
}
async function loadMovies() {
  movies = await getAdminMovies({ search: $('#movie-search').value, status: $('#movie-status').value });
  renderMovies();
}
movieForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(movieForm);
  const genreIds = [...movieForm.querySelectorAll('input[name="genre_ids"]:checked')].map((input) => Number(input.value));
  const payload = {
    title: String(form.get('title') || '').trim(),
    description: String(form.get('description') || '').trim(),
    language: String(form.get('language') || '').trim(),
    duration_min: Number(form.get('duration_min')),
    certificate: String(form.get('certificate') || '').trim(),
    release_date: String(form.get('release_date') || ''),
    poster_url: String(form.get('poster_url') || '').trim(),
    genre_ids: genreIds,
  };
  const id = movieForm.elements.movie_id.value;
  const save = $('#save-movie'); save.disabled = true;
  try {
    if (id) await updateAdminMovie(Number(id), payload);
    else await createAdminMovie(payload);
    resetMovieForm(); await loadMovies();
    message(id ? 'Movie updated successfully.' : 'Movie added successfully.');
  } catch (error) { message(error.message, true); }
  finally { save.disabled = false; }
});
genreForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = String(new FormData(genreForm).get('name') || '').trim();
  const submit = genreForm.querySelector('button'); submit.disabled = true;
  try { await createAdminGenre(name); genreForm.reset(); await loadGenres(); message('Genre added successfully.'); }
  catch (error) { message(error.message, true); }
  finally { submit.disabled = false; }
});
$('#reset-movie-form').addEventListener('click', resetMovieForm);
$('#movie-status').addEventListener('change', () => loadMovies().catch((error) => message(error.message, true)));
let searchTimer;
$('#movie-search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadMovies().catch((error) => message(error.message, true)), 250);
});
logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try { await logoutUser(); window.location.replace('../pages/login.html'); }
  catch (error) { message(error.message || 'Logout failed.', true); logoutButton.disabled = false; }
});

(async function init() {
  if (!(await protectPage())) return;
  try { await Promise.all([loadGenres(), loadMovies()]); }
  catch (error) { message(error.message || 'Could not load catalogue data.', true); }
})();
