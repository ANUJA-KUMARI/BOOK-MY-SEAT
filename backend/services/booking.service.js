const crypto = require('node:crypto');
const { getPool, toDatabaseError } = require('../config/db');
const AppError = require('../utils/AppError');
const { toIsoUtc } = require('../utils/time');

const PRICE_CATEGORIES = ['STANDARD', 'PREMIUM', 'RECLINER'];

function makeBookingReference() {
  return `BMS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

async function createBooking({ userId, showId, seatIds }) {
  const pool = getPool();
  let connection;
  let transactionStarted = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [shows] = await connection.execute(
      `SELECT id, screen_id, start_time, status
       FROM shows WHERE id = ? LIMIT 1 FOR UPDATE`,
      [showId],
    );
    const show = shows[0];
    if (!show) throw new AppError(404, 'Show not found.');
    if (show.status !== 'SCHEDULED' || new Date(toIsoUtc(show.start_time)).getTime() <= Date.now()) {
      throw new AppError(409, 'This show is no longer available for booking.');
    }

    const placeholders = seatIds.map(() => '?').join(', ');
    const [seats] = await connection.execute(
      `SELECT id, screen_id, row_label, seat_number, category
       FROM seats WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
      seatIds,
    );
    if (seats.length !== seatIds.length || seats.some((seat) => Number(seat.screen_id) !== Number(show.screen_id))) {
      throw new AppError(400, 'One or more selected seats do not belong to this show.');
    }

    const [priceRows] = await connection.execute(
      'SELECT category, price FROM show_prices WHERE show_id = ?',
      [showId],
    );
    const prices = Object.fromEntries(priceRows.map((row) => [row.category, Number(row.price)]));
    if (!PRICE_CATEGORIES.every((category) => Number.isFinite(prices[category]))) {
      throw new AppError(409, 'Seat pricing is incomplete for this show. Booking is unavailable.');
    }

    const totalAmount = seats.reduce((sum, seat) => sum + prices[seat.category], 0);
    const bookingRef = makeBookingReference();
    const [bookingResult] = await connection.execute(
      'INSERT INTO bookings (booking_ref, user_id, show_id, status, total_amount) VALUES (?, ?, ?, ?, ?)',
      [bookingRef, userId, showId, 'CONFIRMED', totalAmount.toFixed(2)],
    );
    const bookingId = Number(bookingResult.insertId);

    for (const seat of seats) {
      await connection.execute(
        `INSERT INTO booking_seats
          (booking_id, show_id, screen_id, seat_id, price_snapshot, active)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [bookingId, showId, show.screen_id, seat.id, prices[seat.category].toFixed(2)],
      );
    }

    await connection.commit();
    transactionStarted = false;
    return {
      id: bookingId,
      booking_ref: bookingRef,
      show_id: Number(showId),
      status: 'CONFIRMED',
      total_amount: Number(totalAmount.toFixed(2)),
      seats: seats.map((seat) => ({
        id: Number(seat.id),
        row_label: seat.row_label,
        seat_number: Number(seat.seat_number),
        category: seat.category,
        price: prices[seat.category],
      })),
    };
  } catch (error) {
    if (transactionStarted && connection) {
      try { await connection.rollback(); } catch { /* preserve the original error */ }
    }
    if (error instanceof AppError) throw error;
    if (error && (error.code === 'ER_DUP_ENTRY' || error.code === 'ER_LOCK_DEADLOCK' || error.code === 'ER_LOCK_WAIT_TIMEOUT')) {
      throw new AppError(409, 'One or more selected seats have just been booked. Refresh the seat map and try again.');
    }
    throw toDatabaseError(error);
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { createBooking, _internals: { makeBookingReference, PRICE_CATEGORIES } };
