import { query, withTransaction } from '../pool.js';

/**
 * مستودع القنوات وعضوياتها.
 * لا يُستخدم هذا المستودع كقرار أمني: قرار النشر يُتخذ من فحص حي في تلجرام (راجع architecture.md §4.3).
 */

export async function upsertChannel({
  telegramChatId,
  title,
  username,
  chatType,
  botIsAdmin,
  botCanPost,
  createdByUserId
}) {
  const { rows } = await query(
    `INSERT INTO channels
       (telegram_chat_id, title, username, chat_type, bot_is_admin, bot_can_post, permissions_checked_at, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, now(), $7)
     ON CONFLICT (telegram_chat_id) DO UPDATE
       SET title = EXCLUDED.title,
           username = EXCLUDED.username,
           chat_type = EXCLUDED.chat_type,
           bot_is_admin = EXCLUDED.bot_is_admin,
           bot_can_post = EXCLUDED.bot_can_post,
           permissions_checked_at = now(),
           is_active = true
     RETURNING *`,
    [
      String(telegramChatId),
      title,
      username ?? null,
      chatType,
      Boolean(botIsAdmin),
      Boolean(botCanPost),
      createdByUserId ?? null
    ]
  );
  return rows[0];
}

export async function findById(id) {
  const { rows } = await query('SELECT * FROM channels WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function findByTelegramChatId(telegramChatId) {
  const { rows } = await query('SELECT * FROM channels WHERE telegram_chat_id = $1', [
    String(telegramChatId)
  ]);
  return rows[0] || null;
}

/**
 * يضيف عضوية مستخدم لقناة (idempotent).
 */
export async function addMember(channelId, userId, role = 'owner') {
  const { rows } = await query(
    `INSERT INTO channel_members (channel_id, user_id, role, verified_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (channel_id, user_id) DO UPDATE
       SET role = EXCLUDED.role, verified_at = now()
     RETURNING *`,
    [channelId, userId, role]
  );
  return rows[0];
}

export async function findMembership(channelId, userId) {
  const { rows } = await query(
    `SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2`,
    [channelId, userId]
  );
  return rows[0] || null;
}

/**
 * قنوات مستخدم مع دوره فيها.
 * @param {string} userId UUID
 */
export async function listForUser(userId) {
  const { rows } = await query(
    `SELECT c.*, m.role AS member_role
       FROM channels c
       JOIN channel_members m ON m.channel_id = c.id
      WHERE m.user_id = $1 AND c.is_active = true
      ORDER BY c.title ASC`,
    [userId]
  );
  return rows;
}

export async function updateBotPermissions(channelId, { botIsAdmin, botCanPost }) {
  const { rows } = await query(
    `UPDATE channels
        SET bot_is_admin = $2, bot_can_post = $3, permissions_checked_at = now()
      WHERE id = $1
      RETURNING *`,
    [channelId, Boolean(botIsAdmin), Boolean(botCanPost)]
  );
  return rows[0] || null;
}

/**
 * ينشئ/يحدّث القناة والعضوية في معاملة واحدة.
 */
export async function registerChannelWithOwner(params) {
  return withTransaction(async (client) => {
    const channelResult = await client.query(
      `INSERT INTO channels
         (telegram_chat_id, title, username, chat_type, bot_is_admin, bot_can_post, permissions_checked_at, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, now(), $7)
       ON CONFLICT (telegram_chat_id) DO UPDATE
         SET title = EXCLUDED.title,
             username = EXCLUDED.username,
             chat_type = EXCLUDED.chat_type,
             bot_is_admin = EXCLUDED.bot_is_admin,
             bot_can_post = EXCLUDED.bot_can_post,
             permissions_checked_at = now(),
             is_active = true
       RETURNING *`,
      [
        String(params.telegramChatId),
        params.title,
        params.username ?? null,
        params.chatType,
        Boolean(params.botIsAdmin),
        Boolean(params.botCanPost),
        params.createdByUserId ?? null
      ]
    );
    const channel = channelResult.rows[0];

    const memberResult = await client.query(
      `INSERT INTO channel_members (channel_id, user_id, role, verified_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (channel_id, user_id) DO UPDATE SET role = EXCLUDED.role, verified_at = now()
       RETURNING *`,
      [channel.id, params.userId, params.role || 'owner']
    );

    return { channel, membership: memberResult.rows[0] };
  });
}

export async function removeMember(channelId, userId) {
  const { rowCount } = await query(
    `DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2`,
    [channelId, userId]
  );
  return rowCount > 0;
}

export async function countMembers(channelId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM channel_members WHERE channel_id = $1`,
    [channelId]
  );
  return rows[0].count;
}

export async function deactivate(channelId) {
  const { rows } = await query(
    `UPDATE channels SET is_active = false WHERE id = $1 RETURNING *`,
    [channelId]
  );
  return rows[0] || null;
}
