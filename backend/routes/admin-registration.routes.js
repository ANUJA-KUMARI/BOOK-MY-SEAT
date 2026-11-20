const express = require('express');
const controller = require('../controllers/admin-registration.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { requireSameOrigin, requireCsrf } = require('../middleware/csrf');
const { registrationLimiter, loginLimiter } = require('../middleware/auth-rate-limit');

const router = express.Router();
router.post('/register', requireSameOrigin, registrationLimiter, controller.register);
router.post('/login', requireSameOrigin, loginLimiter, controller.login);
router.use(authenticate, authorize('ADMIN'));
router.post('/invitations', requireSameOrigin, requireCsrf, controller.createInvitation);
router.get('/applications', controller.listApplications);
router.patch('/applications/:userId', requireSameOrigin, requireCsrf, controller.decideApplication);
module.exports = router;
