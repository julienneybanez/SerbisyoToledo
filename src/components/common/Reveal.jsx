import { createElement, useEffect, useRef, useState } from 'react';

export default function Reveal({
  as = 'div',
  children,
  className = '',
  delay = 0,
  variant = 'up',
  ...rest
}) {
  const elementRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = elementRef.current;
    if (!node) return undefined;

    if (typeof window === 'undefined') {
      setIsVisible(true);
      return undefined;
    }

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return undefined;
    }

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

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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
      ref: elementRef,
      className: classes,
      style: {
        ...(rest.style || {}),
        '--reveal-delay': `${Math.max(0, delay)}ms`,
      },
    },
    children
  );
}
