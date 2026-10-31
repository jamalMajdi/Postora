/**
 * @postora/markdown-engine
 *
 * محرك تحويل Markdown → رسائل Telegram.
 * حزمة نقية: لا I/O، لا شبكة، لا قاعدة بيانات، لا معرفة بـ Telegraf/Express.
 * تعمل بنفس النتيجة في Node.js وفي المتصفح.
 *
 * خط الأنابيب:
 *   markdown → parse (blocks) → segments → split → serialize (text+entities+html) → measure
 */
import { parseToBlocks } from './parse.js';
import { renderBlocksToSegments } from './segments.js';
import { splitIntoChunks } from './splitter.js';
import { serializeSegments, MAX_ENTITIES_PER_MESSAGE } from './serialize.js';
import { measureMessages, utf16Length, cutAtSafeBoundary } from './measure.js';
import { dedupeWarnings, makeWarning, WarningCode } from './warnings.js';
import {
  DEFAULT_MAX_MESSAGES,
  DEFAULT_SOFT_LIMIT,
  TELEGRAM_HARD_LIMIT
} from './constants.js';
import { escapeHtml, sanitizeUrl } from './escape.js';

export const VERSION = '1.0.0';

/**
 * يحوّل Markdown إلى رسائل تلجرام جاهزة للإرسال.
 *
 * @param {string} markdown
 * @param {object} [options]
 * @param {number} [options.softLimit] حد التقسيم المفضل (افتراضي 3072)
 * @param {number} [options.maxMessages] أقصى عدد رسائل
 * @returns {{
 *   messages: Array<{text: string, entities: any[], html: string, length: number}>,
 *   warnings: Array<{code: string, messageAr: string, messageEn: string, count: number}>,
 *   stats: {messagesCount:number,totalChars:number,maxLength:number,totalEntities:number,maxEntities:number,withinHardLimit:boolean},
 *   truncated: false
 * }}
 * @throws {Error} برمز RENDER_NEEDS_REVIEW أو TOO_MANY_MESSAGES أو RENDER_FAILED
 */
export function renderToTelegram(markdown, options = {}) {
  const softLimit = clampSoftLimit(options.softLimit ?? DEFAULT_SOFT_LIMIT, options.hardLimit);
  const maxMessages = options.maxMessages ?? DEFAULT_MAX_MESSAGES;

  const state = { warnings: [] };

  let blocks;
  let parseWarnings = [];
  try {
    const parsed = parseToBlocks(markdown);
    blocks = parsed.blocks;
    parseWarnings = parsed.warnings || [];
  } catch (cause) {
    throw engineError('RENDER_FAILED', 'Markdown parsing failed', { cause });
  }
  state.warnings.push(...parseWarnings);

  const segBlocks = renderBlocksToSegments(blocks, state);

  let splitResult;
  try {
    splitResult = splitIntoChunks(segBlocks, {
      softLimit,
      maxMessages,
      hardLimit: options.hardLimit ?? TELEGRAM_HARD_LIMIT
    });
  } catch (error) {
    if (error.code === 'TOO_MANY_MESSAGES') throw error;
    throw engineError('RENDER_FAILED', 'Splitting failed', { cause: error });
  }

  state.warnings.push(...splitResult.warnings);

  const messages = splitResult.chunks.map((segments) => {
    const serialized = serializeSegments(segments);
    return {
      text: serialized.text,
      entities: serialized.entities,
      html: serialized.html,
      length: serialized.text.length
    };
  });

  // تحقق صارم: لا رسالة تتجاوز الحد، ولا كيان خارج النص
  for (const message of messages) {
    if (message.length > (options.hardLimit ?? TELEGRAM_HARD_LIMIT)) {
      throw engineError('RENDER_NEEDS_REVIEW', 'Message exceeds Telegram hard limit', {
        details: { length: message.length }
      });
    }
    if (message.entities.length > MAX_ENTITIES_PER_MESSAGE) {
      throw engineError('RENDER_NEEDS_REVIEW', 'Too many entities in a message', {
        details: { entities: message.entities.length }
      });
    }
    for (const entity of message.entities) {
      if (entity.offset < 0 || entity.offset + entity.length > message.text.length) {
        throw engineError('RENDER_NEEDS_REVIEW', 'Entity out of message bounds', {
          details: { entity, length: message.text.length }
        });
      }
    }
  }

  const stats = measureMessages(messages);

  return {
    messages,
    warnings: dedupeWarnings(
      state.warnings.map((w) => (typeof w === 'string' ? makeWarning(w) : w))
    ),
    stats,
    truncated: false
  };
}

/**
 * واجهة أخف لتحويل سريع في المعاينة (بدون تفاصيل).
 */
export function toPlainText(markdown) {
  const result = renderToTelegram(markdown);
  return result.messages.map((m) => m.text).join('\n\n');
}

function clampSoftLimit(softLimit, hardLimit = TELEGRAM_HARD_LIMIT) {
  const hard = Math.min(hardLimit ?? TELEGRAM_HARD_LIMIT, TELEGRAM_HARD_LIMIT);
  if (!Number.isFinite(softLimit) || softLimit <= 0) return Math.max(256, hard);
  return Math.min(softLimit, hard);
}

function engineError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  if (extra.details) error.details = extra.details;
  if (extra.cause) error.cause = extra.cause;
  return error;
}

export {
  parseToBlocks,
  renderBlocksToSegments,
  splitIntoChunks,
  serializeSegments,
  measureMessages,
  utf16Length,
  cutAtSafeBoundary,
  escapeHtml,
  sanitizeUrl,
  WarningCode,
  TELEGRAM_HARD_LIMIT,
  DEFAULT_SOFT_LIMIT,
  DEFAULT_MAX_MESSAGES,
  MAX_ENTITIES_PER_MESSAGE
};

export default { renderToTelegram, toPlainText, VERSION };
