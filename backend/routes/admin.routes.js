const express = require('express');
const controller = require('../controllers/admin-catalog.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { requireSameOrigin, requireCsrf } = require('../middleware/csrf');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

router.get('/movies', controller.listMovies);
router.post('/movies', requireSameOrigin, requireCsrf, controller.createMovie);
router.patch('/movies/:id', requireSameOrigin, requireCsrf, controller.updateMovie);
router.patch('/movies/:id/status', requireSameOrigin, requireCsrf, controller.setMovieActive);
router.get('/genres', controller.listGenres);
router.post('/genres', requireSameOrigin, requireCsrf, controller.createGenre);
router.patch('/genres/:id', requireSameOrigin, requireCsrf, controller.updateGenre);
router.delete('/genres/:id', requireSameOrigin, requireCsrf, controller.deleteGenre);
module.exports = router;
