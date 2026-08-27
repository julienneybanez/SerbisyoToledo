export default function PageHeader({
  title,
  subtitle,
  action = null,
  className = '',
  titleClassName = '',
  subtitleClassName = '',
}) {
  return (
    <div className={['st-page-header', className].filter(Boolean).join(' ')}>
      <div className="st-page-header-copy">
        <h1 className={['st-page-title', titleClassName].filter(Boolean).join(' ')}>{title}</h1>
        {subtitle && (
          <p className={['st-page-subtitle', subtitleClassName].filter(Boolean).join(' ')}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="st-page-header-action">{action}</div>}
    </div>
  );
}
