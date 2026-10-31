import { SignJWT, jwtVerify } from 'jose';
import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '@postora/shared';
import { validateInitData } from '../telegram/initDataValidator.js';
import * as userRepository from '../db/repositories/userRepository.js';

/**
 * خدمة المصادقة.
 *
 * التدفق:
 *  1) الواجهة ترسل initData الخام.
 *  2) الخادم يتحقق من التوقيع ويستخرج هوية تلجرام بنفسه (لا ثقة بالعميل).
 *  3) يُنشئ/يحدّث المستخدم في قاعدة البيانات.
 *  4) يُصدر JWT قصير العمر لتخفيف التحقق المتكرر.
 *
 * ملاحظة: JWT هنا للجلسة الداخلية فقط — لا يحتوي أي سر أو توكن بوت.
 */
export class AuthService {
  /**
   * @param {{config: object, logger: any}} deps
   */
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.secret = new TextEncoder().encode(config.auth.jwtSecret);
  }

  /**
   * @param {string} initData
   * @returns {Promise<{token: string, expiresIn: number, user: object}>}
   */
  async createSessionFromInitData(initData) {
    const validated = validateInitData(initData, {
      botToken: this.config.bot.token,
      maxAgeSeconds: this.config.auth.initDataMaxAgeSeconds
    });

    const user = await userRepository.upsertUser({
      telegramUserId: validated.user.id,
      username: validated.user.username,
      firstName: validated.user.first_name,
      lastName: validated.user.last_name,
      languageCode: validated.user.language_code
    });

    if (user.is_blocked) {
      throw new AppError(ErrorCode.USER_BLOCKED);
    }

    const token = await this.#issueToken(user);
    return {
      token,
      expiresIn: this.config.auth.jwtTtlSeconds,
      user: publicUser(user)
    };
  }

  async #issueToken(user) {
    return new SignJWT({
      sub: user.id,
      tg: String(user.telegram_user_id)
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('postora')
      .setAudience('postora-miniapp')
      .setExpirationTime(`${this.config.auth.jwtTtlSeconds}s`)
      .sign(this.secret);
  }

  /**
   * يتحقق من JWT ويعيد سجل المستخدم من قاعدة البيانات (لا نثق بمحتوى التوكن وحده).
   * @param {string} token
   * @returns {Promise<object>} سجل المستخدم الكامل
   */
  async authenticateToken(token) {
    if (!token) throw new AppError(ErrorCode.AUTH_MISSING_INIT_DATA);

    let payload;
    try {
      const verified = await jwtVerify(token, this.secret, {
        issuer: 'postora',
        audience: 'postora-miniapp'
      });
      payload = verified.payload;
    } catch (error) {
      if (error?.code === 'ERR_JWT_EXPIRED') {
        throw new AppError(ErrorCode.AUTH_EXPIRED_TOKEN);
      }
      throw new AppError(ErrorCode.AUTH_INVALID_TOKEN);
    }

    const user = await userRepository.findById(payload.sub);
    if (!user) throw new AppError(ErrorCode.AUTH_INVALID_TOKEN);
    if (user.is_blocked) throw new AppError(ErrorCode.USER_BLOCKED);

    return user;
  }
}

/** يحوّل سجل المستخدم إلى شكل آمن للإرسال للواجهة (بلا حقول داخلية حساسة). */
export function publicUser(user) {
  return {
    id: user.id,
    telegramUserId: String(user.telegram_user_id),
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    locale: user.preferred_locale
  };
}
