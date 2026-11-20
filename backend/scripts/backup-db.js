// Creates an atomic logical MySQL backup and prunes only backups created by this script.
// Run with: npm run db:backup (from backend/). Schedule this command with the host OS scheduler.
// Credentials are passed to mysqldump through its process environment, never as command-line arguments.

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { config } = require('../config/env');

const BACKUP_PREFIX = 'book_my_seat-';
const BACKUP_PATTERN = /^book_my_seat-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.sql$/;

function readRetentionDays(value = process.env.DB_BACKUP_RETENTION_DAYS || '7') {
  const days = Number(value);
  if (!/^\d+$/.test(String(value)) || !Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error('DB_BACKUP_RETENTION_DAYS must be a whole number between 1 and 365.');
  }
  return days;
}

function backupFilename(date = new Date()) {
  const timestamp = date.toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
  return `${BACKUP_PREFIX}${timestamp}.sql`;
}

function buildDumpArgs(db, outputPath) {
  const args = [
    '--single-transaction',
    '--quick',
    '--routines',
    '--triggers',
    // Avoid PROCESS privilege requirements for tablespace metadata and SHOW EVENTS permission.
    '--no-tablespaces',
    '--hex-blob',
    '--set-gtid-purged=OFF',
    `--host=${db.host}`,
    `--port=${db.port}`,
    `--user=${db.user}`,
    `--result-file=${outputPath}`,
    '--databases',
    db.database,
  ];
  if (db.ssl) {
    args.push('--ssl-mode=REQUIRED');
    if (db.sslCa) args.push(`--ssl-ca=${db.sslCa}`);
  }
  return args;
}

async function pruneOldBackups(directory, retentionDays, now = Date.now()) {
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !BACKUP_PATTERN.test(entry.name)) continue;
    const filePath = path.join(directory, entry.name);
    const stats = await fs.promises.stat(filePath);
    if (stats.mtimeMs < cutoff) {
      await fs.promises.unlink(filePath);
      removed += 1;
    }
  }
  return removed;
}

function runDump(command, args, password) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, MYSQL_PWD: password },
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-4000); });
    child.once('error', (error) => reject(new Error(
      error.code === 'ENOENT'
        ? 'mysqldump was not found. Install MySQL client tools or set MYSQLDUMP_PATH.'
        : 'Could not start the MySQL backup process.',
    )));
    child.once('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`mysqldump failed with exit code ${code}.${stderr ? ` Details: ${stderr.trim()}` : ''}`));
    });
  });
}

async function createBackup({
  db = config.db,
  directory = process.env.DB_BACKUP_DIR || path.join(__dirname, '..', 'backups'),
  retentionDays = readRetentionDays(),
  command = process.env.MYSQLDUMP_PATH || 'mysqldump',
  now = new Date(),
} = {}) {
  if (!db.host || !db.port || !db.user || !db.password || !db.database) {
    throw new Error('DB_HOST, DB_PORT, DB_USER, DB_PASSWORD and DB_NAME are required for backups.');
  }
  if (String(db.user).toLowerCase() === 'root') {
    throw new Error('Database backups must use the dedicated least-privilege application account, not root.');
  }

  await fs.promises.mkdir(directory, { recursive: true });
  const filename = backupFilename(now);
  const finalPath = path.join(directory, filename);
  const partialPath = `${finalPath}.partial`;

  try {
    await runDump(command, buildDumpArgs(db, partialPath), db.password);
    const stats = await fs.promises.stat(partialPath);
    if (!stats.isFile() || stats.size === 0) throw new Error('mysqldump produced an empty backup.');
    await fs.promises.rename(partialPath, finalPath);
    const pruned = await pruneOldBackups(directory, retentionDays, now.getTime());
    return { file: finalPath, bytes: stats.size, pruned };
  } catch (error) {
    await fs.promises.rm(partialPath, { force: true }).catch(() => {});
    throw error;
  }
}

if (require.main === module) {
  createBackup()
    .then(({ file, bytes, pruned }) => {
      console.log(`Database backup created: ${file} (${bytes} bytes); old backups removed: ${pruned}.`);
    })
    .catch((error) => {
      console.error(`Database backup failed: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  createBackup,
  readRetentionDays,
  backupFilename,
  buildDumpArgs,
  pruneOldBackups,
  _internals: { BACKUP_PREFIX, BACKUP_PATTERN },
};
