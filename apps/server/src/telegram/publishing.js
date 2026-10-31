import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '@postora/shared';
import { describeTelegramError } from './errors.js';

/**
 * إرسال منشور متعدد الرسائل إلى قناة.
 *
 * السلوك عند الفشل الجزئي (معلن وموثق):
 *  - الرسائل التي نجحت تُسجَّل أرقامها.
 *  - لا إعادة إرسال تلقائية (لمنع التكرار في القناة).
 *  - يُرفع خطأ يحمل الرسائل الناجحة ليتخذ service القرار (failed + إبلاغ المستخدم).
 *
 * @param {import('./gateway.js').TelegramGateway} gateway
 * @param {string|number} chatId
 * @param {Array<{text: string, entities: any[]}>} messages
 * @param {{logger?: any, onProgress?: (info: {index:number, messageId:number}) => void}} [options]
 * @returns {Promise<{messageIds: number[], failedAtIndex: number|null}>}
 */
export async function sendPublication(gateway, chatId, messages, options = {}) {
  const messageIds = [];
  const onProgress = options.onProgress || (() => {});

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    try {
      const sent = await gateway.sendRenderedMessage(chatId, message, { disablePreview: true });
      messageIds.push(sent.message_id);
      onProgress({ index, messageId: sent.message_id });
    } catch (error) {
      const partial = new AppError(error?.code || ErrorCode.PUBLISH_FAILED, {
        internalMessage: `Publish failed at message ${index + 1}/${messages.length}: ${describeTelegramError(error)}`,
        details: {
          failedAtIndex: index,
          succeeded: messageIds.length,
          total: messages.length
        }
      });
      partial.partialMessageIds = messageIds;
      throw partial;
    }
  }

  return { messageIds, failedAtIndex: null };
}

/**
 * التحقق الحي من صلاحيات البوت والمستخدم في القناة.
 * يُنفَّذ قبل **كل** عملية نشر — لا نعتمد على بيانات مخزنة.
 *
 * @param {import('./gateway.js').TelegramGateway} gateway
 * @param {string|number} chatId
 * @param {number|string} userTelegramId
 * @returns {Promise<{chat: object, botIsAdmin: boolean, botCanPost: boolean, userIsAdmin: boolean, userStatus: string}>}
 */
export async function verifyChannelAccess(gateway, chatId, userTelegramId) {
  // 1) القناة موجودة؟
  let chat;
  try {
    chat = await gateway.getChat(chatId);
  } catch (error) {
    throw new AppError(ErrorCode.CHANNEL_NOT_FOUND, {
      internalMessage: `getChat failed: ${describeTelegramError(error)}`
    });
  }

  if (!chat || (chat.type !== 'channel' && chat.type !== 'supergroup')) {
    throw new AppError(ErrorCode.CHANNEL_INVALID_TYPE, {
      details: { type: chat?.type }
    });
  }

  // 2) البوت أدمن؟ وهل يملك can_post_messages؟
  let botMember;
  try {
    const me = await gateway.getMe();
    botMember = await gateway.getChatMember(chat.id, me.id);
  } catch (error) {
    throw new AppError(ErrorCode.CHANNEL_BOT_NOT_ADMIN, {
      internalMessage: `getChatMember(bot) failed: ${describeTelegramError(error)}`
    });
  }

  const botIsAdmin = botMember?.status === 'administrator' || botMember?.status === 'creator';
  if (!botIsAdmin) {
    throw new AppError(ErrorCode.CHANNEL_BOT_NOT_ADMIN, {
      details: { botStatus: botMember?.status }
    });
  }

  // في القنوات: can_post_messages؛ في المجموعات: can_send_messages
  const botCanPost =
    chat.type === 'channel'
      ? botMember.can_post_messages !== false
      : botMember.can_send_messages !== false;

  if (!botCanPost) {
    throw new AppError(ErrorCode.CHANNEL_BOT_CANNOT_POST, {
      details: { type: chat.type }
    });
  }

  // 3) المستخدم مالك أو أدمن الآن؟
  let userMember;
  try {
    userMember = await gateway.getChatMember(chat.id, userTelegramId);
  } catch (error) {
    throw new AppError(ErrorCode.CHANNEL_ACCESS_DENIED, {
      internalMessage: `getChatMember(user) failed: ${describeTelegramError(error)}`
    });
  }

  const userIsAdmin = userMember?.status === 'administrator' || userMember?.status === 'creator';
  if (!userIsAdmin) {
    throw new AppError(ErrorCode.CHANNEL_ACCESS_DENIED, {
      details: { userStatus: userMember?.status }
    });
  }

  return {
    chat,
    botIsAdmin,
    botCanPost,
    userIsAdmin,
    userStatus: userMember.status
  };
}
