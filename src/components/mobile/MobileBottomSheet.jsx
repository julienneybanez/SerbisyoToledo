import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function MobileBottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  labelledBy,
  className = '',
}) {
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = sheetRef.current?.querySelectorAll(FOCUSABLE);
    focusables?.[0]?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const elements = sheetRef.current?.querySelectorAll(FOCUSABLE);
      if (!elements || elements.length === 0) {
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="mobile-sheet-overlay" onClick={onClose}>
      <section
        ref={sheetRef}
        className={`mobile-sheet ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mobile-sheet-handle" aria-hidden="true"></div>
        <header className="mobile-sheet-header">
          <h2 id={labelledBy} className="mobile-sheet-title">{title}</h2>
          <button type="button" className="mobile-sheet-close" onClick={onClose} aria-label="Close panel">
            <i className="bi bi-x-lg"></i>
          </button>
        </header>
        <div className="mobile-sheet-body">{children}</div>
        {footer ? <footer className="mobile-sheet-footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}
