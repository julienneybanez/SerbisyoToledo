import { createElement } from 'react';

export default function Surface({
  as: component = 'section',
  tone = 'default',
  className = '',
  children,
  ...props
}) {
  return createElement(
    component,
    {
      className: ['st-surface', `st-surface--${tone}`, className].filter(Boolean).join(' '),
      ...props,
    },
    children,
  );
}
