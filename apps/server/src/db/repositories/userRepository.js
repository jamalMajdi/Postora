import { query } from '../pool.js';

/**
 * مستودع المستخدمين.
 * جميع الاستعلامات Parameterized — لا سلاسل SQL مبنية من مدخلات.
 */

/**
 * إنشاء أو تحديث مستخدم من بيانات تلجرام.
 * @param {{telegramUserId: number|string, username?: string, firstName?: string, lastName?: string, languageCode?: string}} profile
 * @returns {Promise<object>}
 */
export async function upsertUser(profile) {
  const { rows } = await query(
    `INSERT INTO users (telegram_user_id, username, first_name, last_name, language_code)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (telegram_user_id) DO UPDATE
       SET username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           language_code = EXCLUDED.language_code
     RETURNING *`,
    [
      String(profile.telegramUserId),
      profile.username ?? null,
      profile.firstName ?? null,
      profile.lastName ?? null,
      profile.languageCode ?? null
    ]
  );
  return rows[0];
}

export async function findById(id) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function findByTelegramId(telegramUserId) {
  const { rows } = await query('SELECT * FROM users WHERE telegram_user_id = $1', [
    String(telegramUserId)
  ]);
  return rows[0] || null;
}

export async function updateLocale(id, locale) {
  const { rows } = await query(
    `UPDATE users SET preferred_locale = $2 WHERE id = $1 RETURNING *`,
    [id, locale]
  );
  return rows[0] || null;
}

export async function setBlocked(id, blocked) {
  const { rows } = await query('UPDATE users SET is_blocked = $2 WHERE id = $1 RETURNING *', [
    id,
    blocked
  ]);
  return rows[0] || null;
}
