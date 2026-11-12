// Owner-scoped booking history and detail reads. Historical prices always come from price_snapshot.
const { getPool, toDatabaseError } = require('../config/db');
const { toIsoUtc } = require('../utils/time');

function mapBookingRows(rows, seatRows) {
  const seatsByBooking = new Map();
  for (const row of seatRows) {
    const bookingId = Number(row.booking_id);
    if (!seatsByBooking.has(bookingId)) seatsByBooking.set(bookingId, []);
    seatsByBooking.get(bookingId).push({
      id: Number(row.seat_id),
      row_label: row.row_label,
      seat_number: Number(row.seat_number),
      category: row.category,
      price: Number(row.price_snapshot),
    });
  }

  return rows.map((row) => ({
    id: Number(row.id),
    booking_ref: row.booking_ref,
    status: row.status,
    total_amount: Number(row.total_amount),
    created_at: toIsoUtc(row.created_at),
    cancelled_at: row.cancelled_at ? toIsoUtc(row.cancelled_at) : null,
    show: {
      id: Number(row.show_id),
      start_time: toIsoUtc(row.show_start_time),
      status: row.show_status,
      movie: { id: Number(row.movie_id), title: row.movie_title, poster_url: row.poster_url ?? '' },
      cinema: {
        id: Number(row.cinema_id), name: row.cinema_name,
        city: row.cinema_city, address: row.cinema_address,
      },
      screen: { id: Number(row.screen_id), name: row.screen_name },
    },
    seats: seatsByBooking.get(Number(row.id)) ?? [],
  }));
}

const BOOKING_SELECT = `SELECT b.id, b.booking_ref, b.status, b.total_amount, b.created_at, b.cancelled_at,
       s.id AS show_id, s.start_time AS show_start_time, s.status AS show_status,
       m.id AS movie_id, m.title AS movie_title, m.poster_url,
       c.id AS cinema_id, c.name AS cinema_name, c.city AS cinema_city, c.address AS cinema_address,
       sc.id AS screen_id, sc.name AS screen_name
FROM bookings b
JOIN shows s ON s.id = b.show_id
JOIN movies m ON m.id = s.movie_id
JOIN screens sc ON sc.id = s.screen_id
JOIN cinemas c ON c.id = sc.cinema_id`;

async function listUserBookings(userId, { page = 1, limit = 20 } = {}) {
  try {
    const pool = getPool();
    const offset = (page - 1) * limit;
    const [[countRows], [rows]] = await Promise.all([
      pool.execute('SELECT COUNT(*) AS total FROM bookings WHERE user_id = ?', [userId]),
      pool.execute(
        `${BOOKING_SELECT}
         WHERE b.user_id = ?
         ORDER BY b.created_at DESC, b.id DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset],
      ),
    ]);
    const total = Number(countRows[0].total);
    if (rows.length === 0) {
      return { bookings: [], pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } };
    }
    const ids = rows.map((row) => Number(row.id));
    const [seatRows] = await pool.query(
      `SELECT bs.booking_id, bs.seat_id, st.row_label, st.seat_number, st.category, bs.price_snapshot
       FROM booking_seats bs
       JOIN seats st ON st.id = bs.seat_id
       WHERE bs.booking_id IN (?) AND bs.show_id IN (SELECT show_id FROM bookings WHERE user_id = ? AND id IN (?))
       ORDER BY bs.booking_id, st.row_label, st.seat_number`,
      [ids, userId, ids],
    );
    return {
      bookings: mapBookingRows(rows, seatRows),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  } catch (error) {
    throw toDatabaseError(error);
  }
}

async function getUserBookingById(userId, bookingId) {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      `${BOOKING_SELECT}
       WHERE b.id = ? AND b.user_id = ?
       LIMIT 1`,
      [bookingId, userId],
    );
    if (rows.length === 0) return null;
    const [seatRows] = await pool.execute(
      `SELECT bs.booking_id, bs.seat_id, st.row_label, st.seat_number, st.category, bs.price_snapshot
       FROM booking_seats bs
       JOIN seats st ON st.id = bs.seat_id
       WHERE bs.booking_id = ? AND bs.show_id = ?
       ORDER BY st.row_label, st.seat_number`,
      [bookingId, rows[0].show_id],
    );
    return mapBookingRows(rows, seatRows)[0];
  } catch (error) {
    throw toDatabaseError(error);
  }
}

module.exports = {
  listUserBookings,
  getUserBookingById,
  _internals: { mapBookingRows, BOOKING_SELECT },
};
