import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '@postora/shared';
import { normalizeTelegramError } from './errors.js';
import { TelegramRateLimiter, backoffDelay, sleep } from './rateLimiter.js';

/**
 * بوابة تلجرام: الطبقة الوحيدة التي تكلّم Bot API.
 *
 * المسؤوليات:
 *  - توجيه الطلبات إلى api.telegram.org (أو خادم وهمي في الاختبارات عبر TELEGRAM_API_BASE_URL).
 *  - حدّ معدل داخلي + backoff عند 429.
 *  - تحويل أخطاء تلجرام إلى رموز داخلية.
 *  - عدم تسريب التوكن في أي رسالة خطأ أو سجل.
 *
 * لا تحتوي هذه الطبقة أي منطق عمل (تنسيق/صلاحيات قرار) — ذلك في services/.
 */
export class TelegramGateway {
  /**
   * @param {{token: string, apiBaseUrl?: string, fetchImpl?: typeof fetch, logger?: any, limiter?: TelegramRateLimiter}} options
   */
  constructor(options) {
    this.token = options.token;
    this.apiBaseUrl = (options.apiBaseUrl || 'https://api.telegram.org').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.logger = options.logger || console;
    this.limiter =
      options.limiter ||
      new TelegramRateLimiter({
        globalPerSecond: options.globalPerSecond ?? 25,
        perChatPerMinute: options.perChatPerMinute ?? 18
      });
  }

  /** مسار URL لطريقة في Bot API (بدون تسريب التوكن في السجلات). */
  #url(method) {
    return `${this.apiBaseUrl}/bot${this.token}/${method}`;
  }

  /**
   * نداء منخفض المستوى لطريقة Bot API.
   * @param {string} method
   * @param {object} payload
   * @param {{chatKey?: string, timeoutMs?: number, maxRetries?: number}} [options]
   * @returns {Promise<any>} result من تلجرام
   */
  async call(method, payload = {}, options = {}) {
    const chatKey = options.chatKey || 'global';
    const maxRetries = options.maxRetries ?? 2;
    const timeoutMs = options.timeoutMs ?? 20_000;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
      await this.limiter.acquire(chatKey);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await this.fetchImpl(this.#url(method), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.ok) {
          return data.result;
        }

        const normalized = normalizeTelegramError({
          response: data.error_code ? data : { error_code: response.status, description: data.description }
        });

        // 429: انتظر ثم أعد المحاولة
        if (normalized.code === ErrorCode.TELEGRAM_RATE_LIMITED && attempt <= maxRetries) {
          const retryAfter = normalized.retryAfter ?? backoffDelay(attempt);
          this.limiter.penalize(chatKey, retryAfter);
          this.logger.warn?.(
            { method, attempt, retryAfter },
            '[telegram] rate limited — backing off'
          );
          await sleep(Math.min(retryAfter * 1000, 15_000));
          continue;
        }

        throw new AppError(normalized.code, {
          internalMessage: `Telegram ${method} failed: ${normalized.telegramMessage}`,
          details: { method, ...normalized }
        });
      } catch (error) {
        if (error instanceof AppError) throw error;

        const isAbort = error?.name === 'AbortError';
        const isNetwork = /fetch failed|ECONNRESET|ENOTFOUND|ETIMEDOUT|network/i.test(
          String(error?.message || '')
        );

        if ((isAbort || isNetwork) && attempt <= maxRetries) {
          const delay = backoffDelay(attempt);
          this.logger.warn?.({ method, attempt, delay, reason: isAbort ? 'timeout' : 'network' }, '[telegram] retrying');
          await sleep(delay);
          continue;
        }

        throw new AppError(ErrorCode.PUBLISH_FAILED, {
          internalMessage: `Telegram ${method} network error: ${error?.message}`,
          cause: error
        });
      } finally {
        clearTimeout(timer);
      }
    }

    throw new AppError(ErrorCode.PUBLISH_FAILED, {
      internalMessage: `Telegram ${method} exhausted retries`
    });
  }

  /* ------------------------------ طرق مختصرة ------------------------------ */

  getMe() {
    return this.call('getMe');
  }

  getChat(chatId) {
    return this.call('getChat', { chat_id: chatId });
  }

  getChatMember(chatId, userId) {
    return this.call('getChatMember', { chat_id: chatId, user_id: userId });
  }

  /**
   * إرسال رسالة من مخرجات المحرك (نص + كيانات).
   * نستخدم entities بدل parse_mode=HTML لأنها أدق وأكثر أمانًا (لا هروب، لا وسم مفتوح).
   */
  sendRenderedMessage(chatId, message, options = {}) {
    return this.call(
      'sendMessage',
      {
        chat_id: chatId,
        text: message.text,
        entities: message.entities,
        link_preview_options: options.disablePreview ? { is_disabled: true } : undefined
      },
      { chatKey: String(chatId) }
    );
  }

  /** إرسال نص عادي (للرسائل الإدارية للبوت). */
  sendPlainMessage(chatId, text, extra = {}) {
    return this.call(
      'sendMessage',
      { chat_id: chatId, text, ...extra },
      { chatKey: String(chatId) }
    );
  }

  /** للاستخدام في الاختبارات/الفحص: هل الاتصال بالتوكن صالح؟ */
  async verifyToken() {
    const me = await this.getMe();
    return { id: me.id, username: me.username, isBot: me.is_bot };
  }
}

/** إنشاء بوابة من الإعدادات. */
export function createGatewayFromConfig(config, logger) {
  return new TelegramGateway({
    token: config.bot.token,
    apiBaseUrl: config.bot.apiBaseUrl,
    logger
  });
}
