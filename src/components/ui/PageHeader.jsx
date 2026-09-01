export default function PageHeader({
  title,
  subtitle,
  action = null,
  className = '',
  titleClassName = '',
  subtitleClassName = '',
}) {
  return (
    <div className={['st-page-header', 'mock-pagehead', className].filter(Boolean).join(' ')}>
      <div className="st-page-header-copy mock-pagehead-copy">
        <h1 className={['st-page-title', 'mock-page-title', titleClassName].filter(Boolean).join(' ')}>{title}</h1>
        {subtitle && (
          <p className={['st-page-subtitle', 'mock-page-subtitle', subtitleClassName].filter(Boolean).join(' ')}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="st-page-header-action mock-page-actions">{action}</div>}
    </div>
  );
}
