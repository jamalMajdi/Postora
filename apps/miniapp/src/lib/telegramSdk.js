/**
 * غلاف رقيق حول Telegram WebApp SDK.
 *
 * لماذا غلاف؟
 *  - التطبيق يجب أن يعمل في المتصفح أثناء التطوير (بدون تلجرام) ليمكن اختباره.
 *  - كل تكامل مع تلجرام يمر من ملف واحد، فيسهل تبديله أو تعطيله.
 */

const webApp = () => (typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined);

/** هل نحن داخل تلجرام فعلًا؟ */
export function isTelegramWebApp() {
  const app = webApp();
  return Boolean(app && app.initData);
}

/** تهيئة التطبيق (يُستدعى مرة عند الإقلاع). */
export function initTelegramWebApp() {
  const app = webApp();
  if (!app) return null;

  try {
    app.ready();
    app.expand();
    if (app.enableClosingConfirmation) app.enableClosingConfirmation();
    if (app.setHeaderColor) app.setHeaderColor('secondary_bg_color');
  } catch {
    // بيئة غير متوافقة — نكمل بدون تكامل
  }
  return app;
}

/** initData الخام — يُرسل للخادم ليُتحقق منه هناك. */
export function getInitData() {
  return webApp()?.initData || '';
}

/** بيانات المستخدم غير الموثوقة (للعرض فقط — الهوية الحقيقية تُقرأ من الخادم). */
export function getUnsafeUser() {
  const app = webApp();
  if (!app?.initDataUnsafe?.user) return null;
  return app.initDataUnsafe.user;
}

/** بيانات موضوع تلجرام (ألوان) لتوحيد المظهر. */
export function getThemeParams() {
  const app = webApp();
  if (!app?.themeParams) return null;
  return app.themeParams;
}

/** هل الوضع ليلي؟ */
export function isDarkTheme() {
  const app = webApp();
  if (app?.colorScheme) return app.colorScheme === 'dark';
  return typeof window !== 'undefined'
    ? window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
    : false;
}

/** اهتزاز لمسي (صغير) عند نجاح/فشل العمليات. */
export function haptic(type = 'light') {
  const app = webApp();
  if (!app?.HapticFeedback) return;
  try {
    if (type === 'success' || type === 'error' || type === 'warning') {
      app.HapticFeedback.notificationOccurred(type);
    } else {
      app.HapticFeedback.impactOccurred(type);
    }
  } catch {
    // تجاهل
  }
}

/** نافذة تأكيد أصلية من تلجرام إن توفرت، وإلا window.confirm. */
export function showConfirm(message) {
  const app = webApp();
  if (app?.showConfirm) {
    return new Promise((resolve) => app.showConfirm(message, resolve));
  }
  return Promise.resolve(window.confirm(message));
}

/** تنبيه أصلي من تلجرام إن توفر. */
export function showAlert(message) {
  const app = webApp();
  if (app?.showAlert) {
    app.showAlert(message);
    return;
  }
  window.alert(message);
}

/** إغلاق التطبيق (زر رجوع). */
export function closeApp() {
  webApp()?.close?.();
}
