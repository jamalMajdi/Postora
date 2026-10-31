import { query } from '../pool.js';

/**
 * مستودع عمليات النشر.
 *
 * نقطة الحماية الأساسية ضد التكرار (architecture.md §4.1):
 *  1) idempotency_key فريد لكل طلب نشر.
 *  2) الانتقال pending → publishing يتم ذرّيًا عبر UPDATE ... WHERE status='pending'
 *     فلا يمكن لطلبين تنفيذ النشر معًا.
 */

export async function create({
  userId,
  draftId,
  channelId,
  source,
  idempotencyKey,
  contentHash,
  telegramChatId,
  renderedMessagesCount = null,
  renderedChars = null
}) {
  const { rows } = await query(
    `INSERT INTO publications
       (user_id, draft_id, channel_id, source, status, idempotency_key, content_hash,
        telegram_chat_id, rendered_messages_count, rendered_chars)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId,
      draftId ?? null,
      channelId,
      source,
      idempotencyKey,
      contentHash,
      String(telegramChatId),
      renderedMessagesCount,
      renderedChars
    ]
  );
  return rows[0];
}

export async function findById(id) {
  const { rows } = await query('SELECT * FROM publications WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function findByIdempotencyKey(key) {
  const { rows } = await query('SELECT * FROM publications WHERE idempotency_key = $1', [key]);
  return rows[0] || null;
}

export async function findForUser(id, userId) {
  const { rows } = await query('SELECT * FROM publications WHERE id = $1 AND user_id = $2', [
    id,
    userId
  ]);
  return rows[0] || null;
}

/**
 * الانتقال الذرّي من pending إلى publishing.
 * @returns {Promise<object|null>} السطر إن نجح الانتقال، أو null إن كان قد عولج
 */
export async function claimForPublishing(id, userId) {
  const { rows } = await query(
    `UPDATE publications
        SET status = 'publishing', confirmed_at = now()
      WHERE id = $1 AND user_id = $2 AND status = 'pending'
      RETURNING *`,
    [id, userId]
  );
  return rows[0] || null;
}

export async function markPublished(id, { messageIds, messagesCount, chars }) {
  const { rows } = await query(
    `UPDATE publications
        SET status = 'published',
            published_at = now(),
            telegram_message_ids = $2,
            rendered_messages_count = $3,
            rendered_chars = $4,
            error_code = NULL,
            error_message = NULL
      WHERE id = $1
      RETURNING *`,
    [id, messageIds, messagesCount, chars]
  );
  return rows[0] || null;
}

export async function markFailed(id, { errorCode, errorMessage, messageIds = null }) {
  const { rows } = await query(
    `UPDATE publications
        SET status = 'failed',
            error_code = $2,
            error_message = $3,
            telegram_message_ids = COALESCE($4, telegram_message_ids)
      WHERE id = $1
      RETURNING *`,
    [id, errorCode, errorMessage?.slice(0, 500) ?? null, messageIds]
  );
  return rows[0] || null;
}

export async function markCancelled(id, userId) {
  const { rows } = await query(
    `UPDATE publications
        SET status = 'cancelled'
      WHERE id = $1 AND user_id = $2 AND status = 'pending'
      RETURNING *`,
    [id, userId]
  );
  return rows[0] || null;
}

/**
 * يعلّم المنشور كمحذوف من تلجرام.
 * لا يغيّر الحالة إلا إذا كان منشورًا فعليًا (published) — حماية من سباق حذف/نشر.
 *
 * @returns {Promise<object|null>} الصف المحدَّث أو null إن كانت الحالة تغيّرت
 */
export async function markDeleted(id, { deletedCount = 0, alreadyDeleted = 0 } = {}) {
  const { rows } = await query(
    `UPDATE publications
        SET status = 'deleted',
            deleted_at = NOW(),
            deleted_messages_count = $2
      WHERE id = $1 AND status = 'published'
      RETURNING *`,
    [id, deletedCount + alreadyDeleted]
  );
  return rows[0] || null;
}

/**
 * يعيد الطلب العالق في 'publishing' إلى 'pending' (بعد انهيار عملية سابقة).
 * يُستخدم فقط من مهمة تنظيف/تشخيص يدوية — ليس تلقائيًا مع النشر.
 */
export async function resetStalePublishing(olderThanMinutes = 10) {
  const { rows } = await query(
    `UPDATE publications
        SET status = 'pending'
      WHERE status = 'publishing'
        AND updated_at < now() - ($1::int * interval '1 minute')
      RETURNING *`,
    [olderThanMinutes]
  );
  return rows;
}

/**
 * كشف التكرار "المتعمد": نفس المحتوى في نفس القناة خلال نافذة زمنية.
 * هذا تحذير للمستخدم فقط، وليس قيدًا (architecture.md §4.2).
 */
export async function findRecentDuplicate({ channelId, contentHash, withinMinutes = 10 }) {
  const { rows } = await query(
    `SELECT id, published_at, telegram_message_ids
       FROM publications
      WHERE channel_id = $1
        AND content_hash = $2
        AND status = 'published'
        AND COALESCE(published_at, created_at) > now() - ($3::int * interval '1 minute')
      ORDER BY published_at DESC
      LIMIT 1`,
    [channelId, contentHash, withinMinutes]
  );
  return rows[0] || null;
}

export async function listForUser(userId, { limit = 20, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT p.*, c.title AS channel_title, c.username AS channel_username
       FROM publications p
       JOIN channels c ON c.id = p.channel_id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
}

export async function countForUser(userId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM publications WHERE user_id = $1`,
    [userId]
  );
  return rows[0].count;
}

export async function statsForUser(userId) {
  const { rows } = await query(
    `SELECT
        COUNT(*) FILTER (WHERE status = 'published')::int AS published,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
     FROM publications WHERE user_id = $1`,
    [userId]
  );
  return rows[0];
}

/** سجل التشخيص لكل محاولة. */
export async function addLog({
  publicationId,
  stage,
  level = 'info',
  errorCode = null,
  details = null,
  durationMs = null,
  attemptNumber = 1
}) {
  await query(
    `INSERT INTO publish_logs (publication_id, attempt_number, stage, level, error_code, details, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      publicationId,
      attemptNumber,
      stage,
      level,
      errorCode,
      details ? JSON.stringify(details) : null,
      durationMs
    ]
  );
}

/**
 * يلغي الطلبات المعلّقة المكررة (نفس القناة ونفس المحتوى) مع إبقاء طلب واحد.
 * الاستخدام: بعد فشل نشر، حتى لا تمنع الطلبات المعلّقة إعادة المحاولة لاحقًا.
 * آمن لأن الطلب المعلّق لم يُرسل أي رسالة فعلًا.
 */
export async function cancelOtherPendingDuplicates({ channelId, contentHash, keepId }) {
  const { rows } = await query(
    `UPDATE publications
        SET status = 'cancelled'
      WHERE channel_id = $1
        AND content_hash = $2
        AND status = 'pending'
        AND id <> $3
      RETURNING id`,
    [channelId, contentHash, keepId]
  );
  return rows;
}
