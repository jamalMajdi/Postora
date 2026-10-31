import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..', '..', '..');

export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postora:postora_dev_pw@127.0.0.1:5432/postora_test';

/**
 * يعيد بناء مخطط قاعدة الاختبار من الصفر عبر تشغيل ملف الترحيل الحقيقي.
 * يضمن أن الاختبارات تتحقق من الترحيلات نفسها التي ستُشغَّل في الإنتاج.
 *
 * نستخدم runner الخاص بـ node-pg-migrate مع المجموعة الكاملة من الترحيلات،
 * لا نسخة مكتوبة يدويًا — حتى لا تختلف الاختبارات عن الواقع.
 */
export async function resetDatabase() {
  const client = new pg.Client({ connectionString: TEST_DB_URL });
  await client.connect();
  try {
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  } finally {
    await client.end();
  }

  await runMigrations();
}

/** يشغّل كل الترحيلات على قاعدة الاختبار. */
export async function runMigrations() {
  const require = createRequire(import.meta.url);
  const { runner } = require('node-pg-migrate');

  await runner({
    databaseUrl: TEST_DB_URL,
    dir: path.join(ROOT, 'apps', 'server', 'src', 'db', 'migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    count: Infinity,
    log: () => {},
    verbose: false
  });
}

/** تنفيذ استعلام مباشر على قاعدة الاختبار (للتحقق من الحالة النهائية). */
export async function testQuery(sql, params = []) {
  const client = new pg.Client({ connectionString: TEST_DB_URL });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}
