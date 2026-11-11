// Every API route is mounted here under /api (see app.js).
// Auth, bookings and seat availability routes are added in their respective phases.

const express = require('express');
const healthController = require('../controllers/health.controller');
const movieRoutes = require('./movie.routes');
const authRoutes = require('./auth.routes');
const seatRoutes = require('./seat.routes');
const bookingRoutes = require('./booking.routes');

const router = express.Router();

router.get('/health', healthController.check);
router.use('/movies', movieRoutes);
router.use('/auth', authRoutes);
router.use('/shows', seatRoutes);
router.use('/bookings', bookingRoutes);

module.exports = router;
