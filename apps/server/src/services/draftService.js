import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '@postora/shared';
import * as draftRepository from '../db/repositories/draftRepository.js';
import * as channelRepository from '../db/repositories/channelRepository.js';
import { contentFingerprint } from '../utils/crypto.js';
import { extractTitle } from '../files/markdownFile.js';

/** خدمة المسودات: منطق العمل فقط، بلا SQL وبلا HTTP. */
export class DraftService {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
  }

  async create({ user, contentMarkdown, title, targetChannelId, source = 'miniapp' }) {
    const content = String(contentMarkdown ?? '');
    if (content.trim().length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, { details: { field: 'contentMarkdown' } });
    }
    if (content.length > this.config.limits.maxContentChars) {
      throw new AppError(ErrorCode.CONTENT_TOO_LONG, {
        details: { maxChars: this.config.limits.maxContentChars }
      });
    }

    if (targetChannelId) {
      const membership = await channelRepository.findMembership(targetChannelId, user.id);
      if (!membership) throw new AppError(ErrorCode.CHANNEL_NOT_OWNED);
    }

    return draftRepository.create({
      userId: user.id,
      title: title?.trim() || extractTitle(content),
      contentMarkdown: content,
      contentHash: contentFingerprint(content),
      targetChannelId: targetChannelId || null,
      source
    });
  }

  async list(user, { status = null, limit = 50, offset = 0 }) {
    return draftRepository.listForUser(user.id, { status, limit, offset });
  }

  async get(user, id) {
    const draft = await draftRepository.findByIdForUser(id, user.id);
    if (!draft) throw new AppError(ErrorCode.NOT_FOUND, { details: { resource: 'draft' } });
    return draft;
  }

  /**
   * تحديث بقفل تفاؤلي — يمنع ضياع تعديل متزامن.
   */
  async update(user, id, patch) {
    const current = await this.get(user, id);

    if (patch.targetChannelId) {
      const membership = await channelRepository.findMembership(patch.targetChannelId, user.id);
      if (!membership) throw new AppError(ErrorCode.CHANNEL_NOT_OWNED);
    }

    if (patch.contentMarkdown !== undefined) {
      if (String(patch.contentMarkdown).length > this.config.limits.maxContentChars) {
        throw new AppError(ErrorCode.CONTENT_TOO_LONG);
      }
    }

    // القفل التفاؤلي: إن أرسل العميل رقم إصدار، يجب أن يطابق الإصدار الحالي.
    const expectedVersion = patch.version ?? current.version;
    if (patch.version !== undefined && patch.version !== current.version) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, {
        status: 409,
        details: { reason: 'version_conflict', currentVersion: current.version }
      });
    }

    const updated = await draftRepository.updateWithVersion(id, user.id, expectedVersion, {
      title: patch.title !== undefined ? patch.title?.trim() || null : undefined,
      contentMarkdown: patch.contentMarkdown,
      contentHash:
        patch.contentMarkdown !== undefined
          ? contentFingerprint(patch.contentMarkdown)
          : undefined,
      targetChannelId: patch.targetChannelId,
      status: patch.status
    });

    if (!updated) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, {
        status: 409,
        details: { reason: 'version_conflict', currentVersion: current.version }
      });
    }
    return updated;
  }

  async remove(user, id) {
    const removed = await draftRepository.remove(id, user.id);
    if (!removed) throw new AppError(ErrorCode.NOT_FOUND, { details: { resource: 'draft' } });
    return { deleted: true };
  }
}
