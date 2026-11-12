process.env.NODE_ENV = 'test';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { movieInput, genreInput } = require('../validators/admin');

describe('Phase 8 admin catalogue validation', () => {
  it('normalizes a complete movie payload and genre IDs', () => {
    const movie = movieInput({
      title: '  Interstellar  ', description: '', language: 'English', duration_min: 169,
      certificate: 'UA', release_date: '2014-11-07', poster_url: 'https://example.com/poster.jpg', genre_ids: [1, 3],
    });
    assert.deepEqual(movie, {
      title: 'Interstellar', description: null, language: 'English', duration_min: 169,
      certificate: 'UA', release_date: '2014-11-07', poster_url: 'https://example.com/poster.jpg', genre_ids: [1, 3],
    });
  });
  it('supports partial movie updates without requiring untouched fields', () => {
    assert.deepEqual(movieInput({ title: 'Updated title' }, { partial: true }), { title: 'Updated title' });
  });
  it('rejects missing title, invalid duration and impossible dates', () => {
    assert.throws(() => movieInput({ duration_min: 100 }), /title is required/i);
    assert.throws(() => movieInput({ title: 'Film', duration_min: '120' }), /duration_min/i);
    assert.throws(() => movieInput({ title: 'Film', duration_min: 120, release_date: '2026-02-31' }), /real calendar date/i);
  });
  it('rejects unsafe poster URLs and duplicate or invalid genre IDs', () => {
    assert.throws(() => movieInput({ title: 'Film', duration_min: 120, poster_url: 'javascript:alert(1)' }), /HTTP or HTTPS/i);
    assert.throws(() => movieInput({ title: 'Film', duration_min: 120, genre_ids: [1, 1] }), /duplicate/i);
    assert.throws(() => movieInput({ title: 'Film', duration_min: 120, genre_ids: ['2'] }), /positive whole-number/i);
  });
  it('trims genre names and rejects blank or oversized names', () => {
    assert.deepEqual(genreInput({ name: '  Sci-Fi  ' }), { name: 'Sci-Fi' });
    assert.throws(() => genreInput({ name: '   ' }), /name is required/i);
    assert.throws(() => genreInput({ name: 'x'.repeat(81) }), /80 characters/i);
  });
});
