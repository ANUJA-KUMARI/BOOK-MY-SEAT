const { getPool, toDatabaseError } = require('../config/db');
const AppError = require('../utils/AppError');
const { toIsoUtc } = require('../utils/time');

async function confirmUserBooking(userId, bookingId) {
  const pool = getPool();
  let connection;
  let transactionStarted = false;
  let expired = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [rows] = await connection.execute(
      `SELECT id, status, expires_at,
              (expires_at > UTC_TIMESTAMP()) AS hold_is_valid
       FROM bookings WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE`,
      [bookingId, userId],
    );
    if (!rows.length) throw new AppError(404, 'Booking not found.');
    const booking = rows[0];

    if (booking.status === 'CONFIRMED') {
      await connection.commit();
      transactionStarted = false;
      return { id: Number(booking.id), status: 'CONFIRMED', already_confirmed: true };
    }
    if (booking.status !== 'PENDING') {
      throw new AppError(409, 'This reservation can no longer be confirmed. Please select your seats again.');
    }
    if (!booking.expires_at || Number(booking.hold_is_valid) !== 1) {
      await connection.execute(
        `UPDATE bookings SET status = 'EXPIRED', expires_at = NULL
         WHERE id = ? AND status = 'PENDING'`,
        [bookingId],
      );
      await connection.execute(
        'UPDATE booking_seats SET active = NULL WHERE booking_id = ? AND active = 1',
        [bookingId],
      );
      expired = true;
    } else {
      await connection.execute(
        `UPDATE bookings
         SET status = 'CONFIRMED', confirmed_at = UTC_TIMESTAMP(), expires_at = NULL
         WHERE id = ? AND status = 'PENDING'`,
        [bookingId],
      );
    }

    await connection.commit();
    transactionStarted = false;
    if (expired) throw new AppError(409, 'This 10-minute reservation hold has expired. Refresh the seat map and choose your seats again.');
    return { id: Number(bookingId), status: 'CONFIRMED', confirmed_at: toIsoUtc(new Date()) };
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

module.exports = { confirmUserBooking };
