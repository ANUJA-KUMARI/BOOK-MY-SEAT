const { getPool, toDatabaseError } = require('../config/db');

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 500;

function validateBatchSize(value) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_BATCH_SIZE) {
    throw new TypeError(`batchSize must be a whole number between 1 and ${MAX_BATCH_SIZE}.`);
  }
  return value;
}

async function expireDueBookings({ batchSize = DEFAULT_BATCH_SIZE } = {}) {
  validateBatchSize(batchSize);
  const pool = getPool();
  let connection;
  let transactionStarted = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // SKIP LOCKED lets multiple scheduled worker processes safely share the queue.
    const [dueRows] = await connection.execute(
      `SELECT id FROM bookings
       WHERE status = 'PENDING' AND expires_at IS NOT NULL
         AND expires_at <= UTC_TIMESTAMP()
       ORDER BY expires_at, id
       LIMIT ?
       FOR UPDATE SKIP LOCKED`,
      [batchSize],
    );

    let expiredCount = 0;
    let releasedSeatCount = 0;
    for (const row of dueRows) {
      const [updated] = await connection.execute(
        `UPDATE bookings SET status = 'EXPIRED', expires_at = NULL
         WHERE id = ? AND status = 'PENDING' AND expires_at <= UTC_TIMESTAMP()`,
        [row.id],
      );
      if (updated.affectedRows !== 1) continue;
      const [released] = await connection.execute(
        'UPDATE booking_seats SET active = NULL WHERE booking_id = ? AND active = 1',
        [row.id],
      );
      expiredCount += 1;
      releasedSeatCount += Number(released.affectedRows);
    }

    await connection.commit();
    transactionStarted = false;
    return { examined: dueRows.length, expired: expiredCount, released_seats: releasedSeatCount };
  } catch (error) {
    if (transactionStarted && connection) {
      try { await connection.rollback(); } catch { /* preserve original error */ }
    }
    throw toDatabaseError(error);
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  expireDueBookings,
  _internals: { DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE, validateBatchSize },
};
