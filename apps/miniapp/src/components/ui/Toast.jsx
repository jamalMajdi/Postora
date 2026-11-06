import { useApp } from '../../context/AppContext.jsx';
import { Icon, TOAST_ICONS, X } from './icons.jsx';

/**
 * رسائل عابرة (نجاح/خطأ/معلومة) — بلا مكتبات خارجية.
 *
 * التفاصيل:
 *  - تُعرض أعلى الشاشة تحت الرأس مباشرة (لا تحجب شريط التنقل).
 *  - شريط تقدّم رفيع يوضّح الوقت المتبقي للإخفاء.
 *  - زر إغلاق حقيقي + منطقة نقر كاملة للإخفاء.
 *  - aria-live="polite" ليقرأها قارئ الشاشة دون مقاطعة.
 */
export function ToastStack() {
  const { toasts, dismissToast, TOAST_DURATION } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const variant = toast.variant || 'info';
        const ToastIcon = TOAST_ICONS[variant] || TOAST_ICONS.info;
        return (
          <div key={toast.id} className={`toast toast--${variant}`} role="alert">
            <span className="toast__icon" aria-hidden="true">
              <Icon icon={ToastIcon} size={17} strokeWidth={2.2} />
            </span>
            <span className="toast__message">{toast.message}</span>
            <button
              type="button"
              className="toast__close"
              onClick={() => dismissToast(toast.id)}
              aria-label="close"
            >
              <Icon icon={X} size={14} strokeWidth={2.4} />
            </button>
            <span
              className="toast__progress"
              style={{ animationDuration: `${TOAST_DURATION}ms` }}
              aria-hidden="true"
            />
          </div>
        );
      })}
    </div>
  );
}
