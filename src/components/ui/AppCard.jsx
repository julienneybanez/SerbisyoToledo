import { createElement } from 'react';

export default function AppCard({
  as: component = 'div',
  flat = false,
  interactive = false,
  className = '',
  children,
  ...props
}) {
  const classes = [
    'st-card',
    'mock-card',
    flat ? 'st-card--flat mock-card--flat' : '',
    interactive ? 'st-card--interactive mock-card--interactive' : '',
    className,
  ].filter(Boolean).join(' ');

  return createElement(component, { className: classes, ...props }, children);
}
