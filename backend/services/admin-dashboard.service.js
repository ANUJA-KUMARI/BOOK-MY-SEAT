const { getPool, toDatabaseError } = require('../config/db');
const { toIsoUtc } = require('../utils/time');

async function getDashboardSummary() {
  try {
    const pool = getPool();
    const [
      [bookingRows],
      [catalogRows],
      [showRows],
      [recentRows],
      [upcomingRows],
    ] = await Promise.all([
      pool.execute(`SELECT COUNT(*) AS total_bookings,
        SUM(status = 'CONFIRMED') AS confirmed_bookings,
        SUM(status = 'CANCELLED') AS cancelled_bookings,
        COALESCE(SUM(CASE WHEN status = 'CONFIRMED' THEN total_amount ELSE 0 END), 0) AS confirmed_revenue
        FROM bookings`),
      pool.execute(`SELECT
        (SELECT COUNT(*) FROM movies WHERE is_active = TRUE) AS active_movies,
        (SELECT COUNT(*) FROM cinemas) AS cinemas,
        (SELECT COUNT(*) FROM screens) AS screens`),
      pool.execute(`SELECT COUNT(*) AS upcoming_shows FROM shows
        WHERE status = 'SCHEDULED' AND start_time > UTC_TIMESTAMP()`),
      pool.execute(`SELECT b.id, b.booking_ref, b.status, b.total_amount, b.created_at,
        u.name AS customer_name, u.email AS customer_email,
        m.title AS movie_title, s.start_time AS show_start_time,
        c.name AS cinema_name, sc.name AS screen_name,
        (SELECT COUNT(*) FROM booking_seats bs WHERE bs.booking_id = b.id) AS seat_count
        FROM bookings b
        JOIN users u ON u.id = b.user_id
        JOIN shows s ON s.id = b.show_id
        JOIN movies m ON m.id = s.movie_id
        JOIN screens sc ON sc.id = s.screen_id
        JOIN cinemas c ON c.id = sc.cinema_id
        GROUP BY b.id, b.booking_ref, b.status, b.total_amount, b.created_at,
          u.name, u.email, m.title, s.start_time, c.name, sc.name
        ORDER BY b.created_at DESC, b.id DESC LIMIT 8`),
      pool.execute(`SELECT s.id, s.start_time, m.title AS movie_title,
        c.name AS cinema_name, sc.name AS screen_name
        FROM shows s
        JOIN movies m ON m.id = s.movie_id
        JOIN screens sc ON sc.id = s.screen_id
        JOIN cinemas c ON c.id = sc.cinema_id
        WHERE s.status = 'SCHEDULED' AND s.start_time > UTC_TIMESTAMP()
        ORDER BY s.start_time ASC LIMIT 5`),
    ]);

    const bookings = bookingRows[0];
    const catalog = catalogRows[0];
    return {
      metrics: {
        total_bookings: Number(bookings.total_bookings || 0),
        confirmed_bookings: Number(bookings.confirmed_bookings || 0),
        cancelled_bookings: Number(bookings.cancelled_bookings || 0),
        confirmed_revenue: Number(bookings.confirmed_revenue || 0),
        active_movies: Number(catalog.active_movies || 0),
        cinemas: Number(catalog.cinemas || 0),
        screens: Number(catalog.screens || 0),
        upcoming_shows: Number(showRows[0].upcoming_shows || 0),
      },
      recent_bookings: recentRows.map((row) => ({
        id: Number(row.id),
        booking_ref: row.booking_ref,
        status: row.status,
        total_amount: Number(row.total_amount),
        created_at: toIsoUtc(row.created_at),
        customer: { name: row.customer_name, email: row.customer_email },
        movie_title: row.movie_title,
        show_start_time: toIsoUtc(row.show_start_time),
        cinema_name: row.cinema_name,
        screen_name: row.screen_name,
        seat_count: Number(row.seat_count),
      })),
      upcoming_shows: upcomingRows.map((row) => ({
        id: Number(row.id),
        start_time: toIsoUtc(row.start_time),
        movie_title: row.movie_title,
        cinema_name: row.cinema_name,
        screen_name: row.screen_name,
      })),
    };
  } catch (error) {
    throw toDatabaseError(error);
  }
}

module.exports = { getDashboardSummary };
