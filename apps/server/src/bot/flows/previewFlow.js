import { Markup } from 'telegraf';
import { BotTexts, errorText, localeOf } from '../texts.js';
import { ErrorCode } from '@postora/shared';
import { validateDocumentMetadata, decodeMarkdownBuffer, downloadTelegramFile } from '../../files/markdownFile.js';
import { renderMarkdown, describeRenderSummary } from '../../services/renderService.js';

/**
 * تدفق معاينة البوت:
 *   ملف .md → تحقق → تحميل → ترميز → تحويل → **رسائل تلجرام حقيقية في الخاص** → أزرار.
 *
 * قرار D4: المعاينة هي نفس الرسائل التي ستُنشر (نفس المحرك، نفس الكيانات).
 * حالة كل مستخدم محفوظة في الذاكرة أثناء تدفق المعاينة (previewFlow)،
 * وطلب النشر الفعلي يُنشأ في قاعدة البيانات فقط عند التأكيد.
 */

/** حالة تدفق المعاينة لكل مستخدم (ذاكرة قصيرة العمر). */
const previewStates = new Map();

/**
 * حالة المعاينة مفتاحها معرّف تلجرام للمستخدم (وليس UUID الداخلي)
 * لأنها تُقرأ في مسار callbackQuery حيث قد لا يكون سجل المستخدم محمّلًا بعد.
 */
export function getPreviewState(userTelegramId) {
  return previewStates.get(String(userTelegramId)) || null;
}

export function setPreviewState(userTelegramId, state) {
  previewStates.set(String(userTelegramId), state);
}

export function clearPreviewState(userTelegramId) {
  previewStates.delete(String(userTelegramId));
}

export function registerPreviewFlow(bot, deps) {
  /* --------------------------- استقبال المستند --------------------------- */
  bot.on('document', async (ctx) => {
    const locale = localeOf(ctx.state.user);
    const document = ctx.message.document;

    validateDocumentMetadata(document, {
      maxBytes: deps.config.limits.maxUploadBytes
    });

    await ctx.reply(BotTexts.fileReceived[locale](document.file_name || 'document.md'));

    const buffer = await downloadTelegramFile(deps.gateway, document.file_id, {
      maxBytes: deps.config.limits.maxUploadBytes
    });

    const markdown = decodeMarkdownBuffer(buffer, {
      maxBytes: deps.config.limits.maxUploadBytes,
      maxChars: deps.config.limits.maxContentChars
    });

    const rendered = renderMarkdown(markdown, {
      maxMessages: deps.config.limits.maxPublishMessages,
      maxContentChars: deps.config.limits.maxContentChars
    });

    if (rendered.messages.length === 0) {
      return ctx.reply(BotTexts.emptyFile[locale]);
    }

    // اختيار القناة
    const channels = await deps.channelService.listChannels(ctx.state.user.id);
    if (channels.length === 0) {
      return ctx.reply(BotTexts.noChannels[locale].replace('%BOT%', deps.config.bot.username), {
        parse_mode: 'Markdown'
      });
    }

    const state = {
      markdown,
      rendered,
      channels,
      channelId: channels.length === 1 ? channels[0].id : null,
      fileName: document.file_name,
      createdAt: Date.now()
    };
    setPreviewState(ctx.state.user.telegram_user_id, state);

    if (channels.length === 1) {
      return sendPreview(ctx, deps, state, channels[0], locale);
    }

    // أكثر من قناة → نطلب الاختيار أولًا
    const rows = channels.map((channel) => [
      Markup.button.callback(channel.title.slice(0, 40), `sel:channel:${channel.id}`)
    ]);
    rows.push([Markup.button.callback(locale === 'ar' ? '❌ إلغاء' : '❌ Cancel', 'sel:cancel')]);

    return ctx.reply(BotTexts.selectChannel[locale], Markup.inlineKeyboard(rows));
  });

  /* ------------------------------ اختيار قناة ---------------------------- */
  bot.action(/^sel:channel:(.+)$/, async (ctx) => {
    const locale = localeOf(ctx.state.user);
    const channelId = ctx.match[1];
    const state = getPreviewState(ctx.state.user.telegram_user_id);

    await ctx.answerCbQuery();

    if (!state) {
      return ctx.reply(BotTexts.expired[locale]);
    }

    const channel = state.channels.find((c) => c.id === channelId);
    if (!channel) {
      return ctx.reply(errorText(ErrorCode.CHANNEL_NOT_OWNED, locale));
    }

    state.channelId = channelId;
    return sendPreview(ctx, deps, state, channel, locale);
  });

  bot.action('sel:cancel', async (ctx) => {
    const locale = localeOf(ctx.state.user);
    clearPreviewState(ctx.state.user.telegram_user_id);
    await ctx.answerCbQuery();
    return ctx.reply(BotTexts.cancelled[locale]);
  });
}

/**
 * يرسل المعاينة كرسائل تلجرام حقيقية ثم أزرار التأكيد.
 */
export async function sendPreview(ctx, deps, state, channel, locale) {
  const header = [
    BotTexts.previewHeader[locale],
    describeRenderSummary(state.rendered, locale),
    BotTexts.previewFooter[locale](channel.title)
  ].join('\n\n');

  await ctx.reply(header, {
    parse_mode: 'Markdown',
    link_preview_options: { is_disabled: true }
  });

  // إرسال الرسائل كما ستظهر فعليًا في القناة
  for (const message of state.rendered.messages) {
    await ctx.reply(message.text, {
      entities: message.entities,
      link_preview_options: { is_disabled: true }
    });
  }

  // تحذيرات التنسيق
  if (state.rendered.warnings.length > 0) {
    const list = state.rendered.warnings
      .map((warning) => `• ${locale === 'ar' ? warning.messageAr : warning.messageEn}`)
      .join('\n');
    await ctx.reply(`${BotTexts.warningsHeader[locale]}\n${list}`, {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true }
    });
  }

  // ملاحظة: طلب النشر يُنشأ عند التأكيد فقط، لذا نضع علامة على الحالة
  state.stage = 'awaiting_confirmation';

  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback(
      locale === 'ar' ? '✅ تأكيد النشر' : '✅ Confirm publish',
      `flow:confirm`
    ),
    Markup.button.callback(locale === 'ar' ? '❌ إلغاء' : '❌ Cancel', `flow:cancel`)
  ]);

  return ctx.reply(BotTexts.confirmPrompt[locale], keyboard);
}
