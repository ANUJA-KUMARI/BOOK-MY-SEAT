const express = require('express');
const movieController = require('../controllers/movie.controller');

const router = express.Router();

router.get('/', movieController.listMovies);
router.get('/:id', movieController.getMovie);
router.get('/:id/shows', movieController.listMovieShows);

module.exports = router;
