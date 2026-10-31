import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createHarness, testUser } from '../helpers/harness.js';
import { createBot } from '../../src/bot/bot.js';

/**
 * اختبارات البوت الفعلية.
 * تُشغَّل ضد خادم تلجرام وهمي (لا بيانات اعتماد حقيقية) عبر تحديثات
 * تُحقن مباشرة إلى bot.handleUpdate — أي أن مسار المعالجة الحقيقي يعمل كاملًا.
 */
describe('Telegram Bot flows', () => {
  let harness;
  let botRunner;
  let _channelId;

  const CHAT_ID = -1007777777777;
  const USER_ID = testUser.id;

  beforeAll(async () => {
    harness = await createHarness();

    harness.fake.setChannel({
      chatId: CHAT_ID,
      title: 'قناة البوت',
      username: 'bot_channel',
      botStatus: 'administrator',
      botCanPost: true,
      userStatusById: { [USER_ID]: 'creator' }
    });

    // ربط القناة كما يفعل المستخدم من التطبيق
    const initData = harness.makeInitData(testUser);
    const session = await request(harness.app).post('/api/auth/session').send({ initData });
    const connect = await request(harness.app)
      .post('/api/channels')
      .set({ Authorization: `Bearer ${session.body.data.token}` })
      .send({ chatRef: '@bot_channel' });
    _channelId = connect.body.data.channel.id;

    botRunner = createBot({
      config: harness.config,
      logger: harness.logger,
      gateway: harness.services.gateway,
      services: harness.services
    });

    // لا نشغّل polling — نمرر التحديثات يدويًا عبر handleUpdate
    botRunner.bot.botInfo = {
      id: harness.fake.state.botId,
      is_bot: true,
      first_name: 'Postora',
      username: 'Postora_1bot'
    };
  });

  afterAll(async () => {
    await harness?.close();
  });

  /** يبني تحديث نص/مستند من مستخدم. */
  function makeUpdate({ text, document, callback, messageId = 1 }) {
    const base = {
      update_id: Math.floor(Math.random() * 1e9),
      message: {
        message_id: messageId,
        chat: { id: USER_ID, type: 'private', first_name: testUser.first_name },
        from: {
          id: USER_ID,
          is_bot: false,
          first_name: testUser.first_name,
          last_name: testUser.last_name,
          username: testUser.username,
          language_code: 'ar'
        },
        date: Math.floor(Date.now() / 1000)
      }
    };

    if (text) {
      base.message.text = text;
      // تلجرام يرفق كيان bot_command — بدونه لا يتعرف Telegraf على الأمر
      if (text.startsWith('/')) {
        const command = text.split(' ')[0];
        base.message.entities = [{ type: 'bot_command', offset: 0, length: command.length }];
      }
    }
    if (document) base.message.document = document;

    if (callback) {
      return {
        update_id: Math.floor(Math.random() * 1e9),
        callback_query: {
          id: String(Math.random()),
          from: base.message.from,
          chat_instance: 'test',
          data: callback,
          message: base.message
        }
      };
    }

    return base;
  }

  it('/start يرد برسالة ترحيب تحتوي اسم البوت والخطوات', async () => {
    harness.fake.reset();
    await botRunner.bot.handleUpdate(makeUpdate({ text: '/start' }));

    const reply = harness.fake.lastMessage();
    expect(reply).toBeDefined();
    expect(reply.text).toContain('Postora');
    expect(reply.text).toContain('Postora_1bot');
    expect(reply.text).toContain('.md');
  });

  it('/help يعرض قائمة الأوامر', async () => {
    harness.fake.reset();
    await botRunner.bot.handleUpdate(makeUpdate({ text: '/help' }));

    const reply = harness.fake.lastMessage();
    expect(reply.text).toContain('/channels');
    expect(reply.text).toContain('/cancel');
  });

  it('/channels يعرض القناة المرتبطة وحالة صلاحيات البوت', async () => {
    harness.fake.reset();
    await botRunner.bot.handleUpdate(makeUpdate({ text: '/channels' }));

    const reply = harness.fake.lastMessage();
    expect(reply.text).toContain('قناة البوت');
    expect(reply.text).toContain('يستطيع النشر');
  });

  it('يرفض ملفًا بامتداد غير .md برسالة عربية واضحة', async () => {
    harness.fake.reset();
    await botRunner.bot.handleUpdate(
      makeUpdate({
        document: { file_id: 'x', file_name: 'notes.txt', file_size: 100, mime_type: 'text/plain' }
      })
    );

    const reply = harness.fake.lastMessage();
    expect(reply.text).toContain('الامتداد غير مدعوم');
  });

  it('يرفض ملفًا أكبر من الحد المسموح قبل تنزيله', async () => {
    harness.fake.reset();
    await botRunner.bot.handleUpdate(
      makeUpdate({
        document: {
          file_id: 'big',
          file_name: 'big.md',
          file_size: 5 * 1024 * 1024,
          mime_type: 'text/markdown'
        }
      })
    );

    const reply = harness.fake.lastMessage();
    expect(reply.text).toContain('أكبر من الحد');
  });

  it('يرفض ملفًا ثنائيًا (ترميز غير صالح)', async () => {
    const { fileId } = harness.fake.addFile({ content: Buffer.from([0x00, 0xff, 0xfe, 0x00]) });
    harness.fake.reset();
    await botRunner.bot.handleUpdate(
      makeUpdate({
        document: { file_id: fileId, file_name: 'binary.md', file_size: 4, mime_type: 'text/markdown' }
      })
    );

    const texts = harness.fake.messagesFor(USER_ID).map((m) => m.text);
    expect(texts.join('\n')).toMatch(/UTF-8|فارغ/);
  });

  it('يستقبل ملف .md صحيحًا ويعرض معاينة كرسائل تلجرام حقيقية', async () => {
    const content = `# مقال من البوت

هذا **نص عريض** و*مائل*.

- عنصر أول
- عنصر ثانٍ`;
    const { fileId } = harness.fake.addFile({ content });

    harness.fake.reset();
    await botRunner.bot.handleUpdate(
      makeUpdate({
        document: {
          file_id: fileId,
          file_name: 'article.md',
          file_size: Buffer.byteLength(content),
          mime_type: 'text/markdown'
        }
      })
    );

    const messages = harness.fake.messagesFor(USER_ID);
    const allText = messages.map((m) => m.text).join('\n---\n');

    // رسالة الاستلام
    expect(allText).toContain('استلمت الملف');
    // رأس المعاينة
    expect(allText).toContain('معاينة المنشور');
    // المعاينة نفسها = الرسائل النهائية
    expect(allText).toContain('مقال من البوت');
    // تحذيرات التنسيق (عناوين/قوائم)
    expect(allText).toContain('العناوين غير مدعومة');
    // أزرار التأكيد موجودة في لوحة الأزرار (reply_markup) وليست نصًا
    const confirmMessage = messages.find(
      (m) => m.replyMarkup && JSON.stringify(m.replyMarkup).includes('flow:confirm')
    );
    expect(confirmMessage).toBeDefined();
    expect(JSON.stringify(confirmMessage.replyMarkup)).toContain('تأكيد النشر');

    // الكيانات موجودة فعلًا في رسالة المعاينة
    const previewMessage = messages.find((m) => m.text.includes('هذا نص عريض'));
    expect(previewMessage).toBeDefined();
    expect(previewMessage.entities.some((e) => e.type === 'bold')).toBe(true);
  });

  it('ينشر بعد التأكيد فقط، ولا ينشر قبل الضغط', async () => {
    const channelMessagesBefore = harness.fake.messagesFor(CHAT_ID).length;

    await botRunner.bot.handleUpdate(makeUpdate({ callback: 'flow:confirm' }));

    const channelMessagesAfter = harness.fake.messagesFor(CHAT_ID).length;
    expect(channelMessagesAfter).toBeGreaterThan(channelMessagesBefore);

    const published = harness.fake.messagesFor(CHAT_ID);
    expect(published.some((m) => m.text.includes('مقال من البوت'))).toBe(true);
  });

  it('إلغاء المعاينة لا ينشر شيئًا', async () => {
    const content = 'محتوى سيُلغى';
    const { fileId } = harness.fake.addFile({ content });

    await botRunner.bot.handleUpdate(
      makeUpdate({
        document: {
          file_id: fileId,
          file_name: 'cancel.md',
          file_size: Buffer.byteLength(content),
          mime_type: 'text/markdown'
        }
      })
    );

    const before = harness.fake.messagesFor(CHAT_ID).length;
    await botRunner.bot.handleUpdate(makeUpdate({ callback: 'flow:cancel' }));
    const after = harness.fake.messagesFor(CHAT_ID).length;

    expect(after).toBe(before);
    const replies = harness.fake.messagesFor(USER_ID).map((m) => m.text);
    expect(replies.join('\n')).toContain('تم إلغاء النشر');
  });

  it('الضغط المزدوج على التأكيد لا ينشر مرتين (الحالة تُستهلك فورًا)', async () => {
    const content = 'محتوى للضغط المزدوج';
    const { fileId } = harness.fake.addFile({ content });

    await botRunner.bot.handleUpdate(
      makeUpdate({
        document: {
          file_id: fileId,
          file_name: 'double.md',
          file_size: Buffer.byteLength(content),
          mime_type: 'text/markdown'
        }
      })
    );

    const before = harness.fake.messagesFor(CHAT_ID).filter((m) =>
      m.text.includes('محتوى للضغط المزدوج')
    ).length;

    await botRunner.bot.handleUpdate(makeUpdate({ callback: 'flow:confirm' }));
    await botRunner.bot.handleUpdate(makeUpdate({ callback: 'flow:confirm' }));

    const after = harness.fake.messagesFor(CHAT_ID).filter((m) =>
      m.text.includes('محتوى للضغط المزدوج')
    ).length;

    expect(after - before).toBe(1);

    // الرد الثاني يخبر المستخدم بانتهاء الصلاحية
    const replies = harness.fake.messagesFor(USER_ID).map((m) => m.text).join('\n');
    expect(replies).toContain('انتهت صلاحية');
  });

  it('يرفض التأكيد إن أُزيل البوت من القناة (فحص حي)', async () => {
    const content = 'محتوى بعد إزالة البوت';
    const { fileId } = harness.fake.addFile({ content });

    // نضع البوت كأدمن وقت المعاينة
    harness.fake.state.members.set(`${CHAT_ID}:${harness.fake.state.botId}`, {
      status: 'administrator',
      can_post_messages: true
    });

    await botRunner.bot.handleUpdate(
      makeUpdate({
        document: {
          file_id: fileId,
          file_name: 'removed.md',
          file_size: Buffer.byteLength(content),
          mime_type: 'text/markdown'
        }
      })
    );

    // ثم نزيله قبل التأكيد
    harness.fake.state.members.set(`${CHAT_ID}:${harness.fake.state.botId}`, { status: 'left' });

    await botRunner.bot.handleUpdate(makeUpdate({ callback: 'flow:confirm' }));

    const channelTexts = harness.fake.messagesFor(CHAT_ID).map((m) => m.text);
    expect(channelTexts).not.toContain('محتوى بعد إزالة البوت');

    const replies = harness.fake.messagesFor(USER_ID).map((m) => m.text).join('\n');
    expect(replies).toContain('ليس مسؤول');

    // إعادة الحالة
    harness.fake.state.members.set(`${CHAT_ID}:${harness.fake.state.botId}`, {
      status: 'administrator',
      can_post_messages: true
    });
  });

  it('/status يعرض آخر عملية نشر', async () => {
    harness.fake.reset();
    await botRunner.bot.handleUpdate(makeUpdate({ text: '/status' }));

    const reply = harness.fake.lastMessage();
    expect(reply.text).toMatch(/منشور|فشل|pending|ملغى/);
  });

  it('/language يبدّل اللغة إلى الإنجليزية ويغيّر ردود البوت', async () => {
    await botRunner.bot.handleUpdate(makeUpdate({ text: '/language' }));
    harness.fake.reset();
    await botRunner.bot.handleUpdate(makeUpdate({ text: '/help' }));

    const reply = harness.fake.lastMessage();
    expect(reply.text).toContain('Postora commands');

    // إرجاع العربية
    await botRunner.bot.handleUpdate(makeUpdate({ text: '/language' }));
  });

  it('نص عادي غير ملف يوجّه المستخدم لإرسال ملف .md', async () => {
    harness.fake.reset();
    await botRunner.bot.handleUpdate(makeUpdate({ text: 'مرحبا كيف حالك' }));

    const reply = harness.fake.lastMessage();
    expect(reply.text).toContain('.md');
  });
});
