/** حالة فارغة موحدة. */
export function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden="true">
        {icon}
      </div>
      {title ? <h3 style={{ marginBottom: 'var(--space-2)' }}>{title}</h3> : null}
      {description ? <p className="note">{description}</p> : null}
      {action ? <div style={{ marginTop: 'var(--space-4)' }}>{action}</div> : null}
    </div>
  );
}
