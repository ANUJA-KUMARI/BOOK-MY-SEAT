const { getPool, toDatabaseError } = require('../config/db');
const { toIsoUtc } = require('../utils/time');

const BOOKING_SELECT = `
  SELECT b.id, b.booking_ref, b.status, b.total_amount, b.created_at, b.cancelled_at,
         u.id AS user_id, u.name AS customer_name, u.email AS customer_email,
         s.id AS show_id, s.start_time AS show_start_time, s.status AS show_status,
         m.id AS movie_id, m.title AS movie_title, m.poster_url,
         c.id AS cinema_id, c.name AS cinema_name, c.city AS cinema_city,
         sc.id AS screen_id, sc.name AS screen_name
  FROM bookings b
  JOIN users u ON u.id = b.user_id
  JOIN shows s ON s.id = b.show_id
  JOIN movies m ON m.id = s.movie_id
  JOIN screens sc ON sc.id = s.screen_id
  JOIN cinemas c ON c.id = sc.cinema_id`;

function mapAdminBookings(rows, seatRows) {
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
      active: row.active === null ? false : Number(row.active) === 1,
    });
  }
  return rows.map((row) => ({
    id: Number(row.id),
    booking_ref: row.booking_ref,
    status: row.status,
    total_amount: Number(row.total_amount),
    created_at: toIsoUtc(row.created_at),
    cancelled_at: row.cancelled_at ? toIsoUtc(row.cancelled_at) : null,
    customer: {
      id: Number(row.user_id),
      name: row.customer_name,
      email: row.customer_email,
    },
    show: {
      id: Number(row.show_id),
      start_time: toIsoUtc(row.show_start_time),
      status: row.show_status,
      movie: { id: Number(row.movie_id), title: row.movie_title, poster_url: row.poster_url || '' },
      cinema: { id: Number(row.cinema_id), name: row.cinema_name, city: row.cinema_city },
      screen: { id: Number(row.screen_id), name: row.screen_name },
    },
    seats: seatsByBooking.get(Number(row.id)) || [],
  }));
}

function buildFilters({ search = '', status = 'all' } = {}) {
  const clauses = [];
  const values = [];
  if (status !== 'all') {
    clauses.push('b.status = ?');
    values.push(status);
  }
  if (search) {
    clauses.push('(b.booking_ref LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
    const term = '%' + search + '%';
    values.push(term, term, term);
  }
  return {
    sql: clauses.length ? ' WHERE ' + clauses.join(' AND ') : '',
    values,
  };
}

async function listBookings({ search = '', status = 'all', page = 1, limit = 20 } = {}) {
  try {
    const pool = getPool();
    const filters = buildFilters({ search, status });
    const offset = (page - 1) * limit;
    const countSql = `SELECT COUNT(*) AS total FROM bookings b JOIN users u ON u.id = b.user_id${filters.sql}`;
    const listSql = `${BOOKING_SELECT}${filters.sql}
      ORDER BY b.created_at DESC, b.id DESC
      LIMIT ? OFFSET ?`;
    const [[countRows], [rows]] = await Promise.all([
      pool.execute(countSql, filters.values),
      pool.execute(listSql, [...filters.values, limit, offset]),
    ]);
    const total = Number(countRows[0].total);
    if (!rows.length) {
      return { bookings: [], pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } };
    }
    const ids = rows.map((row) => Number(row.id));
    const [seatRows] = await pool.query(
      `SELECT bs.booking_id, bs.seat_id, bs.price_snapshot, bs.active,
              st.row_label, st.seat_number, st.category
       FROM booking_seats bs
       JOIN seats st ON st.id = bs.seat_id
       WHERE bs.booking_id IN (?)
       ORDER BY bs.booking_id, st.row_label, st.seat_number`,
      [ids],
    );
    return {
      bookings: mapAdminBookings(rows, seatRows),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  } catch (error) {
    throw toDatabaseError(error);
  }
}

async function getBookingById(id) {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(`${BOOKING_SELECT} WHERE b.id = ? LIMIT 1`, [id]);
    if (!rows.length) return null;
    const [seatRows] = await pool.execute(
      `SELECT bs.booking_id, bs.seat_id, bs.price_snapshot, bs.active,
              st.row_label, st.seat_number, st.category
       FROM booking_seats bs
       JOIN seats st ON st.id = bs.seat_id
       WHERE bs.booking_id = ?
       ORDER BY st.row_label, st.seat_number`,
      [id],
    );
    return mapAdminBookings(rows, seatRows)[0];
  } catch (error) {
    throw toDatabaseError(error);
  }
}

module.exports = {
  listBookings,
  getBookingById,
  // Export pure helpers directly for focused unit tests and retain _internals
  // for existing internal consumers.
  mapAdminBookings,
  buildFilters,
  _internals: { mapAdminBookings, buildFilters, BOOKING_SELECT },
};
