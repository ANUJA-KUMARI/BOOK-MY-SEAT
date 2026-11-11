const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const { requireSameOrigin, requireCsrf } = require('../middleware/csrf');
const { registrationLimiter, loginLimiter } = require('../middleware/auth-rate-limit');

const router = express.Router();

router.post('/register', requireSameOrigin, registrationLimiter, authController.register);
router.post('/login', requireSameOrigin, loginLimiter, authController.login);
router.get('/me', authenticate, authController.currentUser);
router.post('/logout', requireSameOrigin, authenticate, requireCsrf, authController.logout);

module.exports = router;
