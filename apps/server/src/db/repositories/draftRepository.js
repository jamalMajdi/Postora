import { query } from '../pool.js';

/**
 * مستودع المسودات.
 * المحتوى يُخزَّن Markdown خامًا كما كتبه المستخدم — لا HTML ولا تنسيق محوَّل.
 * الحفظ يستخدم قفلًا تفاؤليًا عبر عمود version لمنع ضياع التعديلات المتزامنة.
 */

export async function create({
  userId,
  title,
  contentMarkdown,
  contentHash,
  targetChannelId,
  source = 'miniapp'
}) {
  const { rows } = await query(
    `INSERT INTO drafts (user_id, title, content_markdown, content_hash, target_channel_id, source)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, title ?? null, contentMarkdown, contentHash, targetChannelId ?? null, source]
  );
  return rows[0];
}

export async function findById(id) {
  const { rows } = await query('SELECT * FROM drafts WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function findByIdForUser(id, userId) {
  const { rows } = await query('SELECT * FROM drafts WHERE id = $1 AND user_id = $2', [id, userId]);
  return rows[0] || null;
}

export async function listForUser(userId, { status = null, limit = 50, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT * FROM drafts
      WHERE user_id = $1 AND ($2::text IS NULL OR status = $2)
      ORDER BY updated_at DESC
      LIMIT $3 OFFSET $4`,
    [userId, status, limit, offset]
  );
  return rows;
}

export async function countForUser(userId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM drafts WHERE user_id = $1 AND status = 'draft'`,
    [userId]
  );
  return rows[0].count;
}

/**
 * تحديث مسودة بقفل تفاؤلي.
 * @returns {Promise<object|null>} السطر المحدث أو null إن كان الإصدار قديمًا
 */
export async function updateWithVersion(id, userId, expectedVersion, patch) {
  const { rows } = await query(
    `UPDATE drafts
        SET title = COALESCE($4, title),
            content_markdown = COALESCE($5, content_markdown),
            content_hash = COALESCE($6, content_hash),
            target_channel_id = COALESCE($7, target_channel_id),
            status = COALESCE($8, status),
            version = version + 1
      WHERE id = $1 AND user_id = $2 AND version = $3
      RETURNING *`,
    [
      id,
      userId,
      expectedVersion,
      patch.title ?? null,
      patch.contentMarkdown ?? null,
      patch.contentHash ?? null,
      patch.targetChannelId ?? null,
      patch.status ?? null
    ]
  );
  return rows[0] || null;
}

export async function remove(id, userId) {
  const { rowCount } = await query('DELETE FROM drafts WHERE id = $1 AND user_id = $2', [
    id,
    userId
  ]);
  return rowCount > 0;
}
