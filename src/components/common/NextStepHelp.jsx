import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './NextStepHelp.css';

export default function NextStepHelp({
  guidance,
  buttonLabel = 'Not sure what to do next?',
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef(null);
  const highlightTimerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => () => {
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
  }, []);

  if (!guidance) return null;

  const {
    title = 'What to do next',
    description = '',
    steps = [],
    actionLabel,
    actionTo,
    onAction,
    targetSelector,
  } = guidance;

  const handlePrimaryAction = () => {
    setOpen(false);

    if (typeof onAction === 'function') {
      onAction();
      return;
    }

    if (actionTo) {
      navigate(actionTo);
    }
  };

  const handleShowTarget = () => {
    if (!targetSelector) return;

    const target = document.querySelector(targetSelector);
    if (!target) return;

    document.querySelectorAll('.next-step-highlight').forEach((element) => {
      element.classList.remove('next-step-highlight');
    });

    setOpen(false);
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    window.setTimeout(() => {
      target.classList.add('next-step-highlight');

      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }

      highlightTimerRef.current = window.setTimeout(() => {
        target.classList.remove('next-step-highlight');
      }, 2600);
    }, 260);
  };

  return (
    <div className="next-step-help">
      <button
        type="button"
        className="next-step-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <i className="bi bi-question-circle" aria-hidden="true"></i>
        <span>{buttonLabel}</span>
      </button>

      {open && (
        <div
          className="next-step-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <section
            className="next-step-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="next-step-help-title"
          >
            <div className="next-step-dialog-header">
              <div>
                <h2 id="next-step-help-title">{title}</h2>
                {description && <p>{description}</p>}
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="next-step-close"
                onClick={() => setOpen(false)}
                aria-label="Close help"
              >
                <i className="bi bi-x-lg" aria-hidden="true"></i>
              </button>
            </div>

            {steps.length > 0 && (
              <ol className="next-step-list">
                {steps.map((step, index) => (
                  <li key={`${index}-${step}`}>
                    <span aria-hidden="true">{index + 1}</span>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
            )}

            <div className="next-step-actions">
              {targetSelector && (
                <button type="button" className="next-step-secondary" onClick={handleShowTarget}>
                  <i className="bi bi-cursor" aria-hidden="true"></i>
                  Show me
                </button>
              )}

              {(actionLabel && (actionTo || typeof onAction === 'function')) && (
                <button type="button" className="next-step-primary" onClick={handlePrimaryAction}>
                  {actionLabel}
                  <i className="bi bi-arrow-right" aria-hidden="true"></i>
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
