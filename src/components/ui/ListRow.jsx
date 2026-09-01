import { createElement } from 'react';

export default function ListRow({ as: component = 'div', className = '', children, ...props }) {
  return createElement(
    component,
    { className: ['mock-listrow', className].filter(Boolean).join(' '), ...props },
    children,
  );
}
