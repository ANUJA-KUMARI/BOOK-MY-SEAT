const AppError = require('../utils/AppError');

// Unknown /api/... URL: send our JSON error format (handled by errorHandler).
function apiNotFound(req, res, next) {
  next(new AppError(404, 'API route not found.'));
}

// Any other unknown URL (not a frontend file either): plain 404.
function pageNotFound(req, res) {
  res.status(404).type('text/plain').send('Not found');
}

module.exports = { apiNotFound, pageNotFound };
