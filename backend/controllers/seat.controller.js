const seatService = require('../services/seat.service');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const { parseId } = require('../validators/params');

// GET /api/shows/:id/seats
async function getShowSeats(req, res) {
  const showId = parseId(req.params.id, 'show id');
  const result = await seatService.getShowSeatAvailability(showId);
  if (!result) throw new AppError(404, 'Show not found.');
  return sendSuccess(res, result);
}

module.exports = { getShowSeats };
