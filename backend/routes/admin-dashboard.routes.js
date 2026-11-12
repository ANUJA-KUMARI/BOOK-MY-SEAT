const express = require('express');
const controller = require('../controllers/admin-dashboard.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));
router.get('/dashboard', controller.getSummary);

module.exports = router;
