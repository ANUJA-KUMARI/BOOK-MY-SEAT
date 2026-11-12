// Role-based authorization for routes that require a specific account role.
const AppError = require('../utils/AppError');

function authorize(...allowedRoles) {
  return function authorizeRole(req, res, next) {
    if (!req.auth) return next(new AppError(401, 'Authentication is required.'));
    if (!allowedRoles.includes(req.auth.role)) {
      return next(new AppError(403, 'You do not have permission to perform this action.'));
    }
    return next();
  };
}

module.exports = authorize;
