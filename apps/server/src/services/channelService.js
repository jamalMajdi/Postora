import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '@postora/shared';
import * as channelRepository from '../db/repositories/channelRepository.js';
import { verifyChannelAccess } from '../telegram/publishing.js';
import { describeTelegramError } from '../telegram/errors.js';

/**
 * خدمة القنوات.
 *
 * قاعدة أمنية مهمة: صلاحية المستخدم في القناة تُفحص **حيًا في تلجرام**
 * عند الربط وعند كل نشر. قاعدة البيانات تُستخدم للعرض والتنظيم فقط.
 */
export class ChannelService {
  /**
   * @param {{gateway: import('../telegram/gateway.js').TelegramGateway, logger: any}} deps
   */
  constructor({ gateway, logger }) {
    this.gateway = gateway;
    this.logger = logger;
  }

  /**
   * يربط قناة بمستخدم بعد التحقق من ملكيته لها ومن صلاحيات البوت.
   * @param {{user: object, chatRef: string|number}} params chatRef = @username أو -100...
   */
  async connectChannel({ user, chatRef }) {
    let chat;
    try {
      chat = await this.gateway.getChat(chatRef);
    } catch (error) {
      throw new AppError(ErrorCode.CHANNEL_NOT_FOUND, {
        internalMessage: `getChat(${chatRef}) failed: ${describeTelegramError(error)}`
      });
    }

    if (!chat || !['channel', 'supergroup'].includes(chat.type)) {
      throw new AppError(ErrorCode.CHANNEL_INVALID_TYPE, { details: { type: chat?.type } });
    }

    // البوت يجب أن يكون أدمن
    let botMember;
    try {
      const me = await this.gateway.getMe();
      botMember = await this.gateway.getChatMember(chat.id, me.id);
    } catch (error) {
      throw new AppError(ErrorCode.CHANNEL_BOT_NOT_ADMIN, {
        internalMessage: describeTelegramError(error)
      });
    }

    const botIsAdmin = botMember?.status === 'administrator' || botMember?.status === 'creator';
    if (!botIsAdmin) {
      throw new AppError(ErrorCode.CHANNEL_BOT_NOT_ADMIN, { details: { botStatus: botMember?.status } });
    }

    const botCanPost =
      chat.type === 'channel'
        ? botMember.can_post_messages !== false
        : botMember.can_send_messages !== false;
    if (!botCanPost) {
      throw new AppError(ErrorCode.CHANNEL_BOT_CANNOT_POST, { details: { type: chat.type } });
    }

    // المستخدم يجب أن يكون مالكًا أو أدمن
    let userMember;
    try {
      userMember = await this.gateway.getChatMember(chat.id, user.telegram_user_id);
    } catch (error) {
      throw new AppError(ErrorCode.CHANNEL_NOT_OWNED, {
        internalMessage: describeTelegramError(error)
      });
    }

    const status = userMember?.status;
    if (status !== 'creator' && status !== 'administrator') {
      throw new AppError(ErrorCode.CHANNEL_NOT_OWNED, { details: { status } });
    }

    const role = status === 'creator' ? 'owner' : 'admin';

    const { channel } = await channelRepository.registerChannelWithOwner({
      telegramChatId: chat.id,
      title: chat.title || chat.username || String(chat.id),
      username: chat.username || null,
      chatType: chat.type,
      botIsAdmin,
      botCanPost,
      createdByUserId: user.id,
      userId: user.id,
      role
    });

    this.logger.info({ channelId: channel.id, chatType: channel.chat_type }, 'channel connected');
    return { channel, role };
  }

  /** قنوات المستخدم. */
  async listChannels(userId) {
    return channelRepository.listForUser(userId);
  }

  /**
   * يجلب قناة ويثبت أن المستخدم عضو فيها (بأي دور).
   * @returns {Promise<object>} سجل القناة
   */
  async getChannelForUser(channelId, userId) {
    const channel = await channelRepository.findById(channelId);
    if (!channel) throw new AppError(ErrorCode.CHANNEL_NOT_FOUND);

    const membership = await channelRepository.findMembership(channelId, userId);
    if (!membership) throw new AppError(ErrorCode.CHANNEL_NOT_OWNED);

    return { channel, membership };
  }

  /**
   * يعيد فحص صلاحيات البوت ويحدّث الكاش المخزّن.
   */
  async refreshPermissions(channelId, userId) {
    const { channel } = await this.getChannelForUser(channelId, userId);

    try {
      const me = await this.gateway.getMe();
      const botMember = await this.gateway.getChatMember(channel.telegram_chat_id, me.id);
      const botIsAdmin =
        botMember?.status === 'administrator' || botMember?.status === 'creator';
      const botCanPost =
        channel.chat_type === 'channel'
          ? botMember?.can_post_messages !== false
          : botMember?.can_send_messages !== false;

      const updated = await channelRepository.updateBotPermissions(channel.id, {
        botIsAdmin: botIsAdmin && botCanPost,
        botCanPost
      });
      return updated;
    } catch (error) {
      const updated = await channelRepository.updateBotPermissions(channel.id, {
        botIsAdmin: false,
        botCanPost: false
      });
      this.logger.warn({ channelId, error: describeTelegramError(error) }, 'permission refresh failed');
      return updated;
    }
  }

  /**
   * يزيل المستخدم من القناة (أو يفصل القناة إن كان آخر عضو).
   */
  async disconnectChannel(channelId, userId) {
    const { channel, membership } = await this.getChannelForUser(channelId, userId);
    if (membership.role !== 'owner' && membership.role !== 'admin') {
      throw new AppError(ErrorCode.CHANNEL_NOT_OWNED);
    }

    await channelRepository.removeMember(channelId, userId);
    const remaining = await channelRepository.countMembers(channelId);
    if (remaining === 0) {
      await channelRepository.deactivate(channelId);
    }
    return { channelId: channel.id, remaining };
  }

  /** فحص حي كامل قبل النشر (يُستدعى من publishingService أيضًا). */
  async assertPublishable({ channel, userTelegramId }) {
    return verifyChannelAccess(this.gateway, channel.telegram_chat_id, userTelegramId);
  }
}
