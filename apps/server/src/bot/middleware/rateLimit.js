/**
 * حَدّ معدل بسيط في الذاكرة لتحديثات البوت.
 * يمنع مستخدمًا واحدًا من إغراق البوت (خصوصًا مع تحويل ملفات Markdown).
 */
export function botRateLimit({ windowMs = 60_000, limit = 20 } = {}) {
  /** @type {Map<number, number[]>} */
  const hits = new Map();

  return async function botRateLimitMiddleware(ctx, next) {
    const userId = ctx.from?.id;
    if (!userId) return next();

    const now = Date.now();
    const list = (hits.get(userId) || []).filter((time) => now - time < windowMs);

    if (list.length >= limit) {
      hits.set(userId, list);
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery('⏳ عدد الطلبات كبير، انتظر قليلاً.').catch(() => {});
      }
      return undefined;
    }

    list.push(now);
    hits.set(userId, list);

    // تنظيف دوري بسيط
    if (hits.size > 1000) {
      for (const [key, times] of hits) {
        if (times.every((time) => now - time > windowMs)) hits.delete(key);
      }
    }

    return next();
  };
}
