import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createHarness, testUser, secondUser } from '../helpers/harness.js';

/**
 * اختبارات المسودات: الإنشاء، القائمة، التحديث بقفل تفاؤلي، الحذف، والعزل بين المستخدمين.
 */
describe('Drafts API', () => {
  let harness;
  let headers;
  let otherHeaders;

  beforeAll(async () => {
    harness = await createHarness();

    const initData = harness.makeInitData(testUser);
    const session = await request(harness.app).post('/api/auth/session').send({ initData });
    headers = { Authorization: `Bearer ${session.body.data.token}` };

    const otherInitData = harness.makeInitData(secondUser);
    const otherSession = await request(harness.app)
      .post('/api/auth/session')
      .send({ initData: otherInitData });
    otherHeaders = { Authorization: `Bearer ${otherSession.body.data.token}` };
  });

  afterAll(async () => {
    await harness?.close();
  });

  let draftId;

  it('ينشئ مسودة ويستخرج العنوان تلقائيًا', async () => {
    const res = await request(harness.app)
      .post('/api/drafts')
      .set(headers)
      .send({ contentMarkdown: '# مقالي الأول\n\nمحتوى المسودة' });

    expect(res.status).toBe(201);
    expect(res.body.data.draft.title).toBe('مقالي الأول');
    expect(res.body.data.draft.version).toBe(1);
    expect(res.body.data.draft.status).toBe('draft');
    draftId = res.body.data.draft.id;
  });

  it('يرفض مسودة فارغة', async () => {
    const res = await request(harness.app)
      .post('/api/drafts')
      .set(headers)
      .send({ contentMarkdown: '   ' });

    expect(res.status).toBe(400);
  });

  it('يعيد المسودات للمستخدم الحالي فقط', async () => {
    const mine = await request(harness.app).get('/api/drafts').set(headers);
    expect(mine.status).toBe(200);
    expect(mine.body.data.drafts.length).toBe(1);

    const others = await request(harness.app).get('/api/drafts').set(otherHeaders);
    expect(others.body.data.drafts.length).toBe(0);
  });

  it('يحدّث المسودة ويزيد رقم الإصدار', async () => {
    const res = await request(harness.app)
      .patch(`/api/drafts/${draftId}`)
      .set(headers)
      .send({ contentMarkdown: '# مقالي المعدّل\n\nمحتوى جديد', version: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.draft.version).toBe(2);
    expect(res.body.data.draft.content_markdown).toContain('المعدّل');
  });

  it('يمنع الكتابة فوق تعديل متزامن (قفل تفاؤلي)', async () => {
    // نحاول تحديثًا بالإصدار القديم (1) بينما الإصدار الحالي 2
    const res = await request(harness.app)
      .patch(`/api/drafts/${draftId}`)
      .set(headers)
      .send({ contentMarkdown: 'محتوى متزامن خاطئ', version: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.details.reason).toBe('version_conflict');

    // المحتوى لم يتغيّر
    const current = await request(harness.app).get(`/api/drafts/${draftId}`).set(headers);
    expect(current.body.data.draft.content_markdown).toContain('المعدّل');
  });

  it('يمنع مستخدمًا آخر من قراءة مسودة ليست له', async () => {
    const res = await request(harness.app).get(`/api/drafts/${draftId}`).set(otherHeaders);
    expect(res.status).toBe(404);
  });

  it('يمنع مستخدمًا آخر من تعديل مسودة ليست له', async () => {
    const res = await request(harness.app)
      .patch(`/api/drafts/${draftId}`)
      .set(otherHeaders)
      .send({ contentMarkdown: 'محاولة تعديل' });

    expect(res.status).toBe(404);
  });

  it('يمنع مستخدمًا آخر من حذف مسودة ليست له', async () => {
    const res = await request(harness.app).delete(`/api/drafts/${draftId}`).set(otherHeaders);
    expect(res.status).toBe(404);
  });

  it('يرفض targetChannelId لقناة لا يملكها المستخدم', async () => {
    const res = await request(harness.app)
      .post('/api/drafts')
      .set(headers)
      .send({
        contentMarkdown: '# مسودة',
        targetChannelId: '00000000-0000-4000-8000-000000000000'
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CHANNEL_NOT_OWNED');
  });

  it('يحذف المسودة', async () => {
    const res = await request(harness.app).delete(`/api/drafts/${draftId}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);

    const after = await request(harness.app).get(`/api/drafts/${draftId}`).set(headers);
    expect(after.status).toBe(404);
  });

  it('GET /api/me يعكس إحصاءات المسودات', async () => {
    await request(harness.app)
      .post('/api/drafts')
      .set(headers)
      .send({ contentMarkdown: '# مسودة إحصاء' });

    const res = await request(harness.app).get('/api/me').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.data.stats.draftsCount).toBe(1);
  });

  it('PATCH /api/me/locale يغيّر اللغة', async () => {
    const res = await request(harness.app)
      .patch('/api/me/locale')
      .set(headers)
      .send({ locale: 'en' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.locale).toBe('en');

    // إرجاع العربية
    await request(harness.app).patch('/api/me/locale').set(headers).send({ locale: 'ar' });
  });
});
