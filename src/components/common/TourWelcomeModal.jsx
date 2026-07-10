import { createPortal } from 'react-dom';
import './TourWelcomeModal.css';

export default function TourWelcomeModal({ show, roleLabel, onStart, onMaybeLater, onDontShowAgain }) {
  if (!show) return null;

  return createPortal(
    <div className="tour-welcome-backdrop" role="dialog" aria-modal="true" aria-labelledby="tour-welcome-title">
      <div className="tour-welcome-card">
        <h2 id="tour-welcome-title" className="h4 mb-2">Would you like a quick tour of SerbisyoToledo?</h2>
        <p className="text-muted mb-3">
          We can show a short walkthrough tailored for {roleLabel}.
        </p>

        <div className="d-flex flex-wrap gap-2 justify-content-end">
          <button type="button" className="btn btn-outline-secondary" onClick={onMaybeLater}>
            Maybe Later
          </button>
          <button type="button" className="btn btn-outline-danger" onClick={onDontShowAgain}>
            Don't Show Again
          </button>
          <button type="button" className="btn btn-primary" onClick={onStart}>
            Start Tour
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
