const express = require('express');
const bookingController = require('../controllers/booking.controller');
const authenticate = require('../middleware/authenticate');
const { requireSameOrigin, requireCsrf } = require('../middleware/csrf');

const router = express.Router();

router.get('/', authenticate, bookingController.listBookings);
router.get('/:id', authenticate, bookingController.getBooking);
router.delete('/:id', requireSameOrigin, authenticate, requireCsrf, bookingController.cancelBooking);
router.post('/', requireSameOrigin, authenticate, requireCsrf, bookingController.createBooking);

module.exports = router;
