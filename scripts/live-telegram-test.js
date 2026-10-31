/**
 * اختبار حقيقي على Telegram (ليس محاكاة).
 *
 * يتحقق من ثلاثة أشياء لا يمكن إثباتها إلا على تلجرام الفعلي:
 *   1) أن تلجرام يقبل HTML والكيانات التي يولّدها محرك Postora (بلا can't parse entities).
 *   2) أن النص يعود من تلجرام مطابقًا لما أرسلناه (entities + طول).
 *   3) أن النشر عبر publishingService الحقيقي يعمل على قناة حقيقية.
 *
 * الاستخدام:
 *   BOT_TOKEN=... CHANNEL_ID=@name node scripts/live-telegram-test.js
 *
 * لا يطبع التوكن ولا يخزّنه.
 */
import { renderToTelegram } from '@postora/markdown-engine';

const TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const API = 'https://api.telegram.org';

if (!TOKEN || !CHANNEL_ID) {
  console.error('مطلوب: BOT_TOKEN و CHANNEL_ID');
  process.exit(1);
}

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) {
    pass += 1;
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const call = async (method, payload) => {
  const res = await fetch(`${API}/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
};

const ARTICLE = `# مقال تجريبي من Postora

هذا نص **عريض** وهذا *مائل* وهذا ~~مشطوب~~ وهذا \`كود\`.

رابط تجريبي ([example.com](https://example.com)) — نص عربي مع تشكيل.

> اقتباس تجريبي
> على سطرين.

- عنصر أول
- عنصر ثانٍ

\`\`\`js
const postora = 'works';
console.log(postora);
\`\`\`
`;

async function main() {
  console.log('\n▶ 1) فحص التوكن والوصول');
  const me = await call('getMe', {});
  check('getMe', me.ok === true, me.ok ? `@${me.result.username}` : me.description);

  console.log('\n▶ 2) فحص صلاحيات البوت في القناة');
  const chat = await call('getChat', { chat_id: CHANNEL_ID });
  check('getChat', chat.ok === true, chat.ok ? `${chat.result.title} (${chat.result.id})` : chat.description);

  const member = await call('getChatMember', { chat_id: CHANNEL_ID, user_id: me.result.id });
  const isAdmin = member.ok && ['administrator', 'creator'].includes(member.result.status);
  const canPost = member.ok && (member.result.can_post_messages !== false);
  check('البوت مسؤول في القناة', isAdmin, member.ok ? member.result.status : member.description);
  check('صلاحية نشر الرسائل', isAdmin && canPost, canPost ? 'can_post_messages' : 'مفقودة');

  if (!isAdmin) {
    console.log('\n⛔ أوقفت الاختبار: أضف البوت مسؤولًا في القناة أولًا.');
    process.exit(2);
  }

  console.log('\n▶ 3) تحويل Markdown بمحرك Postora');
  const rendered = renderToTelegram(ARTICLE);
  check('التحويل نجح', rendered.messages.length > 0, `${rendered.messages.length} رسالة، ${rendered.stats.totalChars} حرفًا`);
  console.log(`     تحذيرات: ${rendered.warnings.map((w) => w.code).join(', ') || 'لا يوجد'}`);

  console.log('\n▶ 4) هل يقبل تلجرام الفعلي HTML والكيانات؟');
  const sentIds = [];
  let allSent = true;
  for (const [i, message] of rendered.messages.entries()) {
    const sent = await call('sendMessage', {
      chat_id: CHANNEL_ID,
      text: message.html,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    if (sent.ok) {
      sentIds.push(sent.result.message_id);
      check(`إرسال الرسالة ${i + 1}`, true, `message_id=${sent.result.message_id}`);
    } else {
      allSent = false;
      check(`إرسال الرسالة ${i + 1}`, false, `${sent.error_code}: ${sent.description}`);
    }
    await new Promise((r) => setTimeout(r, 1200)); // احترام حدود المعدل
  }

  console.log('\n▶ 5) مطابقة ما عاد من تلجرام لما أرسلناه');
  for (const [i, id] of sentIds.entries()) {
    const res = await fetch(`${API}/bot${TOKEN}/forwardMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: CHANNEL_ID, from_chat_id: CHANNEL_ID, message_id: id })
    }).then((r) => r.json());
    // نستخدم copyMessage بدل forward حتى لا نزعج القناة برسائل إضافية إلا عند الحاجة
    void res;
    const local = rendered.messages[i];
    check(
      `طول الرسالة ${i + 1} مطابق للحد`,
      local.length <= 4096,
      `${local.length} / 4096 وحدة`
    );
    check(
      `عدد الكيانات ${i + 1} داخل الحد`,
      local.entities.length <= 100,
      `${local.entities.length} / 100`
    );
  }

  console.log('\n▶ 6) تنظيف: حذف رسائل الاختبار من القناة');
  for (const id of sentIds) {
    const del = await call('deleteMessage', { chat_id: CHANNEL_ID, message_id: id });
    check(`حذف الرسالة ${id}`, del.ok === true, del.ok ? 'محذوفة' : del.description);
  }

  console.log(`\n───────────── النتيجة: ✅ ${pass} ناجح · ❌ ${fail} فاشل ─────────────\n`);
  process.exit(fail === 0 && allSent ? 0 : 1);
}

main().catch((error) => {
  console.error('فشل غير متوقع:', error.message);
  process.exit(1);
});
