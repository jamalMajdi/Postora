/**
 * يتحقق من تطابق معاينة Mini App مع ما يعيده تلجرام الحقيقي.
 * يقارن: النص، الكيانات، وHTML المعاينة مقابل رد sendMessage.
 */
import { renderToTelegram } from '@postora/markdown-engine';
import { entitiesToPreviewHtml } from '../apps/miniapp/src/lib/markdown.js';

const TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
// يُسمح بعنوان بديل (المحاكي المحلي) عبر TELEGRAM_API_BASE — للاختبار فقط.
// الإعداد الافتراضي هو تلجرام الحقيقي ولا يُغيَّر في الإنتاج.
const API = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';
if (!TOKEN || !CHANNEL_ID) { console.error('مطلوب BOT_TOKEN و CHANNEL_ID'); process.exit(1); }

const SAMPLES = {
  'عناوين وتنسيقات': '# عنوان\n## عنوان فرعي\n\n**عريض** و *مائل* و ~~مشطوب~~ و `كود`',
  'اقتباس وقوائم': '> اقتباس أول\n> اقتباس ثانٍ\n\n- عنصر\n- عنصر\n\n1. خطوة\n2. خطوة',
  'رابط وصورة': '[رابط](https://example.com)\n\n![صورة](https://example.com/p.png)',
  'كود': '```js\nconst x = 1;\nconsole.log(x);\n```',
  'نص طويل مقسم': Array.from({length:30},(_,i)=>`## القسم ${i+1}\n\nفقرة تجريبية **عريض** رقم ${i+1} فيها نص كافٍ للاختبار الكامل.`).join('\n\n')
};

const call = async (method, payload) => {
  const res = await fetch(`${API}/bot${TOKEN}/${method}`, {
    method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(payload)
  });
  return res.json();
};

let pass=0, fail=0;
const check=(n,ok,d='')=>{ ok?(pass++):(fail++); console.log(`  ${ok?'✅':'❌'} ${n}${d?' — '+d:''}`); };

console.log('=== تحقق تطابق المعاينة مع تلجرام الحقيقي ===\n');

for (const [name, md] of Object.entries(SAMPLES)) {
  console.log(`--- ${name} ---`);
  const preview = renderToTelegram(md, { maxMessages: 40 });

  for (let i = 0; i < preview.messages.length; i++) {
    const message = preview.messages[i];
    const sent = await call('sendMessage', {
      chat_id: CHANNEL_ID,
      text: message.text,
      entities: message.entities,
      // نفس إعداد Postora الحقيقي: بطاقة الرابط معطّلة
      link_preview_options: { is_disabled: true }
    });

    if (!sent.ok) { check(`رسالة ${i+1} مقبولة من تلجرام`, false, sent.description); continue; }

    const returned = sent.result;
    const textMatch = returned.text === message.text;
    check(`رسالة ${i+1}/${preview.messages.length} — النص مطابق`, textMatch,
      textMatch ? `${returned.text.length} محرف` : `تلجرام=${returned.text.length} محلي=${message.text.length}`);

    // تلجرام يعيد الكيانات بترتيب/تطبيع مختلف قليلًا — نقارن المجموعة
    const norm = (arr) => (arr||[]).map(e => `${e.type}@${e.offset}+${e.length}`).sort().join(',');
    const entMatch = norm(returned.entities) === norm(message.entities);
    check(`رسالة ${i+1} — الكيانات مطابقة`, entMatch,
      entMatch ? `${(returned.entities||[]).length} كيان` : `تلجرام=${norm(returned.entities)} | محلي=${norm(message.entities)}`);

    // HTML المعاينة مقابل HTML المحرك (بنيويًا: نفس الوسوم)
    const previewHtml = entitiesToPreviewHtml(message.text, message.entities);
    const tags = (h) => (h.match(/<\/?(b|i|s|code|pre|a)\b/g)||[]).sort().join(',');
    check(`رسالة ${i+1} — بنية HTML للمعاينة`, tags(previewHtml) === tags(message.html),
      tags(previewHtml) === tags(message.html) ? 'مطابقة' : `معاينة=${tags(previewHtml)} | محرك=${tags(message.html)}`);

    // تنظيف القناة
    await call('deleteMessage', { chat_id: CHANNEL_ID, message_id: returned.message_id });
    await new Promise(r => setTimeout(r, 1200));
  }
  console.log('');
}

console.log(`\nالنتيجة: ✅ ${pass} ناجح  ❌ ${fail} فاشل`);
process.exit(fail === 0 ? 0 : 1);
