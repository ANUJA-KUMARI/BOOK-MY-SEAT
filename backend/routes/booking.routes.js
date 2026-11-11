const express = require('express');
const bookingController = require('../controllers/booking.controller');
const { authenticate } = require('../middleware/authenticate');
const { requireSameOrigin, requireCsrf } = require('../middleware/csrf');

const router = express.Router();

router.post('/', requireSameOrigin, authenticate, requireCsrf, bookingController.createBooking);

module.exports = router;
