import http from 'node:http';
import { randomUUID } from 'node:crypto';

/**
 * خادم تلجرام وهمي (Fake Telegram Bot API).
 *
 * الغرض: اختبار البوت فعليًا داخل بيئة التطوير بلا أي بيانات اعتماد حقيقية.
 * يحاكي:
 *   getMe, getChat, getChatMember, sendMessage, getFile, deleteWebhook, setWebhook, getUpdates
 * ويوفّر متحكمًا (controller) لضبط النتائج وسلوك الأخطاء (403/429/400) في الاختبارات.
 *
 * ملاحظة: هذا ملف اختبار فقط — لا يُستخدم في التشغيل العادي.
 */
export function createFakeTelegram({ token = '123456:TEST_TOKEN_NOT_REAL' } = {}) {
  const state = {
    token,
    botId: 999000111,
    botUsername: 'Postora_1bot',
    chats: new Map(),
    members: new Map(), // key: `${chatId}:${userId}` → {status, can_post_messages}
    messages: [], // {chatId, text, entities}
    updates: [],
    files: new Map(), // file_id → { file_path, content: Buffer }
    calls: [],
    behave: {
      rateLimitOnce: false,
      forbiddenOnSend: false,
      parseErrorOnSend: false,
      failDownload: false
    }
  };

  /** يعرّف قناة مع عضوية مستخدم/بوت. */
  function setChannel({ chatId, title, username = null, type = 'channel', botStatus = 'administrator', botCanPost = true, userStatusById = {} }) {
    state.chats.set(String(chatId), {
      id: Number(chatId),
      type,
      title,
      username,
      is_forum: false
    });
    state.members.set(`${chatId}:${state.botId}`, {
      status: botStatus,
      can_post_messages: botCanPost,
      can_send_messages: botCanPost
    });
    for (const [userId, status] of Object.entries(userStatusById)) {
      state.members.set(`${chatId}:${userId}`, { status });
    }
    return state.chats.get(String(chatId));
  }

  function addFile({ content, fileName = 'article.md' }) {
    const fileId = `file_${randomUUID()}`;
    const filePath = `documents/${fileId}.md`;
    state.files.set(fileId, { file_path: filePath, content: Buffer.from(content) });
    void fileName;
    return { fileId, filePath };
  }

  function lastMessage() {
    return state.messages[state.messages.length - 1];
  }

  function messagesFor(chatId) {
    return state.messages.filter((m) => String(m.chatId) === String(chatId));
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    // تحميل ملف: /file/bot<token>/<file_path>
    if (url.pathname.startsWith('/file/bot')) {
      const filePath = decodeURIComponent(url.pathname.split('/').slice(3).join('/'));
      if (state.behave.failDownload) {
        res.writeHead(404).end('not found');
        return;
      }
      const entry = [...state.files.values()].find((f) => f.file_path === filePath);
      if (!entry) {
        res.writeHead(404).end('file not found');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      res.end(entry.content);
      return;
    }

    if (!url.pathname.startsWith('/bot')) {
      res.writeHead(404).end('not found');
      return;
    }

    // المسار: /bot<token>/<method> — نستخرج اسم الطريقة بأمان
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

    state.calls.push({ method, payload });

    const reply = (status, data) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    const ok = (result) => reply(200, { ok: true, result });
    const fail = (code, description, parameters) =>
      reply(code, { ok: false, error_code: code, description, parameters });

    switch (method) {
      case 'getMe':
        return ok({
          id: state.botId,
          is_bot: true,
          first_name: 'Postora',
          username: state.botUsername
        });

      case 'getChat': {
        // يحاكي تلجرام: يقبل المعرف الرقمي أو @username
        const ref = String(payload.chat_id);
        let chat = state.chats.get(ref);
        if (!chat && ref.startsWith('@')) {
          const handle = ref.slice(1).toLowerCase();
          chat = [...state.chats.values()].find(
            (c) => String(c.username || '').toLowerCase() === handle
          );
        }
        if (!chat) return fail(400, 'Bad Request: chat not found');
        return ok(chat);
      }

      case 'getChatMember': {
        let member = state.members.get(`${payload.chat_id}:${payload.user_id}`);
        if (!member && String(payload.chat_id).startsWith('@')) {
          const handle = String(payload.chat_id).slice(1).toLowerCase();
          const chat = [...state.chats.values()].find(
            (c) => String(c.username || '').toLowerCase() === handle
          );
          if (chat) member = state.members.get(`${chat.id}:${payload.user_id}`);
        }
        if (!member) return fail(400, 'Bad Request: user not found');
        return ok({ user: { id: Number(payload.user_id) }, ...member });
      }

      case 'sendMessage': {
        if (state.behave.forbiddenOnSend) {
          return fail(403, 'Forbidden: bot is not a member of the channel chat');
        }
        if (state.behave.parseErrorOnSend) {
          return fail(400, "Bad Request: can't parse entities: unexpected end tag");
        }
        if (state.behave.rateLimitOnce) {
          state.behave.rateLimitOnce = false;
          return fail(429, 'Too Many Requests: retry after 1', { retry_after: 1 });
        }
        if (typeof payload.text !== 'string' || payload.text.length === 0) {
          return fail(400, 'Bad Request: message text is empty');
        }
        if (payload.text.length > 4096) {
          return fail(400, 'Bad Request: message is too long');
        }

        const message = {
          message_id: state.messages.length + 1,
          chatId: payload.chat_id,
          text: payload.text,
          entities: payload.entities || [],
          replyMarkup: payload.reply_markup || null,
          date: Math.floor(Date.now() / 1000)
        };
        state.messages.push(message);
        return ok({
          message_id: message.message_id,
          date: message.date,
          chat: { id: Number(payload.chat_id) },
          text: payload.text
        });
      }

      case 'getFile': {
        const entry = state.files.get(payload.file_id);
        if (!entry) return fail(400, 'Bad Request: file not found');
        return ok({
          file_id: payload.file_id,
          file_size: entry.content.length,
          file_path: entry.file_path
        });
      }

      case 'answerCallbackQuery':
        return ok(true);

      case 'editMessageText': {
        const target = state.messages.find((m) => m.message_id === payload.message_id);
        if (!target) return fail(400, 'Bad Request: message to edit not found');
        target.text = payload.text;
        target.entities = payload.entities || [];
        return ok({ message_id: target.message_id, text: target.text });
      }

      case 'deleteMessage': {
        const idx = state.messages.findIndex(
          (m) => m.message_id === payload.message_id && String(m.chatId) === String(payload.chat_id)
        );
        if (idx === -1) return fail(400, 'Bad Request: message to delete not found');
        state.messages.splice(idx, 1);
        return ok(true);
      }

      case 'deleteWebhook':
      case 'setWebhook':
        return ok(true);

      case 'getUpdates':
        return ok([]);

      default:
        return fail(404, `Not Found: method ${method} not implemented in fake server`);
    }
  });

  return {
    state,
    setChannel,
    addFile,
    lastMessage,
    messagesFor,
    listen(port = 0) {
      return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => {
          const address = server.address();
          resolve(`http://127.0.0.1:${address.port}`);
        });
      });
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
    reset() {
      state.messages.length = 0;
      state.calls.length = 0;
      state.behave.rateLimitOnce = false;
      state.behave.forbiddenOnSend = false;
      state.behave.parseErrorOnSend = false;
      state.behave.failDownload = false;
    }
  };
}
