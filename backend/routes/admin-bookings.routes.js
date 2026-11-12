const express = require('express');
const controller = require('../controllers/admin-bookings.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));
router.get('/bookings', controller.listBookings);
router.get('/bookings/:id', controller.getBooking);

module.exports = router;
