const AppError = require('../utils/AppError');

function requiredText(value, field, maxLength) {
  if (typeof value !== 'string') throw new AppError(400, field + ' is required.');
  const clean = value.trim();
  if (!clean) throw new AppError(400, field + ' is required.');
  if (clean.length > maxLength) throw new AppError(400, field + ' must be at most ' + maxLength + ' characters.');
  return clean;
}
function optionalText(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new AppError(400, field + ' must be text.');
  const clean = value.trim();
  if (clean.length > maxLength) throw new AppError(400, field + ' must be at most ' + maxLength + ' characters.');
  return clean || null;
}
function optionalDate(value, field = 'release_date') {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError(400, field + ' must use YYYY-MM-DD format.');
  const parts = value.split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (date.getUTCFullYear() !== parts[0] || date.getUTCMonth() !== parts[1] - 1 || date.getUTCDate() !== parts[2]) {
    throw new AppError(400, field + ' must be a real calendar date.');
  }
  return value;
}
function optionalUrl(value, field = 'poster_url') {
  const clean = optionalText(value, field, 1000);
  if (clean === null) return null;
  let parsed;
  try { parsed = new URL(clean); } catch { throw new AppError(400, field + ' must be a valid HTTP or HTTPS URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new AppError(400, field + ' must be a valid HTTP or HTTPS URL.');
  }
  return clean;
}
function genreIds(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 20) throw new AppError(400, 'genre_ids must be an array of at most 20 genre IDs.');
  const ids = value.map((id) => {
    if (!Number.isSafeInteger(id) || id < 1) throw new AppError(400, 'genre_ids must contain positive whole-number IDs.');
    return id;
  });
  if (new Set(ids).size !== ids.length) throw new AppError(400, 'genre_ids cannot contain duplicate IDs.');
  return ids;
}
function movieInput(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400, 'A JSON object is required.');
  const result = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
  if (!partial || has('title')) result.title = requiredText(body.title, 'title', 200);
  if (!partial || has('description')) result.description = optionalText(body.description, 'description', 10000);
  if (!partial || has('language')) result.language = optionalText(body.language, 'language', 80);
  if (!partial || has('duration_min')) {
    if (!Number.isInteger(body.duration_min) || body.duration_min < 1 || body.duration_min > 600) throw new AppError(400, 'duration_min must be a whole number between 1 and 600.');
    result.duration_min = body.duration_min;
  }
  if (!partial || has('certificate')) result.certificate = optionalText(body.certificate, 'certificate', 20);
  if (!partial || has('release_date')) result.release_date = optionalDate(body.release_date);
  if (!partial || has('poster_url')) result.poster_url = optionalUrl(body.poster_url);
  const ids = genreIds(body.genre_ids);
  if (ids !== undefined) result.genre_ids = ids;
  return result;
}
function genreInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400, 'A JSON object is required.');
  return { name: requiredText(body.name, 'name', 80) };
}
module.exports = { movieInput, genreInput };
