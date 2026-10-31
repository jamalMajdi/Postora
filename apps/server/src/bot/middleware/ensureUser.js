import { AppError } from '../../errors/AppError.js';
import { ErrorCode } from '@postora/shared';
import * as userRepository from '../../db/repositories/userRepository.js';

/**
 * Middleware لكل تحديث: يضمن وجود سجل مستخدم ويضعه على ctx.state.user.
 * الهوية تأتي من تحديث تلجرام (ليس من أي مدخل من المستخدم).
 */
export function ensureUser() {
  return async function ensureUserMiddleware(ctx, next) {
    const from = ctx.state?.user ? null : ctx.from;

    if (!ctx.state.user) {
      if (!from || from.is_bot) return; // نتجاهل تحديثات البوتات

      const user = await userRepository.upsertUser({
        telegramUserId: from.id,
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
        languageCode: from.language_code
      });

      if (user.is_blocked) {
        throw new AppError(ErrorCode.USER_BLOCKED);
      }

      ctx.state.user = user;
    }

    return next();
  };
}
