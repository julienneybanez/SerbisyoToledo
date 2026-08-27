export default function EmptyState({
  icon = null,
  title,
  description = '',
  action = null,
  className = '',
}) {
  return (
    <div className={['st-empty-state', className].filter(Boolean).join(' ')}>
      {icon}
      {title && <h3 className="st-empty-state-title">{title}</h3>}
      {description && <p className="st-empty-state-description">{description}</p>}
      {action}
    </div>
  );
}
