import { createLogger } from './utils/logger.js';
import { TelegramGateway } from './telegram/gateway.js';
import { AuthService } from './services/authService.js';
import { ChannelService } from './services/channelService.js';
import { DraftService } from './services/draftService.js';
import { PublishingService } from './services/publishingService.js';

/**
 * تركيب الحاويات (Dependency Composition Root).
 * كل مكان يحتاج الخدمات يستدعي buildServices بحقن اختياري (للاختبار).
 */
export function buildServices({ config, logger, gateway }) {
  const resolvedLogger = logger || createLogger(config.logLevel);
  const resolvedGateway =
    gateway ||
    new TelegramGateway({
      token: config.bot.token,
      apiBaseUrl: config.bot.apiBaseUrl,
      logger: resolvedLogger,
      globalPerSecond: config.telegramLimits.globalPerSecond,
      perChatPerMinute: config.telegramLimits.perChatPerMinute
    });

  return {
    logger: resolvedLogger,
    gateway: resolvedGateway,
    authService: new AuthService({ config, logger: resolvedLogger }),
    channelService: new ChannelService({ gateway: resolvedGateway, logger: resolvedLogger }),
    draftService: new DraftService({ config, logger: resolvedLogger }),
    publishingService: new PublishingService({
      config,
      gateway: resolvedGateway,
      logger: resolvedLogger
    })
  };
}
