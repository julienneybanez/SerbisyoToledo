import { createElement } from 'react';

export default function PageContainer({
  as: component = 'div',
  className = '',
  children,
  ...props
}) {
  return createElement(component, { className: ['st-page-container', className].filter(Boolean).join(' '), ...props }, children);
}
