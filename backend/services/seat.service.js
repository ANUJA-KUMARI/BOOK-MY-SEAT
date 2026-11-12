// Read-only, show-specific seat availability. The database is the source of truth for active reservations.
const { getPool, toDatabaseError } = require('../config/db');
const { toIsoUtc } = require('../utils/time');
const AppError = require('../utils/AppError');

const PRICE_CATEGORIES = ['STANDARD', 'PREMIUM', 'RECLINER'];

function buildSeatMap(seatRows, priceRows) {
  const prices = {};
  for (const row of priceRows) prices[row.category] = Number(row.price);
  const seats = seatRows.map((row) => ({
    id: Number(row.id),
    row_label: row.row_label,
    seat_number: Number(row.seat_number),
    category: row.category,
    is_available: row.active_booking_id === null || row.active_booking_id === undefined,
    status: row.active_booking_id === null || row.active_booking_id === undefined ? 'AVAILABLE' : 'BOOKED',
  }));
  return { seats, prices };
}

async function getShowSeatAvailability(showId) {
  if (!Number.isSafeInteger(showId) || showId < 1) return null;
  try {
    const pool = getPool();
    const [showRows] = await pool.execute(
      `SELECT s.id, s.movie_id, s.screen_id, s.start_time, s.status,
              m.title AS movie_title,
              c.id AS cinema_id, c.name AS cinema_name, c.city AS cinema_city, c.address AS cinema_address,
              sc.name AS screen_name
       FROM shows s
       JOIN movies m ON m.id = s.movie_id
       JOIN screens sc ON sc.id = s.screen_id
       JOIN cinemas c ON c.id = sc.cinema_id
       WHERE s.id = ?
       LIMIT 1`,
      [showId],
    );
    if (showRows.length === 0) return null;
    const show = showRows[0];
    if (show.status !== 'SCHEDULED' || new Date(show.start_time.replace(' ', 'T') + 'Z').getTime() <= Date.now()) {
      throw new AppError(409, 'Seat availability is only available for upcoming scheduled shows.');
    }

    const [seatRows] = await pool.execute(
      `SELECT st.id, st.row_label, st.seat_number, st.category,
              bs.id AS active_booking_id
       FROM seats st
       LEFT JOIN booking_seats bs
         ON bs.seat_id = st.id
        AND bs.show_id = ?
        AND bs.active = 1
       WHERE st.screen_id = ?
       ORDER BY st.row_label, st.seat_number`,
      [showId, show.screen_id],
    );
    const [priceRows] = await pool.execute(
      'SELECT category, price FROM show_prices WHERE show_id = ? ORDER BY category',
      [showId],
    );
    const map = buildSeatMap(seatRows, priceRows);
    if (!PRICE_CATEGORIES.every((category) => Number.isFinite(map.prices[category]))) {
      throw new AppError(409, 'Seat pricing is incomplete for this show. Booking is unavailable.');
    }
    return {
      show: {
        id: Number(show.id),
        movie_id: Number(show.movie_id),
        movie_title: show.movie_title,
        start_time: toIsoUtc(show.start_time),
        status: show.status,
        cinema: {
          id: Number(show.cinema_id), name: show.cinema_name,
          city: show.cinema_city, address: show.cinema_address,
        },
        screen: { id: Number(show.screen_id), name: show.screen_name },
      },
      prices: map.prices,
      seats: map.seats,
      summary: {
        total: map.seats.length,
        available: map.seats.filter((seat) => seat.is_available).length,
        booked: map.seats.filter((seat) => !seat.is_available).length,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw toDatabaseError(error);
  }
}

module.exports = { getShowSeatAvailability, _internals: { buildSeatMap, PRICE_CATEGORIES } };
