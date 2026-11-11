const bookingService = require('../services/booking.service');
const { validateCreateBooking } = require('../validators/booking');
const { sendSuccess } = require('../utils/response');

async function createBooking(req, res) {
  const input = validateCreateBooking(req.body);
  const booking = await bookingService.createBooking({
    userId: req.auth.id,
    ...input,
  });
  return sendSuccess(res, { booking }, 201);
}

module.exports = { createBooking };
