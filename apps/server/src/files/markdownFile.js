import { ALLOWED_MARKDOWN_EXTENSIONS, ErrorCode } from '@postora/shared';
import { AppError } from '../errors/AppError.js';

/**
 * التحقق من ملفات Markdown قبل وبعد التنزيل.
 * نتحقق مبكرًا (من بيانات تلجرام) لتجنّب تنزيل ملفات ضخمة بلا داعٍ.
 */

/**
 * @param {{file_name?: string, mime_type?: string, file_size?: number}} document
 * @param {{maxBytes: number}} limits
 */
export function validateDocumentMetadata(document, limits) {
  const fileName = document?.file_name || '';
  const extension = extensionOf(fileName);

  if (!ALLOWED_MARKDOWN_EXTENSIONS.includes(extension)) {
    throw new AppError(ErrorCode.FILE_INVALID_EXTENSION, {
      details: { allowed: ALLOWED_MARKDOWN_EXTENSIONS }
    });
  }

  if (typeof document.file_size === 'number' && document.file_size > limits.maxBytes) {
    throw new AppError(ErrorCode.FILE_TOO_LARGE, {
      details: { maxBytes: limits.maxBytes, actualBytes: document.file_size }
    });
  }

  // تلجرام يحدد الحجم الأقصى للتنزيل عبر getFile بـ 20MB
  if (typeof document.file_size === 'number' && document.file_size > 20 * 1024 * 1024) {
    throw new AppError(ErrorCode.FILE_TOO_LARGE, {
      details: { reason: 'telegram_download_limit', maxBytes: 20 * 1024 * 1024 }
    });
  }

  return { fileName, extension };
}

/**
 * فك ترميز UTF-8 والتحقق من أن المحتوى نصي فعلًا.
 * @param {Buffer|Uint8Array} buffer
 * @param {{maxBytes: number, maxChars: number}} limits
 * @returns {string}
 */
export function decodeMarkdownBuffer(buffer, limits) {
  if (!buffer || buffer.length === 0) {
    throw new AppError(ErrorCode.FILE_EMPTY);
  }

  if (buffer.length > limits.maxBytes) {
    throw new AppError(ErrorCode.FILE_TOO_LARGE, {
      details: { maxBytes: limits.maxBytes, actualBytes: buffer.length }
    });
  }

  // رفض البايت الصفري (مؤشر على ملف ثنائي)
  if (buffer.includes(0)) {
    throw new AppError(ErrorCode.FILE_INVALID_ENCODING, { details: { reason: 'binary' } });
  }

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new AppError(ErrorCode.FILE_INVALID_ENCODING, { details: { reason: 'invalid_utf8' } });
  }

  // إزالة BOM إن وُجد
  text = text.replace(/^\uFEFF/, '');

  if (text.trim().length === 0) {
    throw new AppError(ErrorCode.FILE_EMPTY);
  }

  if (text.length > limits.maxChars) {
    throw new AppError(ErrorCode.CONTENT_TOO_LONG, {
      details: { maxChars: limits.maxChars, actualChars: text.length }
    });
  }

  return text;
}

/**
 * تنزيل ملف من تلجرام عبر getFile + طلب HTTPS.
 * @param {import('../telegram/gateway.js').TelegramGateway} gateway
 * @param {string} fileId
 * @param {{maxBytes: number, fetchImpl?: typeof fetch}} options
 * @returns {Promise<Buffer>}
 */
export async function downloadTelegramFile(gateway, fileId, options) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  let fileInfo;
  try {
    fileInfo = await gateway.call('getFile', { file_id: fileId });
  } catch (error) {
    throw new AppError(ErrorCode.FILE_DOWNLOAD_FAILED, {
      internalMessage: `getFile failed: ${error?.message}`
    });
  }

  if (!fileInfo?.file_path) {
    throw new AppError(ErrorCode.FILE_DOWNLOAD_FAILED, { details: { reason: 'no_file_path' } });
  }

  if (typeof fileInfo.file_size === 'number' && fileInfo.file_size > options.maxBytes) {
    throw new AppError(ErrorCode.FILE_TOO_LARGE, {
      details: { maxBytes: options.maxBytes, actualBytes: fileInfo.file_size }
    });
  }

  const base = gateway.apiBaseUrl;
  const url = `${base}/file/bot${gateway.token}/${fileInfo.file_path}`;

  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new AppError(ErrorCode.FILE_DOWNLOAD_FAILED, {
      details: { status: response.status }
    });
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > options.maxBytes) {
    throw new AppError(ErrorCode.FILE_TOO_LARGE, {
      details: { maxBytes: options.maxBytes, actualBytes: buffer.length }
    });
  }

  return buffer;
}

export function extensionOf(fileName) {
  const match = /(\.[^.]+)$/.exec(String(fileName || '').toLowerCase());
  return match ? match[1] : '';
}

/**
 * استخراج عنوان مقترح من أول عنوان في المحتوى.
 * @param {string} markdown
 * @param {number} [maxLength]
 */
export function extractTitle(markdown, maxLength = 200) {
  if (!markdown) return null;
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const heading = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) return heading[1].slice(0, maxLength);
    if (line.trim().length > 0) {
      // أول سطر غير فارغ وغير عنوان — نستخدمه كعنوان مقترح
      const plain = line
        .replace(/[*_~`>#-]/g, '')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .trim();
      if (plain) return plain.slice(0, maxLength);
    }
  }
  return null;
}
