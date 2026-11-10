const { sendSuccess } = require('../utils/response');

// GET /api/health: lets you (and later a monitor) check that the server is running.
function check(req, res) {
  sendSuccess(res, {
    status: 'ok',
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

module.exports = { check };
