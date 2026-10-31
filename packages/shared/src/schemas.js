import { z } from 'zod';
import { DEFAULT_MAX_CONTENT_CHARS } from './limits.js';

/**
 * مخططات التحقق المشتركة (Zod) بين الخادم والواجهة.
 * الواجهة تستخدمها لمنع إرسال مدخلات غير صالحة، والخادم يستخدمها كحكم نهائي.
 */

export const localeSchema = z.enum(['ar', 'en']);

export const idSchema = z.string().uuid();

export const channelConnectSchema = z.object({
  // @username أو معرف رقمي للقناة (-100...)
  chatRef: z
    .string()
    .trim()
    .min(2)
    .max(128)
    .refine(
      (value) => /^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value) || /^-?\d{5,20}$/.test(value),
      { message: 'chatRef must be @username or numeric chat id' }
    )
});

export const draftCreateSchema = z.object({
  contentMarkdown: z.string().min(1).max(DEFAULT_MAX_CONTENT_CHARS),
  title: z.string().trim().max(200).optional().nullable(),
  targetChannelId: idSchema.optional().nullable(),
  source: z.enum(['bot', 'miniapp']).optional()
});

export const draftUpdateSchema = z.object({
  // رقم الإصدار الحالي — يُستخدم للقفل التفاؤلي (يمنع ضياع تعديل متزامن)
  version: z.number().int().min(1).optional(),
  contentMarkdown: z.string().max(DEFAULT_MAX_CONTENT_CHARS).optional(),
  title: z.string().trim().max(200).nullable().optional(),
  targetChannelId: idSchema.nullable().optional(),
  status: z.enum(['draft', 'archived']).optional()
});

export const previewSchema = z.object({
  contentMarkdown: z.string().min(1).max(DEFAULT_MAX_CONTENT_CHARS)
});

export const publishSchema = z.object({
  channelId: idSchema,
  contentMarkdown: z.string().min(1).max(DEFAULT_MAX_CONTENT_CHARS),
  draftId: idSchema.optional().nullable(),
  allowDuplicate: z.boolean().optional().default(false),
  idempotencyKey: z.string().min(8).max(128).optional()
});

export const confirmPublicationSchema = z.object({
  contentMarkdown: z.string().min(1).max(DEFAULT_MAX_CONTENT_CHARS)
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

export const localeUpdateSchema = z.object({ locale: localeSchema });
