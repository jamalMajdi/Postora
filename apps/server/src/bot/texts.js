import { ErrorCode, getUserMessage } from '@postora/shared';

/**
 * نصوص البوت (عربي/إنجليزي).
 * كل الرسائل مُعرّفة هنا — لا نصوص مبعثرة داخل المعالجات.
 */

export const BotTexts = {
  start: {
    ar: (botUsername, miniappUrl) => `👋 مرحبًا بك في **Postora**

Postora نظام احترافي لنشر المقالات في قنوات تلجرام انطلاقًا من ملفات Markdown.

**كيف تبدأ؟**
1️⃣ أضف البوت \`@${botUsername}\` كمسؤول في قناتك.
2️⃣ اربط القناة من التطبيق المصغر (أو استخدم /channels للتحقق).
3️⃣ أرسل لي ملفًا بصيغة \`.md\` وسأجهّز المعاينة قبل النشر.
4️⃣ راجع المعاينة ثم اضغط "✅ تأكيد النشر".

${miniappUrl ? '🚀 يمكنك أيضًا كتابة المقال ونشره من التطبيق المصغر عبر زر الأسفل.' : ''}

استخدم /help لعرض جميع الأوامر.`,
    en: (botUsername, miniappUrl) => `👋 Welcome to **Postora**

Postora is a professional system for publishing Markdown articles to Telegram channels.

**Getting started**
1️⃣ Add \`@${botUsername}\` as an administrator in your channel.
2️⃣ Connect the channel from the Mini App (or use /channels to verify).
3️⃣ Send me a \`.md\` file and I will prepare a preview before publishing.
4️⃣ Review the preview, then press "✅ Confirm publish".

${miniappUrl ? '🚀 You can also write and publish from the Mini App using the button below.' : ''}

Use /help to see all commands.`
  },

  help: {
    ar: `📚 **أوامر Postora**

/start — رسالة الترحيب
/help — هذه القائمة
/channels — عرض قنواتك المرتبطة وحالة صلاحيات البوت
/cancel — إلغاء آخر عملية معاينة/نشر معلّقة
/status — حالة آخر عملية نشر
/language — تبديل اللغة (عربي/إنجليزي)

**إرسال مقال:** أرسل ملفًا بصيغة \`.md\` (UTF-8، حتى 256 كيلوبايت).

**التنسيقات المدعومة في تلجرام:** العريض، المائل، المشطوب، الكود، الكود المتعدد الأسطر، الروابط، الاقتباسات.
**غير مدعوم:** العناوين، القوائم، الجداول، الصور — تُحوَّل تلقائيًا إلى أقرب شكل مدعوم مع تنبيهك في المعاينة.`,
    en: `📚 **Postora commands**

/start — welcome message
/help — this list
/channels — your connected channels and bot permissions
/cancel — cancel the pending preview/publish
/status — status of your last publication
/language — switch language (Arabic/English)

**Sending an article:** send a \`.md\` file (UTF-8, up to 256 KB).

**Formatting supported by Telegram:** bold, italic, strikethrough, inline code, code blocks, links, blockquotes.
**Not supported:** headings, lists, tables, images — they are converted to the closest supported form and flagged in the preview.`
  },

  noChannels: {
    ar: `⚠️ لا توجد قنوات مرتبطة بعد.

**لربط قناة:**
1. أضف \`@%BOT%\` كمسؤول في قناتك مع صلاحية "نشر الرسائل".
2. افتح التطبيق المصغر واختر "إضافة قناة".
3. أدخل معرّف القناة مثل \`@my_channel\` أو \`-1001234567890\`.`,
    en: `⚠️ No channels connected yet.

**To connect a channel:**
1. Add \`@%BOT%\` as an administrator with "Post messages" permission.
2. Open the Mini App and choose "Add channel".
3. Enter the channel handle like \`@my_channel\` or \`-1001234567890\`.`
  },

  channelsList: {
    ar: (channels) =>
      `📢 **قنواتك المرتبطة (${channels.length})**\n\n` +
      channels
        .map((c, i) => {
          const perm = c.bot_can_post
            ? '✅ البوت يستطيع النشر'
            : c.bot_is_admin
              ? '⚠️ البوت مسؤول لكن بلا صلاحية نشر'
              : '❌ البوت ليس مسؤولًا';
          return `${i + 1}. ${c.title}${c.username ? ` (@${c.username})` : ''}\n   ${perm}`;
        })
        .join('\n\n'),
    en: (channels) =>
      `📢 **Your channels (${channels.length})**\n\n` +
      channels
        .map((c, i) => {
          const perm = c.bot_can_post
            ? '✅ bot can post'
            : c.bot_is_admin
              ? '⚠️ bot is admin but cannot post'
              : '❌ bot is not admin';
          return `${i + 1}. ${c.title}${c.username ? ` (@${c.username})` : ''}\n   ${perm}`;
        })
        .join('\n\n')
  },

  fileReceived: {
    ar: (name) => `📄 استلمت الملف: **${name}**
جارٍ التحويل والمعاينة…`,
    en: (name) => `📄 Received: **${name}**
Converting and preparing the preview…`
  },

  previewHeader: {
    ar: `🔎 **معاينة المنشور** — هذه هي الرسائل كما ستظهر في القناة بالضبط:`,
    en: `🔎 **Post preview** — exactly how the messages will appear in the channel:`
  },

  previewFooter: {
    ar: (channelTitle) => `📢 القناة المستهدفة: **${channelTitle}**`,
    en: (channelTitle) => `📢 Target channel: **${channelTitle}**`
  },

  warningsHeader: {
    ar: '⚠️ **تنبيهات التنسيق:**',
    en: '⚠️ **Formatting notes:**'
  },

  confirmPrompt: {
    ar: 'هل تريد النشر في القناة الآن؟',
    en: 'Do you want to publish to the channel now?'
  },

  selectChannel: {
    ar: '📢 اختر القناة المستهدفة:',
    en: '📢 Choose the target channel:'
  },

  publishing: {
    ar: '⏳ جارٍ النشر…',
    en: '⏳ Publishing…'
  },

  published: {
    ar: (count, title) =>
      `✅ **تم النشر بنجاح**
📢 القناة: ${title}
📨 عدد الرسائل: ${count}`,
    en: (count, title) =>
      `✅ **Published successfully**
📢 Channel: ${title}
📨 Messages: ${count}`
  },

  cancelled: {
    ar: '❌ تم إلغاء النشر. لم يُنشر أي شيء.',
    en: '❌ Publishing cancelled. Nothing was published.'
  },

  expired: {
    ar: '⌛ انتهت صلاحية هذه المعاينة أو تمت معالجتها. أرسل الملف مرة أخرى.',
    en: '⌛ This preview expired or was already processed. Please send the file again.'
  },

  emptyFile: {
    ar: '⚠️ الملف فارغ أو لا يحتوي نصًا.',
    en: '⚠️ The file is empty or contains no text.'
  },

  noCancellable: {
    ar: 'لا توجد عملية معلّقة لإلغائها.',
    en: 'There is no pending operation to cancel.'
  },

  statusNone: {
    ar: 'لا توجد عمليات نشر سابقة.',
    en: 'No previous publications.'
  },

  languageChanged: {
    ar: '✔️ تم تعيين اللغة إلى العربية.',
    en: '✔️ Language set to English.'
  },

  sendFileOnly: {
    ar: '📎 أرسل ملفًا بصيغة `.md` فقط، أو استخدم التطبيق المصغر لكتابة المقال.',
    en: '📎 Send a `.md` file only, or use the Mini App to write your article.'
  },

  duplicateWarning: {
    ar: `⚠️ **تنبيه: نفس المحتوى نُشر في هذه القناة قبل قليل.**

إن كنت متأكدًا من رغبتك في نشره مرة أخرى، اضغط "تأكيد النشر المكرر".`,
    en: `⚠️ **Heads up: the same content was published to this channel recently.**

If you really want to publish it again, press "Confirm duplicate publish".`
  }
};

/** @param {'ar'|'en'} locale */
export function t(key, locale = 'ar') {
  const entry = BotTexts[key];
  if (!entry) return key;
  return entry[locale] ?? entry.ar;
}

/** رسالة خطأ جاهزة للمستخدم. */
export function errorText(code, locale = 'ar') {
  return `⛔ ${getUserMessage(code, locale)}`;
}

export function localeOf(user) {
  return user?.preferred_locale === 'en' ? 'en' : 'ar';
}

export { ErrorCode };
export { getUserMessage as userMessage } from '@postora/shared';
