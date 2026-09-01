export default function StatusBadge({
  tone = 'pending',
  className = '',
  children,
  ...props
}) {
  return (
    <span
      className={['st-status-badge', 'mock-status', `st-status-badge--${tone}`, `mock-status--${tone}`, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </span>
  );
}
