// Starts the HTTP server only after the configured MySQL database has been verified.
// Run with "npm start" (or "npm run dev" to restart automatically on file changes).

const fs = require('node:fs');
const app = require('./app');
const { config } = require('./config/env');
const { checkConnection, closePool, DatabaseError, DbConfigError } = require('./config/db');

if (!fs.existsSync(config.frontendDir)) {
  console.warn(`Warning: frontend folder not found at ${config.frontendDir}. The API will work, but pages will not load.`);
}

/**
 * Creates the server lifecycle. Dependencies are injectable so startup and shutdown can be tested
 * without touching a developer's MySQL database.
 */
function createServerLifecycle({
  application = app,
  port = config.port,
  verifyDatabase = checkConnection,
  closeDatabasePool = closePool,
  logger = console,
} = {}) {
  let server = null;
  let shutdownPromise = null;
  let started = false;

  function listen() {
    return new Promise((resolve, reject) => {
      const candidate = application.listen(port);
      const onError = (error) => {
        candidate.removeListener('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        candidate.removeListener('error', onError);
        server = candidate;
        resolve(candidate);
      };
      candidate.once('error', onError);
      candidate.once('listening', onListening);
    });
  }

  async function start() {
    if (started) return server;
    await verifyDatabase();
    server = await listen();
    started = true;
    const address = server.address();
    const actualPort = address && typeof address === 'object' ? address.port : port;
    logger.log(`BOOK_MY_SEAT is running (${config.nodeEnv})`);
    logger.log(`  Website:      http://localhost:${actualPort}/`);
    logger.log(`  API health:   http://localhost:${actualPort}/api/health`);
    logger.log('Press Ctrl+C to stop.');
    return server;
  }

  function shutdown() {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      logger.log('\nShutting down...');
      let serverError = null;
      if (server && server.listening) {
        await new Promise((resolve) => {
          // server.close() stops new connections and waits for in-flight requests to finish.
          server.close((error) => { serverError = error || null; resolve(); });
          // On supported Node versions, close idle keep-alive sockets immediately.
          if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
        });
      }
      try {
        await closeDatabasePool();
      } catch (error) {
        logger.error('Database connection pool could not be closed cleanly.');
        if (!serverError) serverError = error;
      }
      if (serverError) throw serverError;
    })();
    return shutdownPromise;
  }

  return { start, shutdown, get server() { return server; } };
}


/** Registers idempotent signal handlers; exported for isolated tests without sending real process signals. */
function installSignalHandlers(lifecycle, processRef = process, logger = console) {
  let shuttingDown = false;
  const handleSignal = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    lifecycle.shutdown().then(() => {
      processRef.exitCode = 0;
    }).catch(() => {
      logger.error(`Shutdown after ${signal} did not finish cleanly.`);
      processRef.exitCode = 1;
    });
  };
  processRef.on('SIGINT', handleSignal);
  processRef.on('SIGTERM', handleSignal);
  return handleSignal;
}

async function main() {
  const lifecycle = createServerLifecycle();
  try {
    await lifecycle.start();
  } catch (error) {
    // Only application-authored database/config messages are safe to display.
    if (error instanceof DatabaseError || error instanceof DbConfigError) {
      console.error(`BOOK_MY_SEAT could not start: ${error.message}`);
    } else if (error && error.code === 'EADDRINUSE') {
      console.error(`Port ${config.port} is already in use. Close the other program or change PORT in .env.`);
    } else {
      console.error('BOOK_MY_SEAT could not start because of an unexpected server error.');
    }
    try { await lifecycle.shutdown(); } catch { /* keep startup output free of driver internals */ }
    process.exitCode = 1;
    return;
  }

  installSignalHandlers(lifecycle);
}

if (require.main === module) main();

module.exports = { createServerLifecycle, installSignalHandlers, main };
