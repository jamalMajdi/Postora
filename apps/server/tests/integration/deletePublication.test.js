import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createHarness, testUser, secondUser } from '../helpers/harness.js';
import { testQuery } from '../helpers/testDb.js';

/**
 * اختبارات حذف المنشورات من القناة.
 *
 * تغطي:
 *  - الحذف الناجح فعليًا من "تلجرام" (رسائل تُزال) + تحديث الحالة في القاعدة.
 *  - الفحص الحي للصلاحيات (مستخدم أُزيل من إدارة القناة ⇒ ممنوع).
 *  - العزل بين المستخدمين (لا يحذف منشور غيره).
 *  - رفض حذف ما لم يُنشر بعد.
 *  - الحذف المتكرر (idempotent): لا خطأ، ويُبلَّغ أنه محذوف مسبقًا.
 */
describe('Delete publications', () => {
  let harness;
  let channelId;
  let headers;
  let secondHeaders;

  const CHAT_ID = -1006666666666;
  const USER_ID = testUser.id;
  const SECOND_ID = secondUser.id;

  beforeAll(async () => {
    harness = await createHarness();

    harness.fake.setChannel({
      chatId: CHAT_ID,
      title: 'قناة الحذف',
      username: 'delete_channel',
      botStatus: 'administrator',
      botCanPost: true,
      userStatusById: { [USER_ID]: 'creator', [SECOND_ID]: 'member' }
    });

    const session = await request(harness.app)
      .post('/api/auth/session')
      .send({ initData: harness.makeInitData(testUser) });
    headers = { Authorization: `Bearer ${session.body.data.token}` };

    const secondSession = await request(harness.app)
      .post('/api/auth/session')
      .send({ initData: harness.makeInitData(secondUser) });
    secondHeaders = { Authorization: `Bearer ${secondSession.body.data.token}` };

    const connect = await request(harness.app)
      .post('/api/channels')
      .set(headers)
      .send({ chatRef: '@delete_channel' });
    channelId = connect.body.data.channel.id;
  });

  afterAll(async () => {
    await harness?.close();
  });

  /** ينشر مقالًا ويعيد سجل المنشور */
  async function publish(content, extra = {}) {
    const res = await request(harness.app)
      .post('/api/publications')
      .set(headers)
      .send({
        channelId,
        contentMarkdown: content,
        idempotencyKey: `del-${Math.random().toString(36).slice(2)}`,
        source: 'miniapp',
        ...extra
      });
    return res;
  }

  it('يحذف منشورًا من القناة فعليًا ويحدّث الحالة إلى deleted', async () => {
    const created = await publish('# منشور للحذف\n\nمحتوى **عريض**.');
    expect([200, 201]).toContain(created.status);

    const publication = created.body.data.publication;
    expect(publication.status).toBe('published');

    const messageIds = publication.telegram_message_ids;
    expect(Array.isArray(messageIds)).toBe(true);
    expect(messageIds.length).toBeGreaterThan(0);

    // الرسائل موجودة في "تلجرام" قبل الحذف
    const before = harness.fake.state.messages.filter((m) => messageIds.includes(m.message_id));
    expect(before.length).toBe(messageIds.length);

    const res = await request(harness.app)
      .delete(`/api/publications/${publication.id}`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.data.deletedCount).toBe(messageIds.length);
    expect(res.body.data.publication.status).toBe('deleted');

    // الرسائل أُزيلت فعليًا من "تلجرام"
    const after = harness.fake.state.messages.filter((m) => messageIds.includes(m.message_id));
    expect(after.length).toBe(0);

    // القاعدة محدّثة
    const row = await testQuery(
      'SELECT status, deleted_at, deleted_messages_count FROM publications WHERE id = $1',
      [publication.id]
    );
    expect(row.rows[0].status).toBe('deleted');
    expect(row.rows[0].deleted_at).not.toBeNull();
    expect(row.rows[0].deleted_messages_count).toBe(messageIds.length);
  });

  it('الحذف المتكرر لا يخطئ ويبلّغ أنه محذوف مسبقًا', async () => {
    const created = await publish('# منشور للتكرار\n\nنص.');
    const publication = created.body.data.publication;

    const first = await request(harness.app)
      .delete(`/api/publications/${publication.id}`)
      .set(headers);
    expect(first.status).toBe(200);

    const second = await request(harness.app)
      .delete(`/api/publications/${publication.id}`)
      .set(headers);
    expect(second.status).toBe(200);
    expect(second.body.data.deletedCount).toBe(0);
    expect(second.body.data.publication.status).toBe('deleted');
  });

  it('يرفض حذف منشور لم يُنشر بعد (pending)', async () => {
    // نُنشئ صفًا معلّقًا مباشرة بقاعدة البيانات لمحاكاة "قيد الانتظار"
    // user_id في القاعدة هو UUID وليس معرّف تلجرام — نقرأه من جدول المستخدمين
    const userRow = await testQuery('SELECT id FROM users WHERE telegram_user_id = $1', [USER_ID]);
    const dbUserId = userRow.rows[0].id;

    const inserted = await testQuery(
      `INSERT INTO publications (user_id, channel_id, source, status, idempotency_key, content_hash, telegram_chat_id)
       VALUES ($1, $2, 'miniapp', 'pending', $3, 'x', $4) RETURNING id`,
      [dbUserId, channelId, `pending-${Date.now()}`, CHAT_ID]
    );
    const pendingId = inserted.rows[0].id;

    const res = await request(harness.app)
      .delete(`/api/publications/${pendingId}`)
      .set(headers);

    // 409 Conflict: الطلب صحيح لكن حالة المورد لا تسمح بالعملية
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PUBLICATION_NOT_PENDING');
  });

  it('لا يستطيع مستخدم حذف منشور مستخدم آخر (404)', async () => {
    const created = await publish('# منشور خاص\n\nنص.');
    const publication = created.body.data.publication;

    const res = await request(harness.app)
      .delete(`/api/publications/${publication.id}`)
      .set(secondHeaders);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PUBLICATION_NOT_FOUND');

    // لا يزال منشورًا فعليًا
    const row = await testQuery('SELECT status FROM publications WHERE id = $1', [publication.id]);
    expect(row.rows[0].status).toBe('published');
  });

  it('الفحص الحي: مستخدم أُزيل من إدارة القناة لا يستطيع الحذف', async () => {
    const created = await publish('# منشور للفحص الحي\n\nنص.');
    const publication = created.body.data.publication;

    // نغيّر حالته في "تلجرام" إلى عضو عادي بعد النشر
    harness.fake.state.members.set(`${CHAT_ID}:${USER_ID}`, {
      status: 'member',
      can_post_messages: false
    });

    const res = await request(harness.app)
      .delete(`/api/publications/${publication.id}`)
      .set(headers);

    expect(res.status).toBe(403);
    expect(['CHANNEL_ACCESS_DENIED', 'CHANNEL_NOT_OWNED']).toContain(res.body.error.code);

    // الرسالة ما زالت موجودة (لم يُحذف شيء)
    const still = harness.fake.state.messages.filter((m) =>
      publication.telegram_message_ids.includes(m.message_id)
    );
    expect(still.length).toBe(publication.telegram_message_ids.length);

    // نُعيد الصلاحية
    harness.fake.state.members.set(`${CHAT_ID}:${USER_ID}`, {
      status: 'creator',
      can_post_messages: true
    });
  });

  it('يرفض حذف منشور غير موجود (404)', async () => {
    const res = await request(harness.app)
      .delete('/api/publications/00000000-0000-4000-8000-000000000000')
      .set(headers);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PUBLICATION_NOT_FOUND');
  });

  it('يرفض الحذف بلا مصادقة (401)', async () => {
    const res = await request(harness.app).delete(
      '/api/publications/00000000-0000-4000-8000-000000000000'
    );
    expect(res.status).toBe(401);
  });

  it('يرفض معرّفًا غير UUID (400)', async () => {
    const res = await request(harness.app).delete('/api/publications/not-a-uuid').set(headers);
    expect(res.status).toBe(400);
  });
});
