// One place that defines the success response shape: { "success": true, "data": ... }
// (errors use { "success": false, "error": { "message": ... } } and are produced by middleware/errorHandler.js)

function sendSuccess(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

module.exports = { sendSuccess };
