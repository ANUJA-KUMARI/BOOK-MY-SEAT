const service = require('../services/admin-bookings.service');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const { parseId, parseOptionalText } = require('../validators/params');

function parsePage(value, name, fallback, maximum) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > maximum) {
    throw new AppError(400, name + ' must be a whole number between 1 and ' + maximum + '.');
  }
  return Number(value);
}

async function listBookings(req, res) {
  const search = parseOptionalText(req.query.search, 'search', 100);
  const status = req.query.status === undefined ? 'all' : req.query.status;
  if (!['all', 'CONFIRMED', 'CANCELLED'].includes(status)) {
    throw new AppError(400, 'status must be all, CONFIRMED or CANCELLED.');
  }
  const page = parsePage(req.query.page, 'page', 1, 1000000);
  const limit = parsePage(req.query.limit, 'limit', 20, 50);
  return sendSuccess(res, await service.listBookings({ search, status, page, limit }));
}

async function getBooking(req, res) {
  const booking = await service.getBookingById(parseId(req.params.id, 'booking id'));
  if (!booking) throw new AppError(404, 'Booking not found.');
  return sendSuccess(res, { booking });
}

module.exports = { listBookings, getBooking, _internals: { parsePage } };
