// Every API route is mounted here under /api (see app.js).
// Auth, bookings and seat availability routes are added in later phases.

const express = require('express');
const healthController = require('../controllers/health.controller');
const movieRoutes = require('./movie.routes');

const router = express.Router();

router.get('/health', healthController.check);
router.use('/movies', movieRoutes);

module.exports = router;
