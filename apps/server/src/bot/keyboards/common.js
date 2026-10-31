import { Markup } from 'telegraf';

/**
 * لوحات الأزرار.
 * كل callback_data تحمل معرّف طلب النشر حتى نتحقق من حالته في قاعدة البيانات
 * (peventing replay للأزرار القديمة).
 */

export function confirmKeyboard(publicationId, locale = 'ar') {
  const confirmText = locale === 'ar' ? '✅ تأكيد النشر' : '✅ Confirm publish';
  const cancelText = locale === 'ar' ? '❌ إلغاء' : '❌ Cancel';

  return Markup.inlineKeyboard([
    Markup.button.callback(confirmText, `pub:confirm:${publicationId}`),
    Markup.button.callback(cancelText, `pub:cancel:${publicationId}`)
  ]);
}

export function channelSelectionKeyboard(channels, publicationId, locale = 'ar') {
  const title = locale === 'ar' ? 'اختر القناة المستهدفة:' : 'Choose the target channel:';
  const buttons = channels.map((channel) =>
    Markup.button.callback(
      channel.title.slice(0, 40),
      `pub:channel:${publicationId}:${channel.id}`
    )
  );

  // صفّان لكل سطر
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  return { text: title, keyboard: Markup.inlineKeyboard(rows) };
}

export function openMiniAppKeyboard(miniappUrl, locale = 'ar') {
  if (!miniappUrl || !/^https:\/\//.test(miniappUrl)) return null;
  const text = locale === 'ar' ? '🚀 فتح Postora' : '🚀 Open Postora';
  return Markup.inlineKeyboard([[Markup.button.webApp(text, miniappUrl)]]);
}
