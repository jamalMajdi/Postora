import pg from 'pg';
import { loadEnv } from '../config/env.js';

const { Pool } = pg;

/**
 * Pool اتصالات PostgreSQL.
 * كل الاستعلامات في المشروع تمر عبر هذا الـ pool وباستخدام Parameterized Queries فقط.
 */

/** pg يرجع bigint كنص افتراضيًا — نحوّله إلى Number بأمان (معرفات تلجرام < 2^53). */
pg.types.setTypeParser(20, (value) => {
  const num = Number(value);
  return Number.isSafeInteger(num) ? num : value;
});
/** bigint[] (مثل telegram_message_ids) */
pg.types.setTypeParser(1016, (value) => {
  if (!value) return null;
  return value
    .replace(/^{|}$/g, '')
    .split(',')
    .filter(Boolean)
    .map((v) => Number(v));
});

let pool = null;

export function getPool() {
  if (pool) return pool;
  const { config } = loadEnv();
  pool = new Pool({
    connectionString: config.db.url,
    max: config.db.poolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'postora'
  });

  pool.on('error', (error) => {
    // لا نسجل تفاصيل الاتصال (قد تحتوي على كلمة السر في بعض الحالات)
    console.error('[db] unexpected pool error:', error.message);
  });

  return pool;
}

/** استعلام واحد. */
export async function query(text, params = []) {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

/**
 * معاملة (Transaction) آمنة: rollback تلقائي عند أي خطأ.
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** فحص صحة الاتصال. */
export async function healthCheck() {
  const { rows } = await query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
