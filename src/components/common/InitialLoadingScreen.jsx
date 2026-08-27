import logo from '../../assets/logo.png';
import './InitialLoadingScreen.css';

export default function InitialLoadingScreen() {
  return (
    <div
      className="initial-loading-screen"
      role="status"
      aria-live="polite"
      aria-label="Loading SerbisyoToledo"
    >
      <div className="initial-loading-content">
        <div className="initial-loading-brand" aria-hidden="true">
          <img
            src={logo}
            alt=""
            className="initial-loading-logo non-draggable-image"
            draggable="false"
          />
          <div className="initial-loading-copy">
            <div className="initial-loading-name">
              Serbisyo<span>Toledo</span>
            </div>
            <p className="initial-loading-tagline">Local services, made easier.</p>
          </div>
        </div>

        <div className="initial-loading-track" aria-hidden="true">
          <span className="initial-loading-bar" />
        </div>

        <span className="initial-loading-sr-only">Loading SerbisyoToledo</span>
      </div>
    </div>
  );
}
