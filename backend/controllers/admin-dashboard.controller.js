const service = require('../services/admin-dashboard.service');
const { sendSuccess } = require('../utils/response');

async function getSummary(req, res) {
  return sendSuccess(res, await service.getDashboardSummary());
}

module.exports = { getSummary };
