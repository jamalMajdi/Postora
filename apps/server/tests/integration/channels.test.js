import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createHarness, testUser, secondUser } from '../helpers/harness.js';

/**
 * اختبارات إدارة القنوات — تعمل مقابل خادم تلجرام وهمي.
 * تتحقق من: ربط القناة بعد فحص حي، رفض غير المالك، رفض البوت غير الأدمن،
 * رفض صلاحية النشر الناقصة، ومنع المستخدم الآخر من الوصول.
 */
describe('Channels API', () => {
  let harness;

  beforeAll(async () => {
    harness = await createHarness();
  });

  afterAll(async () => {
    await harness?.close();
  });

  async function authHeaders(user = testUser) {
    const initData = harness.makeInitData(user);
    const res = await request(harness.app).post('/api/auth/session').send({ initData });
    return { Authorization: `Bearer ${res.body.data.token}` };
  }

  it('يرفض ربط قناة غير موجودة', async () => {
    const headers = await authHeaders();
    const res = await request(harness.app)
      .post('/api/channels')
      .set(headers)
      .send({ chatRef: '@does_not_exist' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CHANNEL_NOT_FOUND');
  });

  it('يرفض الربط إن لم يكن البوت مسؤولًا في القناة', async () => {
    harness.fake.setChannel({
      chatId: -1001111111111,
      title: 'قناة بلا بوت أدمن',
      username: 'no_bot_admin',
      botStatus: 'left',
      userStatusById: { [testUser.id]: 'creator' }
    });

    const headers = await authHeaders();
    const res = await request(harness.app)
      .post('/api/channels')
      .set(headers)
      .send({ chatRef: '@no_bot_admin' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CHANNEL_BOT_NOT_ADMIN');
  });

  it('يرفض الربط إن كان البوت أدمن بلا صلاحية نشر', async () => {
    harness.fake.setChannel({
      chatId: -1002222222222,
      title: 'قناة بلا صلاحية نشر',
      username: 'no_post_rights',
      botStatus: 'administrator',
      botCanPost: false,
      userStatusById: { [testUser.id]: 'creator' }
    });

    const headers = await authHeaders();
    const res = await request(harness.app)
      .post('/api/channels')
      .set(headers)
      .send({ chatRef: '@no_post_rights' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CHANNEL_BOT_CANNOT_POST');
  });

  it('يرفض الربط إن لم يكن المستخدم مالكًا أو أدمن', async () => {
    harness.fake.setChannel({
      chatId: -1003333333333,
      title: 'قناة مستخدم عادي',
      username: 'member_only',
      botStatus: 'administrator',
      userStatusById: { [testUser.id]: 'member' }
    });

    const headers = await authHeaders();
    const res = await request(harness.app)
      .post('/api/channels')
      .set(headers)
      .send({ chatRef: '@member_only' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CHANNEL_NOT_OWNED');
  });

  it('يربط القناة بنجاح حين تتوفر كل الشروط', async () => {
    harness.fake.setChannel({
      chatId: -1004444444444,
      title: 'قناتي التجريبية',
      username: 'my_test_channel',
      botStatus: 'administrator',
      botCanPost: true,
      userStatusById: { [testUser.id]: 'creator' }
    });

    const headers = await authHeaders();
    const res = await request(harness.app)
      .post('/api/channels')
      .set(headers)
      .send({ chatRef: '@my_test_channel' });

    expect(res.status).toBe(201);
    expect(res.body.data.channel.title).toBe('قناتي التجريبية');
    expect(res.body.data.channel.bot_is_admin).toBe(true);
    expect(res.body.data.channel.bot_can_post).toBe(true);
    expect(res.body.data.role).toBe('owner');
  });

  it('يعيد قائمة القنوات للمستخدم فقط', async () => {
    const headers = await authHeaders();
    const res = await request(harness.app).get('/api/channels').set(headers);

    expect(res.status).toBe(200);
    expect(res.body.data.channels.length).toBe(1);
    expect(res.body.data.channels[0].username).toBe('my_test_channel');
    expect(res.body.data.channels[0].member_role).toBe('owner');

    // مستخدم آخر لا يرى شيئًا
    const otherHeaders = await authHeaders(secondUser);
    const otherRes = await request(harness.app).get('/api/channels').set(otherHeaders);
    expect(otherRes.status).toBe(200);
    expect(otherRes.body.data.channels.length).toBe(0);
  });

  it('يمنع مستخدمًا آخر من إعادة فحص صلاحيات قناة ليست له', async () => {
    const headers = await authHeaders();
    const list = await request(harness.app).get('/api/channels').set(headers);
    const channelId = list.body.data.channels[0].id;

    const otherHeaders = await authHeaders(secondUser);
    const res = await request(harness.app)
      .post(`/api/channels/${channelId}/verify`)
      .set(otherHeaders);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CHANNEL_NOT_OWNED');
  });

  it('إعادة الفحص تُحدّث حالة الصلاحيات عند تغيّرها في تلجرام', async () => {
    const headers = await authHeaders();
    const list = await request(harness.app).get('/api/channels').set(headers);
    const channelId = list.body.data.channels[0].id;

    // نُزيل صلاحية النشر من البوت في الخادم الوهمي
    harness.fake.state.members.set(`-1004444444444:${harness.fake.state.botId}`, {
      status: 'administrator',
      can_post_messages: false,
      can_send_messages: false
    });

    const res = await request(harness.app)
      .post(`/api/channels/${channelId}/verify`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.data.channel.bot_can_post).toBe(false);
  });

  it('يرفض chatRef بصيغة غير صالحة', async () => {
    const headers = await authHeaders();
    const res = await request(harness.app)
      .post('/api/channels')
      .set(headers)
      .send({ chatRef: 'not a channel!!' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
