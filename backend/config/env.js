// Central configuration. Reads environment variables (from a local .env file if present) and validates them
// once at start-up, so a bad value fails immediately with a clear message instead of causing odd bugs later.
// Secrets (such as the database password and JWT secret) come ONLY from the environment / .env file, never from source code.

const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const ALLOWED_ENVS = ['development', 'test', 'production'];

// A whole-number setting within a range (for example DB_PORT). Missing or empty means "use the default".
function readWholeNumber(env, name, fallback, min, max) {
  const raw = env[name] === undefined || env[name] === '' ? String(fallback) : env[name];
  const value = Number(raw);
  if (!/^\d+$/.test(String(raw)) || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be a whole number between ${min} and ${max} (got "${raw}")`);
  }
  return value;
}

function readNonEmptyString(env, name, fallback) {
  const value = env[name] === undefined || env[name] === '' ? fallback : env[name];
  if (typeof value !== 'string' || value.trim() === '' || value !== value.trim()) {
    throw new Error(`${name} must be a non-empty string without leading or trailing whitespace`);
  }
  return value;
}

function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  if (!ALLOWED_ENVS.includes(nodeEnv)) {
    throw new Error(`NODE_ENV must be one of ${ALLOWED_ENVS.join(', ')} (got "${nodeEnv}")`);
  }

  const rawPort = env.PORT === undefined || env.PORT === '' ? '3000' : env.PORT;
  const port = Number(rawPort);
  if (!/^\d+$/.test(String(rawPort)) || !Number.isInteger(port) || port > 65535) {
    throw new Error(`PORT must be a whole number between 0 and 65535 (got "${rawPort}")`);
  }

  // MySQL connection settings. Harmless values have defaults. The user name and password are deliberately NOT
  // required here, so the web server code and the configuration tests can load without a database; config/db.js
  // checks that they are present before it connects.
  const db = {
    host: env.DB_HOST || '127.0.0.1', // 127.0.0.1 rather than "localhost": avoids IPv6 lookup problems on Windows
    port: readWholeNumber(env, 'DB_PORT', 3306, 1, 65535),
    user: env.DB_USER,
    database: env.DB_NAME || 'book_my_seat',
    connectionLimit: readWholeNumber(env, 'DB_CONNECTION_LIMIT', 10, 1, 100),
  };
  // The password is stored as a non-enumerable property, so console.log(config) or JSON.stringify(config) can never
  // print it by accident. Read it explicitly as config.db.password.
  Object.defineProperty(db, 'password', { value: env.DB_PASSWORD, enumerable: false });

  // Authentication configuration is introduced before the auth routes. Keep the secret optional at this stage
  // so the existing Phase 4 app and its tests continue to run before authentication is enabled.
  const jwtSecret = env.JWT_SECRET === undefined || env.JWT_SECRET === '' ? undefined : env.JWT_SECRET;
  if (jwtSecret !== undefined && (jwtSecret.length < 32 || jwtSecret.trim() !== jwtSecret)) {
    throw new Error('JWT_SECRET must contain at least 32 characters and have no leading or trailing whitespace');
  }

  const jwtExpiresIn = env.JWT_EXPIRES_IN === undefined || env.JWT_EXPIRES_IN === '' ? '15m' : env.JWT_EXPIRES_IN;
  if (typeof jwtExpiresIn !== 'string' || !/^[1-9]\d*(s|m|h|d)$/.test(jwtExpiresIn)) {
    throw new Error('JWT_EXPIRES_IN must be a positive integer followed by s, m, h, or d (for example 15m)');
  }
  const jwt = {
    expiresIn: jwtExpiresIn,
    issuer: readNonEmptyString(env, 'JWT_ISSUER', 'book-my-seat'),
    audience: readNonEmptyString(env, 'JWT_AUDIENCE', 'book-my-seat-client'),
  };
  // Never expose the signing secret through config logging or JSON serialization.
  Object.defineProperty(jwt, 'secret', { value: jwtSecret, enumerable: false });

  return {
    nodeEnv,
    port,
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
    // The frontend folder sits next to the backend folder and is served by Express (single-origin design).
    frontendDir: path.join(__dirname, '..', '..', 'frontend'),
    db,
    jwt,
  };
}

module.exports = { loadConfig, config: loadConfig() };
