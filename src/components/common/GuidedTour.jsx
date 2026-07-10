import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import './GuidedTour.css';

export default function GuidedTour({ show, steps = [], onFinish, onSkip }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const currentStep = useMemo(() => steps[index], [steps, index]);

  useEffect(() => {
    if (!show) {
      setIndex(0);
      setTargetRect(null);
      return;
    }

    if (!currentStep) return;

    if (currentStep.route) {
      navigate(currentStep.route);
    }

    const timeout = setTimeout(() => {
      if (!currentStep.selector) {
        setTargetRect(null);
        return;
      }

      const element = document.querySelector(currentStep.selector);
      if (!element) {
        setTargetRect(null);
        return;
      }

      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);
    }, 150);

    return () => clearTimeout(timeout);
  }, [show, currentStep, navigate]);

  useEffect(() => {
    if (!show) return;

    const updateRect = () => {
      if (!currentStep?.selector) {
        setTargetRect(null);
        return;
      }

      const element = document.querySelector(currentStep.selector);
      if (!element) {
        setTargetRect(null);
        return;
      }

      setTargetRect(element.getBoundingClientRect());
    };

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [show, currentStep]);

  if (!show || !currentStep) return null;

  const isLast = index === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onFinish();
      return;
    }
    setIndex((prev) => prev + 1);
  };

  const handleBack = () => {
    setIndex((prev) => Math.max(prev - 1, 0));
  };

  return createPortal(
    <>
      <div className="guided-tour-overlay" aria-hidden="true"></div>

      {targetRect && (
        <div
          className="guided-tour-highlight"
          style={{
            top: `${targetRect.top + window.scrollY - 6}px`,
            left: `${targetRect.left + window.scrollX - 6}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
          }}
          aria-hidden="true"
        ></div>
      )}

      <div className="guided-tour-card" role="dialog" aria-modal="false" aria-labelledby="guided-tour-title">
        <div className="small text-muted mb-2">Step {index + 1} of {steps.length}</div>
        <h3 id="guided-tour-title" className="h5 mb-2">{currentStep.title}</h3>
        <p className="mb-3 text-muted">{currentStep.description}</p>
        {currentStep.selector && !targetRect && (
          <p className="small text-muted">Target element is not available on this screen. You can continue.</p>
        )}

        <div className="d-flex justify-content-between gap-2 mt-2">
          <button type="button" className="btn btn-outline-danger" onClick={onSkip}>
            Skip Tour
          </button>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={handleBack} disabled={index === 0}>
              Back
            </button>
            <button type="button" className="btn btn-primary" onClick={handleNext}>
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
