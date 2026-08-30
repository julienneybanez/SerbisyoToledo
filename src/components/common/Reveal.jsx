import { createElement, useEffect, useState } from 'react';

export default function Reveal({
  as = 'div',
  children,
  className = '',
  delay = 0,
  variant = 'up',
  ...rest
}) {
  const [element, setElement] = useState(null);
  const [isVisible, setIsVisible] = useState(() => (
    typeof window === 'undefined'
    || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    || !('IntersectionObserver' in window)
  ));

  useEffect(() => {
    if (!element || isVisible) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -8% 0px',
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [element, isVisible]);

  const classes = [
    'reveal',
    `reveal--${variant}`,
    isVisible ? 'is-visible' : '',
    className,
  ].filter(Boolean).join(' ');

  return createElement(
    as,
    {
      ...rest,
      ref: setElement,
      className: classes,
      style: {
        ...(rest.style || {}),
        '--reveal-delay': `${Math.max(0, delay)}ms`,
      },
    },
    children
  );
}
