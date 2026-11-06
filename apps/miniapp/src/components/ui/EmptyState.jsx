import { Icon } from './icons.jsx';

/**
 * حالة فارغة موحّدة.
 *
 * تدعم أيقونة Lucide (المسار الموصى به) أو إيموجي كتوافق خلفي للنداءات القديمة.
 * الشكل: قرص بلون التمييز الباهت + عنوان + وصف + إجراء اختياري.
 */
export function EmptyState({ icon, title, description, action }) {
  const isComponent = typeof icon === 'function' || (icon && icon.render);

  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden="true">
        {isComponent ? <Icon icon={icon} size={26} strokeWidth={1.8} /> : (icon ?? null)}
      </div>
      {title ? <h3 className="empty__title">{title}</h3> : null}
      {description ? <p className="empty__desc">{description}</p> : null}
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  );
}

/** هيكل تحميل لبطاقة — بديل موحّد عن نص "جارٍ التحميل". */
export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card skeleton-card" aria-hidden="true">
      <div className="skeleton" style={{ height: 14, width: '42%', marginBottom: 10 }} />
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="skeleton"
          style={{
            height: 11,
            width: `${92 - index * 16}%`,
            marginBottom: index === lines - 1 ? 0 : 8
          }}
        />
      ))}
    </div>
  );
}
