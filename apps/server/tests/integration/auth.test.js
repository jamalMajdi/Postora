import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createHarness, testUser } from '../helpers/harness.js';

/**
 * اختبارات المصادقة: التحقق من initData، إصدار الجلسة، ورفض المحاولات غير الصحيحة.
 * كل ذلك بلا أي بيانات اعتماد حقيقية.
 */
describe('Authentication API', () => {
  let harness;

  beforeAll(async () => {
    harness = await createHarness();
  });

  afterAll(async () => {
    await harness?.close();
  });

  it('GET /health يعيد ok=true', async () => {
    const res = await request(harness.app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe('postora');
  });

  it('POST /api/auth/session يصدر جلسة صحيحة لـ initData صالح', async () => {
    const initData = harness.makeInitData(testUser);

    const res = await request(harness.app)
      .post('/api/auth/session')
      .send({ initData });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user.telegramUserId).toBe(String(testUser.id));
    expect(res.body.data.user.username).toBe('test_user');
    // لا يجب أن يعود أي سر
    expect(JSON.stringify(res.body)).not.toContain('TEST_TOKEN');
  });

  it('يرفض initData غائبًا', async () => {
    const res = await request(harness.app).post('/api/auth/session').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('يرفض initData بتوقيع معدَّل', async () => {
    const initData = harness.makeInitData(testUser);
    const tampered = initData.replace('test_user', 'hacker_user');

    const res = await request(harness.app)
      .post('/api/auth/session')
      .send({ initData: tampered });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_INVALID_INIT_DATA');
  });

  it('يرفض initData منتهية الصلاحية', async () => {
    const oldAuthDate = Math.floor(Date.now() / 1000) - 100000;
    const initData = harness.makeInitData(testUser, { authDate: oldAuthDate });

    const res = await request(harness.app)
      .post('/api/auth/session')
      .send({ initData });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_EXPIRED_INIT_DATA');
  });

  it('يرفض initData موقّعة بمفتاح مختلف (بوت آخر)', async () => {
    const { buildInitDataForTests } = await import('../../src/telegram/initDataValidator.js');
    const initData = buildInitDataForTests(testUser, '999999:DIFFERENT_BOT_TOKEN_VALUE');

    const res = await request(harness.app)
      .post('/api/auth/session')
      .send({ initData });

    expect(res.status).toBe(401);
  });

  it('GET /api/me يعمل بـ Bearer token ويعيد الإحصاءات', async () => {
    const initData = harness.makeInitData(testUser);
    const session = await request(harness.app).post('/api/auth/session').send({ initData });

    const res = await request(harness.app)
      .get('/api/me')
      .set('Authorization', `Bearer ${session.body.data.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.telegramUserId).toBe(String(testUser.id));
    expect(res.body.data.stats).toMatchObject({
      draftsCount: 0,
      channelsCount: 0,
      publishedCount: 0
    });
  });

  it('يعمل أيضًا بترويسة X-Telegram-Init-Data', async () => {
    const initData = harness.makeInitData(testUser);
    const res = await request(harness.app)
      .get('/api/me')
      .set('X-Telegram-Init-Data', initData);

    expect(res.status).toBe(200);
    expect(res.body.data.user.telegramUserId).toBe(String(testUser.id));
  });

  it('يرفض token تالفًا', async () => {
    const res = await request(harness.app)
      .get('/api/me')
      .set('Authorization', 'Bearer not.a.valid.token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_INVALID_TOKEN');
  });

  it('يرفض الطلب بلا أي مصادقة', async () => {
    const res = await request(harness.app).get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_MISSING_INIT_DATA');
  });

  it('لا يكشف تفاصيل داخلية في رسالة الخطأ', async () => {
    const res = await request(harness.app).get('/api/nonexistent');
    expect(res.status).toBe(401); // المصادقة أولًا
    const authed = await request(harness.app)
      .get('/api/nonexistent')
      .set('Authorization', `Bearer ${await tokenFor(harness)}`);

    expect(authed.status).toBe(404);
    expect(JSON.stringify(authed.body)).not.toMatch(/at |stack|node_modules/);
  });
});

async function tokenFor(harness) {
  const initData = harness.makeInitData(testUser);
  const res = await request(harness.app).post('/api/auth/session').send({ initData });
  return res.body.data.token;
}
