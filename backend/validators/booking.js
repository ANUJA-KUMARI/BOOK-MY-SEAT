const AppError = require('../utils/AppError');

function validateCreateBooking(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError(400, 'A valid booking request is required.');
  }
  const { showId, seatIds } = input;
  if (!Number.isSafeInteger(showId) || showId < 1) {
    throw new AppError(400, 'showId must be a positive whole number.');
  }
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    throw new AppError(400, 'Select at least one seat.');
  }
  if (seatIds.length > 6) throw new AppError(400, 'You can book a maximum of 6 seats per booking.');
  if (seatIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    throw new AppError(400, 'Every seat ID must be a positive whole number.');
  }
  if (new Set(seatIds).size !== seatIds.length) {
    throw new AppError(400, 'Duplicate seat IDs are not allowed.');
  }
  return { showId, seatIds: [...seatIds].sort((a, b) => a - b) };
}

module.exports = { validateCreateBooking };
