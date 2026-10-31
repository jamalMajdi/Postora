/**
 * حَدّ معدل داخلي لنداءات تلجرام.
 *
 * حدّ تلجرام التقريبي: ~30 رسالة/ثانية إجمالًا، ~20/دقيقة لكل مجموعة/قناة.
 * نطبق طابورًا بسيطًا لكل محادثة + سقف عام، ونحترم retry_after عند 429.
 *
 * ملاحظة معمارية: هذا في الذاكرة (قرار D3) — كافٍ لعملية واحدة؛
 * عند التوسع الأفقي يُستبدل بجدول rate_limit_hits.
 */
export class TelegramRateLimiter {
  /**
   * @param {{globalPerSecond?: number, perChatPerMinute?: number, now?: () => number}} options
   */
  constructor(options = {}) {
    this.globalPerSecond = options.globalPerSecond ?? 25;
    this.perChatPerMinute = options.perChatPerMinute ?? 18;
    this.now = options.now ?? (() => Date.now());

    /** @type {number[]} أزمنة النداءات العامة داخل النافذة الحالية */
    this.globalHits = [];
    /** @type {Map<string, number[]>} */
    this.chatHits = new Map();
    /** @type {Map<string, number>} وقت التعافي بعد 429 */
    this.cooldownUntil = new Map();
  }

  /**
   * يحجز مكانًا للنداء (ينتظر إن لزم).
   * @param {string} chatKey
   */
  async acquire(chatKey = 'global') {
    // احترام فترة التهدئة بعد 429
    const cooldown = this.cooldownUntil.get(chatKey);
    if (cooldown && cooldown > this.now()) {
      await sleep(cooldown - this.now());
    }

    let waited = 0;
    while (waited < 60_000) {
      this.prune();
      const globalOk = this.globalHits.length < this.globalPerSecond;
      const chatOk = (this.chatHits.get(chatKey)?.length ?? 0) < this.perChatPerMinute;

      if (globalOk && chatOk) {
        const now = this.now();
        this.globalHits.push(now);
        const list = this.chatHits.get(chatKey) || [];
        list.push(now);
        this.chatHits.set(chatKey, list);
        return;
      }

      // انتظار قصير ثم إعادة المحاولة
      await sleep(50);
      waited += 50;
    }
    throw new Error('rate limiter timeout');
  }

  /** يسجّل 429 ليمنع النداءات حتى انتهاء المدة. */
  penalize(chatKey, retryAfterSeconds = 5) {
    this.cooldownUntil.set(chatKey, this.now() + retryAfterSeconds * 1000);
  }

  prune() {
    const now = this.now();
    this.globalHits = this.globalHits.filter((t) => now - t < 1000);
    for (const [key, list] of this.chatHits) {
      const fresh = list.filter((t) => now - t < 60_000);
      if (fresh.length === 0) this.chatHits.delete(key);
      else this.chatHits.set(key, fresh);
    }
    for (const [key, until] of this.cooldownUntil) {
      if (until <= now) this.cooldownUntil.delete(key);
    }
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/** رقم عشوائي بين حدّين (للتأخير المتزايد مع عشوائية). */
export function backoffDelay(attempt, baseMs = 500, maxMs = 8000) {
  const exp = Math.min(maxMs, baseMs * 2 ** (attempt - 1));
  return Math.floor(exp / 2 + Math.random() * (exp / 2));
}
