import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon, X } from './icons.jsx';

/**
 * ورقة سفلية (bottom sheet) — نمط تلجرام القياسي للنوافذ الفرعية.
 *
 * تحسينات هذه النسخة:
 *  - دخول/خروج بحركة (translateY + fade) عبر حالة CSS بسيطة.
 *  - حبس التركيز داخل الورقة + إعادة التركيز للعنصر السابق عند الإغلاق (a11y).
 *  - سحب لأسفل بمؤشر اللمس لإغلاق الورقة (gesture أصلي) — لا مكتبة.
 *  - مقبض علوي بصري (grabber) كما في iOS.
 */
export function Sheet({ open, title, onClose, children }) {
  const sheetRef = useRef(null);
  const lastFocused = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    lastFocused.current = document.activeElement;
    document.body.classList.add('ds-sheet-open');

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
        return;
      }
      // حبس التركيز
      if (event.key === 'Tab' && sheetRef.current) {
        const focusables = sheetRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKey);

    // تركيز أول عنصر قابل للتركيز داخل الورقة
    const timer = setTimeout(() => {
      const target = sheetRef.current?.querySelector(
        'input, textarea, select, button:not([data-sheet-close])'
      );
      target?.focus?.({ preventScroll: true });
    }, 60);

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.classList.remove('ds-sheet-open');
      clearTimeout(timer);
      lastFocused.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  /* سحب لأسفل للإغلاق */
  useEffect(() => {
    if (!open || !sheetRef.current) return undefined;
    const node = sheetRef.current;
    let startY = 0;
    let delta = 0;

    const onTouchStart = (event) => {
      startY = event.touches[0].clientY;
      delta = 0;
      node.style.transition = 'none';
    };

    const onTouchMove = (event) => {
      delta = Math.max(0, event.touches[0].clientY - startY);
      node.style.transform = `translateY(${delta}px)`;
    };

    const onTouchEnd = () => {
      node.style.transition = '';
      node.style.transform = '';
      if (delta > 110) onClose?.();
    };

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchmove', onTouchMove, { passive: true });
    node.addEventListener('touchend', onTouchEnd);
    return () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="sheet-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sheet__grabber" aria-hidden="true" />
        <div className="sheet__header">
          <h2 className="sheet__title">{title}</h2>
          <button
            type="button"
            className="btn btn--ghost btn--icon btn--sm"
            onClick={onClose}
            data-sheet-close
            aria-label="close"
          >
            <Icon icon={X} size={17} strokeWidth={2.2} />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
