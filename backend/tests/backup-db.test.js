process.env.NODE_ENV = 'test';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const backup = require('../scripts/backup-db');

describe('database backup helpers', () => {
  it('validates retention settings', () => {
    assert.equal(backup.readRetentionDays('7'), 7);
    for (const value of ['0', '-1', '1.5', '366', 'abc']) {
      assert.throws(() => backup.readRetentionDays(value), /DB_BACKUP_RETENTION_DAYS/);
    }
  });

  it('creates timestamped filenames that are safe on Windows and Unix', () => {
    assert.equal(
      backup.backupFilename(new Date('2026-11-20T12:34:56.789Z')),
      'book_my_seat-2026-11-20T12-34-56Z.sql',
    );
  });

  it('passes connection settings without placing the password in command arguments', () => {
    const args = backup.buildDumpArgs({
      host: 'db.example.test', port: 3306, user: 'bms_app',
      database: 'book_my_seat', password: 'never-on-cli', ssl: true, sslCa: '/tmp/ca.pem',
    }, '/tmp/backup.sql');
    assert.ok(args.includes('--host=db.example.test'));
    assert.ok(args.includes('--no-tablespaces'));
    assert.ok(!args.includes('--events'));
    assert.ok(args.includes('--ssl-mode=REQUIRED'));
    assert.ok(args.includes('--ssl-ca=/tmp/ca.pem'));
    assert.ok(!args.some((arg) => arg.includes('never-on-cli')));
  });

  it('prunes only expired files created by this backup tool', async () => {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'bms-backup-test-'));
    try {
      const oldBackup = path.join(directory, 'book_my_seat-2026-01-01T00-00-00Z.sql');
      const unrelated = path.join(directory, 'important.sql');
      const partial = path.join(directory, 'book_my_seat-2026-01-01T00-00-00Z.sql.partial');
      await Promise.all([oldBackup, unrelated, partial].map((file) => fs.promises.writeFile(file, 'test')));
      const oldTime = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      await fs.promises.utimes(oldBackup, oldTime, oldTime);
      const removed = await backup.pruneOldBackups(directory, 7);
      assert.equal(removed, 1);
      assert.equal(fs.existsSync(oldBackup), false);
      assert.equal(fs.existsSync(unrelated), true);
      assert.equal(fs.existsSync(partial), true);
    } finally {
      await fs.promises.rm(directory, { recursive: true, force: true });
    }
  });
});
