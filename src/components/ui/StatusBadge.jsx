export default function StatusBadge({
  tone = 'pending',
  className = '',
  children,
  ...props
}) {
  return (
    <span
      className={['st-status-badge', `st-status-badge--${tone}`, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </span>
  );
}
