// Transactional cancellation for an authenticated booking owner.
const { getPool, toDatabaseError } = require('../config/db');
const AppError = require('../utils/AppError');
const { toIsoUtc } = require('../utils/time');

const CANCELLATION_CUTOFF_HOURS = 2;

function assertCancellationAllowed(status, cutoffPassed) {
  if (!['CONFIRMED', 'PENDING'].includes(status)) {
    throw new AppError(409, 'Only pending or confirmed bookings can be cancelled.');
  }
  if (status === 'CONFIRMED' && cutoffPassed) {
    throw new AppError(409, 'Bookings can only be cancelled more than 2 hours before showtime.');
  }
}

async function cancelUserBooking(userId, bookingId) {
  const pool = getPool();
  let connection;
  let transactionStarted = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [rows] = await connection.execute(
      `SELECT id, status, show_id
       FROM bookings WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE`,
      [bookingId, userId],
    );
    if (rows.length === 0) throw new AppError(404, 'Booking not found.');
    const booking = rows[0];
    if (!['CONFIRMED', 'PENDING'].includes(booking.status)) {
      throw new AppError(409, 'Only pending or confirmed bookings can be cancelled.');
    }

    if (booking.status === 'CONFIRMED') {
      const [showRows] = await connection.execute(
        `SELECT start_time,
                (start_time <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 2 HOUR)) AS cutoff_passed
         FROM shows WHERE id = ? LIMIT 1`,
        [booking.show_id],
      );
      if (showRows.length === 0) throw new AppError(404, 'Show not found.');
      if (Number(showRows[0].cutoff_passed) === 1) {
        throw new AppError(409, 'Bookings can only be cancelled more than 2 hours before showtime.');
      }
    }

    const [bookingUpdate] = await connection.execute(
      `UPDATE bookings
       SET status = 'CANCELLED', cancelled_at = UTC_TIMESTAMP(), expires_at = NULL
       WHERE id = ? AND user_id = ? AND status = ?`,
      [bookingId, userId, booking.status],
    );
    if (bookingUpdate.affectedRows !== 1) throw new AppError(409, 'This booking can no longer be cancelled.');

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
  _internals: { CANCELLATION_CUTOFF_HOURS, assertCancellationAllowed },
};
