const bookingService = require('../services/booking.service');
const bookingReadService = require('../services/booking-read.service');
const { validateCreateBooking } = require('../validators/booking');
const { parseId } = require('../validators/params');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');

async function createBooking(req, res) {
  const input = validateCreateBooking(req.body);
  const booking = await bookingService.createBooking({
    userId: req.auth.id,
    ...input,
  });
  return sendSuccess(res, { booking }, 201);
}

async function listBookings(req, res) {
  const page = parsePage(req.query.page, 'page', 1, 1000000);
  const limit = parsePage(req.query.limit, 'limit', 20, 50);
  const result = await bookingReadService.listUserBookings(req.auth.id, { page, limit });
  return sendSuccess(res, result);
}

async function getBooking(req, res) {
  const bookingId = parseId(req.params.id, 'booking id');
  const booking = await bookingReadService.getUserBookingById(req.auth.id, bookingId);
  if (!booking) throw new AppError(404, 'Booking not found.');
  return sendSuccess(res, { booking });
}

function parsePage(value, name, fallback, maximum) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > maximum) {
    throw new AppError(400, `${name} must be a whole number between 1 and ${maximum}.`);
  }
  return Number(value);
}

module.exports = { createBooking, listBookings, getBooking };
