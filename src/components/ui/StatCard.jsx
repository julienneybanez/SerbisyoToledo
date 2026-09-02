import { createElement } from 'react';

export default function StatCard({
  as: component = 'div',
  label,
  value,
  icon,
  className = '',
  children,
  ...props
}) {
  return createElement(
    component,
    { className: ['mock-card', 'mock-stat', className].filter(Boolean).join(' '), ...props },
    <>
      {icon && <span className="mock-stat-icon" aria-hidden="true">{icon}</span>}
      <span className="mock-stat-copy">
        <small>{label}</small>
        <strong>{value}</strong>
        {children}
      </span>
    </>,
  );
}
