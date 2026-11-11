const express = require('express');
const seatController = require('../controllers/seat.controller');

const router = express.Router();

router.get('/:id/seats', seatController.getShowSeats);

module.exports = router;
