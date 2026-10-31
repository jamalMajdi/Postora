#!/usr/bin/env node
/**
 * خادم تلجرام وهمي مستقل للتطوير المحلي.
 *
 * الغرض: تمكين تجربة البوت كاملة (رسائل، ملفات .md، أزرار، نشر) **بدون توكن حقيقي**.
 * يطبّق نفس بروتوكول Bot API للطرق التي نستخدمها، ويطبّع كل شيء في السجلات.
 *
 * ⚠️ هذا الخادم للتطوير فقط. لا يتحقق من التوكن ولا يشفر.

   التشغيل:  node scripts/fake-telegram-server.js
   المنفذ:   FAKE_TG_PORT (افتراضي 8081)
 */
import http from 'node:http';

const PORT = Number(process.env.FAKE_TG_PORT || 8081);
const BOT_ID = Number(process.env.FAKE_TG_BOT_ID || 999000111);
const BOT_USERNAME = process.env.FAKE_TG_BOT_USERNAME || 'Postora_1bot';

/** حالة في الذاكرة */
const chats = new Map();
const members = new Map();
const messages = [];
const files = new Map();
const updates = [];
let updateId = 1; // eslint-disable-line prefer-const -- يُزاد في كل تحديث
let nextMessageId = 1000;

/* --------- بيانات ابتدائية مفيدة للتطوير --------- */
function seed() {
  const chatId = -1001234567890;
  chats.set(String(chatId), {
    id: chatId,
    type: 'channel',
    title: 'قناة تجريبية (Fake)',
    username: 'postora_demo_channel'
  });
  members.set(`${chatId}:${BOT_ID}`, {
    status: 'administrator',
    can_post_messages: true,
    can_send_messages: true
  });
  // أي مستخدم يُعامل كمالك في هذه القناة التجريبية (للتجربة فقط)
  console.log(
    `[fake-tg] seeded demo channel @postora_demo_channel (${chatId}) — bot is admin`
  );
  void updateId;
  void nextMessageId;
}
seed();

/* --------- دعم إدراج ملف .md جاهز للتجربة --------- */
const SAMPLE_MD = `# مرحبًا بـ Postora

هذا **مقال تجريبي** يوضح تحويل Markdown إلى تنسيق تلجرام.

## ما الذي يدعمه؟

- نص **عريض** و *مائل* و ~~مشطوب~~
- \`كود سطري\` وكتل كود
- [روابط](https://example.com)
- اقتباسات

> اقتباس: تلجرام لا يدعم العناوين، لذا تظهر كسطر عريض.

## ما الذي لا يدعمه؟

| ميزة | البديل |
|---|---|
| الجداول | كتلة نصية |
| الصور | رابط |

\`\`\`js
console.log('Postora + Telegram');
\`\`\`
`;

const sampleFileId = 'sample_article_md';
files.set(sampleFileId, {
  file_path: `documents/${sampleFileId}.md`,
  content: Buffer.from(SAMPLE_MD, 'utf8'),
  name: 'sample-article.md'
});

/* --------- الخادم --------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // تحميل ملف
  if (url.pathname.startsWith('/file/bot')) {
    const filePath = decodeURIComponent(url.pathname.split('/').slice(3).join('/'));
    const entry = [...files.values()].find((f) => f.file_path === filePath);
    if (!entry) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
    res.end(entry.content);
    return;
  }

  /* ------------ نقاط مساعدة (ليست من Bot API) ------------ */
  if (url.pathname === '/_fake/inject-update' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const update = JSON.parse(body || '{}');
    updates.push(update);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === '/_fake/state') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify(
        { chats: [...chats.values()], messages, files: [...files.keys()] },
        null,
        2
      )
    );
    return;
  }

  if (url.pathname === '/_fake/last-messages') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(messages.slice(-20), null, 2));
    return;
  }

  if (!url.pathname.startsWith('/bot')) {
    res.writeHead(404).end('not found');
    return;
  }

  // المسار: /bot<token>/<method>  →  segments: ['', 'bot<token>', '<method>']
  const segments = url.pathname.split('/').filter(Boolean);
  const method = segments[1] || '';
  let body = '';
  for await (const chunk of req) body += chunk;
  let payload = {};
  try {
    payload = body ? JSON.parse(body) : {};
  } catch {
    payload = {};
  }

  const reply = (data) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  const ok = (result) => reply({ ok: true, result });
  const fail = (code, description) =>
    res.writeHead(code, { 'content-type': 'application/json' }).end(
      JSON.stringify({ ok: false, error_code: code, description })
    );

  console.log(`[fake-tg] ${method}`);

  switch (method) {
    case 'getMe':
      return ok({ id: BOT_ID, is_bot: true, first_name: 'Postora', username: BOT_USERNAME });

    case 'getChat': {
      const ref = String(payload.chat_id);
      let chat = chats.get(ref);
      if (!chat && ref.startsWith('@')) {
        chat = [...chats.values()].find(
          (c) => String(c.username).toLowerCase() === ref.slice(1).toLowerCase()
        );
      }
      if (!chat) return fail(400, 'Bad Request: chat not found');
      return ok(chat);
    }

    case 'getChatMember': {
      let member = members.get(`${payload.chat_id}:${payload.user_id}`);
      if (!member && String(payload.chat_id).startsWith('@')) {
        const chat = [...chats.values()].find(
          (c) =>
            String(c.username).toLowerCase() ===
            String(payload.chat_id).slice(1).toLowerCase()
        );
        if (chat) member = members.get(`${chat.id}:${payload.user_id}`);
      }
      // في التطوير: أي مستخدم يُعامل كمالك للقناة التجريبية
      if (!member) {
        return ok({ user: { id: payload.user_id }, status: 'creator' });
      }
      return ok({ user: { id: Number(payload.user_id) }, ...member });
    }

    case 'sendMessage': {
      if (!payload.text) return fail(400, 'Bad Request: message text is empty');
      if (String(payload.text).length > 4096) {
        return fail(400, 'Bad Request: message is too long');
      }
      const message = {
        message_id: nextMessageId++,
        chat: { id: Number(payload.chat_id) },
        date: Math.floor(Date.now() / 1000),
        text: payload.text,
        entities: payload.entities || []
      };
      messages.push(message);
      return ok(message);
    }

    case 'getFile': {
      const entry = files.get(payload.file_id) || files.get(sampleFileId);
      if (!entry) return fail(400, 'Bad Request: file not found');
      return ok({
        file_id: payload.file_id,
        file_size: entry.content.length,
        file_path: entry.file_path
      });
    }

    case 'deleteMessage': {
      const idx = messages.findIndex(
        (m) => m.message_id === payload.message_id && String(m.chatId) === String(payload.chat_id)
      );
      if (idx === -1) return fail(400, 'Bad Request: message to delete not found');
      messages.splice(idx, 1);
      return ok(true);
    }

    case 'answerCallbackQuery':
    case 'deleteWebhook':
    case 'setWebhook':
      return ok(true);

    case 'getUpdates':
      return ok([]);

    default:
      return fail(404, `Not Found: method ${method}`);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[fake-tg] listening on http://0.0.0.0:${PORT}`);
  console.log(`[fake-tg] sample .md file id: ${sampleFileId}`);
  console.log('[fake-tg] demo channel: @postora_demo_channel');
});
