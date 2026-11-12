const AppError = require('../utils/AppError');
function text(value, field, max, required = true) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw new AppError(400, field + ' must be text.');
  const clean = value.trim();
  if (required && !clean) throw new AppError(400, field + ' is required.');
  if (clean.length > max) throw new AppError(400, field + ' must be at most ' + max + ' characters.');
  return clean || null;
}
function cinemaInput(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400, 'A JSON object is required.');
  const out = {};
  for (const [key, max] of [['name',180],['city',100],['address',500]]) {
    if (!partial || Object.hasOwn(body,key)) out[key] = text(body[key],key,max);
  }
  return out;
}
function screenInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400, 'A JSON object is required.');
  return { name: text(body.name,'name',80) };
}
function seatLayoutInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray(body.rows)) throw new AppError(400,'rows must be an array.');
  if (!body.rows.length || body.rows.length > 20) throw new AppError(400,'A layout must contain between 1 and 20 rows.');
  const rows = body.rows.map((row) => {
    if (!row || typeof row.label !== 'string' || !/^[A-Z0-9]{1,5}$/.test(row.label)) throw new AppError(400,'Each row needs a 1–5 character uppercase label.');
    if (!Number.isInteger(row.count) || row.count < 1 || row.count > 30) throw new AppError(400,'Each row must contain between 1 and 30 seats.');
    if (!['STANDARD','PREMIUM','RECLINER'].includes(row.category)) throw new AppError(400,'Seat category must be STANDARD, PREMIUM or RECLINER.');
    return { label: row.label, count: row.count, category: row.category };
  });
  if (new Set(rows.map((r) => r.label)).size !== rows.length) throw new AppError(400,'Row labels must be unique.');
  if (rows.reduce((sum,r) => sum+r.count,0) > 300) throw new AppError(400,'A screen cannot have more than 300 seats.');
  return rows;
}
module.exports = { cinemaInput, screenInput, seatLayoutInput };
