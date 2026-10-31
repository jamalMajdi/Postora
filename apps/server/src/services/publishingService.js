import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '@postora/shared';
import * as publicationRepository from '../db/repositories/publicationRepository.js';
import * as channelRepository from '../db/repositories/channelRepository.js';
import * as draftRepository from '../db/repositories/draftRepository.js';
import { renderMarkdown } from './renderService.js';
import { sendPublication, verifyChannelAccess } from '../telegram/publishing.js';
import { contentFingerprint, randomKey } from '../utils/crypto.js';
import { describeTelegramError } from '../telegram/errors.js';

/**
 * خدمة النشر — القلب الوظيفي للمشروع.
 *
 * التدفق (architecture.md §4.3):
 *  1) التحقق من ملكية المستخدم للقناة في قاعدة البيانات (بوابة أولى).
 *  2) تحويل Markdown عبر المحرك المشترك (المصدر النهائي هو الخادم).
 *  3) إنشاء طلب نشر بحالة pending + idempotency_key.
 *  4) كشف التكرار المتعمد (تحذير فقط، يُطلب تأكيد صريح).
 *  5) الانتقال الذرّي pending→publishing.
 *  6) فحص حي لصلاحيات البوت والمستخدم في تلجرام.
 *  7) إرسال الرسائل تباعًا + تسجيل النتيجة.
 *  8) عند الفشل: failed + تسجيل ما نجح + سبب واضح للمستخدم (لا إعادة صامتة).
 */
export class PublishingService {
  /**
   * @param {{config: object, gateway: any, logger: any}} deps
   */
  constructor({ config, gateway, logger }) {
    this.config = config;
    this.gateway = gateway;
    this.logger = logger;
  }

  /**
   * ينشئ طلب نشر معلّقًا (يُستخدم في البوت للمعاينة+التأكيد وفي الميني آب للنشر الفوري).
   *
   * @param {object} params
   * @param {object} params.user سجل المستخدم
   * @param {string} params.channelId UUID
   * @param {string} params.contentMarkdown
   * @param {string|null} [params.draftId]
   * @param {'bot'|'miniapp'} [params.source]
   * @param {boolean} [params.allowDuplicate] تجاوز تحذير التكرار
   * @param {string} [params.idempotencyKey] مفتاح من العميل (اختياري؛ يُولَّد تلقائيًا إن غاب)
   * @returns {Promise<{publication: object, preview: object}>}
   */
  async preparePublication(params) {
    const {
      user,
      channelId,
      contentMarkdown,
      draftId = null,
      source = 'miniapp',
      allowDuplicate = false,
      idempotencyKey = null
    } = params;

    const channel = await channelRepository.findById(channelId);
    if (!channel) throw new AppError(ErrorCode.CHANNEL_NOT_FOUND);

    const membership = await channelRepository.findMembership(channelId, user.id);
    if (!membership) throw new AppError(ErrorCode.CHANNEL_NOT_OWNED);

    const rendered = renderMarkdown(contentMarkdown, {
      maxMessages: this.config.limits.maxPublishMessages,
      maxContentChars: this.config.limits.maxContentChars
    });

    if (rendered.messages.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, { details: { reason: 'empty_content' } });
    }

    const contentHash = contentFingerprint(contentMarkdown);

    // تحذير التكرار المتعمد (ليس قيدًا) — architecture.md §4.2
    if (!allowDuplicate) {
      const duplicate = await publicationRepository.findRecentDuplicate({
        channelId,
        contentHash
      });
      if (duplicate) {
        throw new AppError(ErrorCode.PUBLICATION_DUPLICATE_WARNING, {
          details: {
            previousPublicationId: duplicate.id,
            publishedAt: duplicate.published_at,
            canForce: true
          }
        });
      }
    }

    let publication;
    try {
      publication = await publicationRepository.create({
        userId: user.id,
        draftId,
        channelId,
        source,
        idempotencyKey: idempotencyKey || randomKey(),
        contentHash,
        telegramChatId: channel.telegram_chat_id,
        renderedMessagesCount: rendered.messages.length,
        renderedChars: rendered.stats.totalChars
      });
    } catch (error) {
      if (error?.code === '23505' && /idempotency_key/.test(String(error?.constraint || error?.message))) {
        throw new AppError(ErrorCode.PUBLICATION_ALREADY_PROCESSED, {
          details: { reason: 'duplicate_idempotency_key' }
        });
      }
      throw error;
    }

    await publicationRepository.addLog({
      publicationId: publication.id,
      stage: 'prepare',
      level: 'info',
      details: {
        messages: rendered.messages.length,
        chars: rendered.stats.totalChars,
        warnings: rendered.warnings.map((w) => w.code)
      }
    });

    return {
      publication,
      preview: {
        messages: rendered.messages,
        stats: rendered.stats,
        warnings: rendered.warnings
      }
    };
  }

  /**
   * ينفّذ نشرًا لطلب موجود (بعد التأكيد).
   *
   * @param {object} params
   * @param {object} params.user
   * @param {string} params.publicationId
   * @param {string} params.contentMarkdown المحتوى النهائي (قد يكون تغيّر — نتحقق من البصمة)
   * @returns {Promise<{publication: object, messageIds: number[]}>}
   */
  async executePublication({ user, publicationId, contentMarkdown }) {
    const startedAt = Date.now();

    const existing = await publicationRepository.findForUser(publicationId, user.id);
    if (!existing) throw new AppError(ErrorCode.PUBLICATION_NOT_FOUND);

    if (existing.status !== 'pending') {
      throw new AppError(
        existing.status === 'published'
          ? ErrorCode.PUBLICATION_ALREADY_PROCESSED
          : ErrorCode.PUBLICATION_NOT_PENDING,
        { details: { status: existing.status } }
      );
    }

    // تحقق: المحتوى لم يتغير بين المعاينة والتأكيد
    const currentHash = contentFingerprint(contentMarkdown);
    if (currentHash !== existing.content_hash) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, {
        status: 409,
        details: { reason: 'content_changed' }
      });
    }

    const channel = await channelRepository.findById(existing.channel_id);
    if (!channel) throw new AppError(ErrorCode.CHANNEL_NOT_FOUND);

    const rendered = renderMarkdown(contentMarkdown, {
      maxMessages: this.config.limits.maxPublishMessages,
      maxContentChars: this.config.limits.maxContentChars
    });

    // 5) انتقال ذرّي — يمنع أي نشر مزدوج مهما تكررت الطلبات
    const claimed = await publicationRepository.claimForPublishing(publicationId, user.id);
    if (!claimed) {
      throw new AppError(ErrorCode.PUBLICATION_ALREADY_PROCESSED);
    }

    try {
      // 6) فحص حي للصلاحيات في تلجرام (لا اعتماد على المخزَّن)
      const access = await verifyChannelAccess(
        this.gateway,
        channel.telegram_chat_id,
        user.telegram_user_id
      );

      await channelRepository.updateBotPermissions(channel.id, {
        botIsAdmin: access.botIsAdmin,
        botCanPost: access.botCanPost
      });

      await publicationRepository.addLog({
        publicationId,
        stage: 'permission_check',
        level: 'info',
        details: { userStatus: access.userStatus, botCanPost: access.botCanPost }
      });

      // 7) الإرسال
      const { messageIds } = await sendPublication(
        this.gateway,
        channel.telegram_chat_id,
        rendered.messages
      );

      const published = await publicationRepository.markPublished(publicationId, {
        messageIds,
        messagesCount: rendered.messages.length,
        chars: rendered.stats.totalChars
      });

      await publicationRepository.addLog({
        publicationId,
        stage: 'finalize',
        level: 'info',
        details: { messageIds },
        durationMs: Date.now() - startedAt
      });

      this.logger.info(
        { publicationId, channelId: channel.id, messages: messageIds.length },
        'publication published'
      );

      return { publication: published, messageIds };
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(ErrorCode.PUBLISH_FAILED, {
              internalMessage: error?.message,
              cause: error
            });

      const partialIds = appError.partialMessageIds || null;

      // تنظيف الطلبات المعلّقة المكررة حتى لا تمنع إعادة المحاولة لاحقًا.
      // (الطلب المعلّق لا يمثل نشرًا فعليًا — لم تُرسل رسائله.)
      await publicationRepository
        .cancelOtherPendingDuplicates({ channelId: existing.channel_id, contentHash: existing.content_hash, keepId: publicationId })
        .catch(() => {});

      const failed = await publicationRepository.markFailed(publicationId, {
        errorCode: appError.code,
        errorMessage: appError.message,
        messageIds: partialIds
      });

      await publicationRepository.addLog({
        publicationId,
        stage: 'send',
        level: 'error',
        errorCode: appError.code,
        details: {
          details: appError.details,
          partialMessageIds: partialIds,
          telegram: describeTelegramError(error)
        },
        durationMs: Date.now() - startedAt
      });

      this.logger.warn(
        { publicationId, code: appError.code, partial: partialIds?.length ?? 0 },
        'publication failed'
      );

      const userFacing = new AppError(appError.code, {
        internalMessage: appError.message,
        details: partialIds ? { partialMessageIds: partialIds, details: appError.details } : appError.details
      });
      userFacing.publication = failed;
      throw userFacing;
    }
  }

  /**
   * إلغاء طلب نشر معلّق (زر "إلغاء" في البوت).
   */
  async cancel(publicationId, userId) {
    const cancelled = await publicationRepository.markCancelled(publicationId, userId);
    if (!cancelled) {
      const existing = await publicationRepository.findForUser(publicationId, userId);
      if (!existing) throw new AppError(ErrorCode.PUBLICATION_NOT_FOUND);
      throw new AppError(ErrorCode.PUBLICATION_NOT_PENDING, {
        details: { status: existing.status }
      });
    }
    return cancelled;
  }

  async get(userId, publicationId) {
    const publication = await publicationRepository.findForUser(publicationId, userId);
    if (!publication) throw new AppError(ErrorCode.PUBLICATION_NOT_FOUND);
    return publication;
  }

  async list(userId, { limit, offset }) {
    return publicationRepository.listForUser(userId, { limit, offset });
  }

  async stats(userId) {
    return publicationRepository.statsForUser(userId);
  }

  /** معاينة فقط (بلا أي كتابة في قاعدة البيانات) — لدعم تطابق معاينة الميني آب. */
  preview(contentMarkdown) {
    return renderMarkdown(contentMarkdown, {
      maxMessages: this.config.limits.maxPublishMessages,
      maxContentChars: this.config.limits.maxContentChars
    });
  }

  /**
   * نشر مباشر من البوت بعد ملف .md (يجمع prepare + execute).
   * يُستخدم فقط حيث لا توجد مرحلة تأكيد منفصلة.
   */
  async publishNow({ user, channelId, contentMarkdown, source = 'bot', draftId = null }) {
    const { publication, preview } = await this.preparePublication({
      user,
      channelId,
      contentMarkdown,
      source,
      draftId
    });
    const result = await this.executePublication({
      user,
      publicationId: publication.id,
      contentMarkdown
    });
    return { ...result, preview };
  }
}

export { draftRepository };
