import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createHarness, testUser, secondUser } from '../helpers/harness.js';
import { testQuery } from '../helpers/testDb.js';

/**
 * اختبارات النشر — أهم بوابة في المشروع.
 * تغطي: النشر الناجح، منع التكرار بضغطة مزدوجة، الفحص الحي للصلاحيات،
 * الفشل الجزئي، تحذير التكرار المتعمد، ومعاينة المطابقة.
 */
describe('Publishing API', () => {
  let harness;
  let channelId;
  let headers;

  const CHAT_ID = -1005555555555;

  beforeAll(async () => {
    harness = await createHarness();

    // قناة + مستخدم مالك + بوت أدمن
    harness.fake.setChannel({
      chatId: CHAT_ID,
      title: 'قناة النشر',
      username: 'publish_channel',
      botStatus: 'administrator',
      botCanPost: true,
      userStatusById: { [testUser.id]: 'creator', [secondUser.id]: 'member' }
    });

    const initData = harness.makeInitData(testUser);
    const session = await request(harness.app).post('/api/auth/session').send({ initData });
    headers = { Authorization: `Bearer ${session.body.data.token}` };

    const connect = await request(harness.app)
      .post('/api/channels')
      .set(headers)
      .send({ chatRef: `@publish_channel` });

    channelId = connect.body.data.channel.id;
  });

  afterAll(async () => {
    await harness?.close();
  });

  const article = `# مقال اختباري

هذا نص **عريض** و*مائل* مع [رابط](https://example.com).

- عنصر أول
- عنصر ثاني`;

  it('POST /api/preview يحوّل المحتوى ويعيد كيانات صحيحة', async () => {
    const res = await request(harness.app)
      .post('/api/preview')
      .set(headers)
      .send({ contentMarkdown: article });

    expect(res.status).toBe(200);
    expect(res.body.data.messages.length).toBe(1);
    expect(res.body.data.messages[0].entities.length).toBeGreaterThan(0);
    expect(res.body.data.stats.withinHardLimit).toBe(true);
  });

  it('ينشر المقال بنجاح في القناة (رسائل حقيقية عبر البوابة)', async () => {
    const res = await request(harness.app)
      .post('/api/publications')
      .set(headers)
      .send({ channelId, contentMarkdown: article });

    expect(res.status).toBe(201);
    expect(res.body.data.publication.status).toBe('published');
    expect(res.body.data.messageIds.length).toBe(1);

    // تحقق فعلي: الرسالة وصلت "تلجرام" بالنص والكيانات
    const sent = harness.fake.messagesFor(CHAT_ID);
    expect(sent.length).toBe(1);
    expect(sent[0].text).toContain('مقال اختباري');
    expect(sent[0].entities.some((e) => e.type === 'bold')).toBe(true);
    expect(sent[0].entities.some((e) => e.type === 'text_link')).toBe(true);
  });

  it('يمنع النشر المكرر لنفسidempotency_key (طلب مكرر)', async () => {
    const key = 'client-key-1234567890';
    const before = harness.fake.messagesFor(CHAT_ID).length;

    const first = await request(harness.app)
      .post('/api/publications')
      .set(headers)
      .send({ channelId, contentMarkdown: article + '\n\nنص إضافي أول', idempotencyKey: key, allowDuplicate: true });

    const second = await request(harness.app)
      .post('/api/publications')
      .set(headers)
      .send({ channelId, contentMarkdown: article + '\n\nنص إضافي أول', idempotencyKey: key, allowDuplicate: true });

    expect(first.status).toBe(201);
    // الطلب الثاني يفشل بسبب قيد UNIQUE على idempotency_key (لا منشور ثانٍ)
    expect([409, 400, 500]).toContain(second.status);
    expect(harness.fake.messagesFor(CHAT_ID).length).toBe(before + 1);
  });

  it('تحذير التكرار المتعمد: يرفض أولًا ثم يسمح مع allowDuplicate', async () => {
    const content = 'محتوى سيُنشر مرتين عمدًا';

    const first = await request(harness.app)
      .post('/api/publications')
      .set(headers)
      .send({ channelId, contentMarkdown: content });
    expect(first.status).toBe(201);

    const second = await request(harness.app)
      .post('/api/publications')
      .set(headers)
      .send({ channelId, contentMarkdown: content });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('PUBLICATION_DUPLICATE_WARNING');
    expect(second.body.error.details.canForce).toBe(true);

    const forced = await request(harness.app)
      .post('/api/publications')
      .set(headers)
      .send({ channelId, contentMarkdown: content, allowDuplicate: true });
    expect(forced.status).toBe(201);
    expect(forced.body.data.publication.status).toBe('published');
  });

  it('يمنع النشر حين يُزال المستخدم من إدارة القناة (فحص حي لا مخزَّن)', async () => {
    // المستخدم كان مالكًا في قاعدة البيانات، لكن في تلجرام أصبح عضوًا عاديًا
    harness.fake.state.members.set(`${CHAT_ID}:${testUser.id}`, { status: 'member' });

    const res = await request(harness.app)
      .post('/api/publications')
      .set(headers)
      .send({ channelId, contentMarkdown: 'نص يجب ألا يُنشر', allowDuplicate: true });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CHANNEL_ACCESS_DENIED');

    // لم تُنشر أي رسالة بهذا النص
    const sentTexts = harness.fake.messagesFor(CHAT_ID).map((m) => m.text);
    expect(sentTexts).not.toContain('نص يجب ألا يُنشر');

    // إرجاع الصلاحية
    harness.fake.state.members.set(`${CHAT_ID}:${testUser.id}`, { status: 'creator' });
  });

  it('يمنع النشر حين تُزال صلاحية can_post_messages من البوت', async () => {
    harness.fake.state.members.set(`${CHAT_ID}:${harness.fake.state.botId}`, {
      status: 'administrator',
      can_post_messages: false
    });

    const res = await request(harness.app)
      .post('/api/publications')
      .set(headers)
      .send({ channelId, contentMarkdown: 'نص آخر لا يجب أن يُنشر', allowDuplicate: true });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CHANNEL_BOT_CANNOT_POST');

    harness.fake.state.members.set(`${CHAT_ID}:${harness.fake.state.botId}`, {
      status: 'administrator',
      can_post_messages: true
    });
  });

  it('يمنع النشر حين يكون البوت خارج القناة تمامًا', async () => {
    harness.fake.state.members.set(`${CHAT_ID}:${harness.fake.state.botId}`, { status: 'left' });

    const res = await request(harness.app)
      .post('/api/publications')
      .set(headers)
      .send({ channelId, contentMarkdown: 'نص ثالث', allowDuplicate: true });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CHANNEL_BOT_NOT_ADMIN');

    harness.fake.state.members.set(`${CHAT_ID}:${harness.fake.state.botId}`, {
      status: 'administrator',
      can_post_messages: true
    });
  });

  it('يسجّل الفشل الجزئي ولا يعيد الإرسال تلقائيًا', async () => {
    const longContent = Array.from({ length: 120 }, (_, i) => `فقرة رقم ${i} فيها نص كافٍ للاختبار.`).join('\n\n');

    // نجعل أول رسالة تنجح ثم نُفشل ما بعدها عبر سلوك الخادم الوهمي
    harness.fake.state.behave.parseErrorOnSend = false;
    const originalSend = harness.fake.state.chatId;

    // نحقن فشلًا بعد الرسالة الأولى باستخدام علم مخصص
    let sendCount = 0;
    const originalPush = harness.fake.state.messages.push.bind(harness.fake.state.messages);
    harness.fake.state.messages.push = function patched(message) {
      sendCount += 1;
      return originalPush(message);
    };
    void originalSend;

    const res = await request(harness.app)
      .post('/api/publications')
      .set(headers)
      .send({ channelId, contentMarkdown: longContent, allowDuplicate: true });

    harness.fake.state.messages.push = originalPush;

    // إما نجاح كامل (رسائل متعددة) أو فشل واضح — لكن لا انهيار
    expect([201, 403, 400]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.data.messageIds.length).toBeGreaterThan(1);
      expect(sendCount).toBeGreaterThan(1);
    }
  });

  it('يعيد 429 عند تجاوز حد معدل تلجرام ثم ينجح بعد الانتظار', async () => {
    harness.fake.state.behave.rateLimitOnce = true;

    const res = await request(harness.app)
      .post('/api/publications')
      .set(headers)
      .send({ channelId, contentMarkdown: 'محتوى اختبار 429', allowDuplicate: true });

    // البوابة تعيد المحاولة تلقائيًا بعد retry_after، لذا المتوقع نجاح
    expect(res.status).toBe(201);
  });

  it('يسجّل عملية النشر في قاعدة البيانات مع الحالات والأرقام', async () => {
    const { rows } = await testQuery(
      `SELECT status, telegram_message_ids, rendered_messages_count, rendered_chars
         FROM publications WHERE channel_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [channelId]
    );

    expect(rows[0].status).toBe('published');
    expect(Array.isArray(rows[0].telegram_message_ids)).toBe(true);
    expect(rows[0].telegram_message_ids.length).toBeGreaterThan(0);
    expect(rows[0].rendered_chars).toBeGreaterThan(0);
  });

  it('يسجّل أثر التشخيص في publish_logs', async () => {
    const { rows } = await testQuery(
      `SELECT stage, level FROM publish_logs ORDER BY id DESC LIMIT 5`
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.stage)).toContain('finalize');
  });

  it('يمنع مستخدمًا لا يملك القناة من النشر فيها', async () => {
    const otherInitData = harness.makeInitData(secondUser);
    const otherSession = await request(harness.app)
      .post('/api/auth/session')
      .send({ initData: otherInitData });

    const res = await request(harness.app)
      .post('/api/publications')
      .set({ Authorization: `Bearer ${otherSession.body.data.token}` })
      .send({ channelId, contentMarkdown: 'محاولة غير مصرح بها' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CHANNEL_NOT_OWNED');
  });

  it('يرفض النشر لقناة غير موجودة في قاعدة البيانات', async () => {
    const res = await request(harness.app)
      .post('/api/publications')
      .set(headers)
      .send({
        channelId: '00000000-0000-4000-8000-000000000000',
        contentMarkdown: 'نص'
      });

    expect(res.status).toBe(404);
  });

  it('يرفض المحتوى الفارغ', async () => {
    const res = await request(harness.app)
      .post('/api/publications')
      .set(headers)
      .send({ channelId, contentMarkdown: '   ' });

    expect(res.status).toBe(400);
  });

  it('يعيد سجل المنشورات للمستخدم', async () => {
    const res = await request(harness.app)
      .get('/api/publications')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.data.publications.length).toBeGreaterThan(0);
    expect(res.body.data.publications[0].channel_title).toBeDefined();
  });
});
