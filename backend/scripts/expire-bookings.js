// Run once per scheduler invocation. Schedule this command every minute on one or more hosts;
// SELECT ... FOR UPDATE SKIP LOCKED makes overlapping workers safe.
const { expireDueBookings } = require('../services/booking-expiry.service');
const { closePool } = require('../config/db');

async function main() {
  try {
    const result = await expireDueBookings();
    console.log(`Booking expiry run complete: ${result.expired} expired; ${result.released_seats} seats released; ${result.examined} examined.`);
  } catch (error) {
    console.error('Booking expiry run failed. Check database connectivity and migration status.');
    process.exitCode = 1;
  } finally {
    await closePool().catch(() => { process.exitCode = 1; });
  }
}

if (require.main === module) main();

module.exports = { main };
