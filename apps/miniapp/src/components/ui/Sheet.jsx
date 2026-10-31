import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * ورقة سفلية (bottom sheet) — نمط تلجرام القياسي للنوافذ الفرعية.
 * تُرسم في body عبر portal مع دعم الإغلاق بالمفتاح Escape.
 */
export function Sheet({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
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
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row row--between" style={{ marginBottom: 'var(--space-3)' }}>
          <h2 className="sheet__title" style={{ margin: 0 }}>
            {title}
          </h2>
          <button type="button" className="btn btn--sm btn--ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
