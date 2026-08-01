export default function MobileStickyAction({ leftContent, children, className = '' }) {
  return (
    <div className={`mobile-sticky-action ${className}`.trim()}>
      <div className="mobile-sticky-action-left">{leftContent}</div>
      <div className="mobile-sticky-action-right">{children}</div>
    </div>
  );
}
