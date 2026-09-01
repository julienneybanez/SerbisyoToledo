import { createElement } from 'react';

export default function SoftPanel({ as: component = 'section', className = '', children, ...props }) {
  return createElement(
    component,
    { className: ['mock-soft-panel', className].filter(Boolean).join(' '), ...props },
    children,
  );
}
