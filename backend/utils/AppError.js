// An error we throw on purpose, with the HTTP status the client should receive.
// Anything that is NOT an AppError is treated as an unexpected bug (500) by the error handler.

class AppError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }
}

module.exports = AppError;
