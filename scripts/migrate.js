/**
 * تشغيل الترحيلات (Migrations) من ملفات JS في apps/server/src/db/migrations.
 * الاستخدام:
 *   npm run migrate          → ترقية إلى آخر إصدار
 *   npm run migrate:down     → تراجع خطوة واحدة
 *
 * يستخدم DATABASE_URL من البيئة (.env) ويفشل بوضوح إن غاب.
 */
import 'dotenv/config';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'apps', 'server', 'src', 'db', 'migrations');

const direction = process.argv[2] || 'up';

if (!process.env.DATABASE_URL) {
  console.error('✖ DATABASE_URL غير معرّف. انسخ .env.example إلى .env أولاً.');
  process.exit(1);
}

const envFile = path.join(__dirname, '..', '.env');

const args = [
  'node-pg-migrate',
  direction,
  '--migrations-dir',
  migrationsDir,
  '--migration-file-language',
  'js'
];

// على منصات مثل Render لا يوجد ملف .env — المتغيرات تأتي من البيئة مباشرة.
// تمرير --envPath لملف غير موجود يجعل node-pg-migrate يفشل.
if (existsSync(envFile)) {
  args.push('--envPath', envFile);
}

if (direction === 'down') {
  args.push('--count', '1');
}

console.log(`▶ تشغيل الترحيلات: ${direction}`);
const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
  stdio: 'inherit',
  cwd: __dirname,
  env: process.env
});

process.exit(result.status ?? 1);
