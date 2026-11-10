// Builds the Express application (without starting it, so tests can start it on any port).
// Request flow:  security headers -> logger -> JSON body parser -> /api routes -> frontend files -> 404 -> error handler

const express = require('express');
const helmet = require('helmet');
const { config } = require('./config/env');
const apiRoutes = require('./routes');
const requestLogger = require('./middleware/requestLogger');
const { apiNotFound, pageNotFound } = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Secure HTTP headers. The frontend loads Google Fonts and may show poster images from https URLs, so image
// sources allow https. "upgrade-insecure-requests" is switched off because it breaks plain http://localhost.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'img-src': ["'self'", 'data:', 'https:'],
      'upgrade-insecure-requests': null,
    },
  },
}));

if (!config.isTest) app.use(requestLogger);

app.use(express.json({ limit: '10kb' }));

app.use('/api', apiRoutes);
app.use('/api', apiNotFound);

// Single-origin design: Express also serves the frontend folder, so the browser talks to one address.
app.use(express.static(config.frontendDir));
app.use(pageNotFound);

app.use(errorHandler);

module.exports = app;
