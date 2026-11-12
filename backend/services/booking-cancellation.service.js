// Transactional cancellation for an authenticated booking owner.
const { getPool, toDatabaseError } = require('../config/db');
const AppError = require('../utils/AppError');
const { toIsoUtc } = require('../utils/time');

const CANCELLATION_CUTOFF_HOURS = 2;

async function cancelUserBooking(userId, bookingId) {
  const pool = getPool();
  let connection;
  let transactionStarted = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // Lock the owner's booking first. A concurrent cancellation waits here and then
    // observes CANCELLED instead of releasing the same seats twice.
    const [rows] = await connection.execute(
      `SELECT b.id, b.status, s.start_time,
              (s.start_time <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 2 HOUR)) AS cutoff_passed
       FROM bookings b
       JOIN shows s ON s.id = b.show_id
       WHERE b.id = ? AND b.user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [bookingId, userId],
    );

    if (rows.length === 0) {
      throw new AppError(404, 'Booking not found.');
    }
    const booking = rows[0];
    if (booking.status !== 'CONFIRMED') {
      throw new AppError(409, 'Only confirmed bookings can be cancelled.');
    }
    if (Number(booking.cutoff_passed) === 1) {
      throw new AppError(409, 'Bookings can only be cancelled more than 2 hours before showtime.');
    }

    const [bookingUpdate] = await connection.execute(
      `UPDATE bookings
       SET status = 'CANCELLED', cancelled_at = UTC_TIMESTAMP()
       WHERE id = ? AND user_id = ? AND status = 'CONFIRMED'`,
      [bookingId, userId],
    );
    if (bookingUpdate.affectedRows !== 1) {
      throw new AppError(409, 'This booking can no longer be cancelled.');
    }

    const [seatUpdate] = await connection.execute(
      'UPDATE booking_seats SET active = NULL WHERE booking_id = ? AND active = 1',
      [bookingId],
    );

    await connection.commit();
    transactionStarted = false;

    return {
      id: Number(booking.id),
      status: 'CANCELLED',
      cancelled_at: toIsoUtc(new Date()),
      released_seats: Number(seatUpdate.affectedRows),
    };
  } catch (error) {
    if (transactionStarted && connection) {
      try { await connection.rollback(); } catch { /* preserve original error */ }
    }
    if (error instanceof AppError) throw error;
    throw toDatabaseError(error);
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  cancelUserBooking,
  _internals: { CANCELLATION_CUTOFF_HOURS },
};
