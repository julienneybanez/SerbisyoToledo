export default function FormField({
  label,
  htmlFor,
  required = false,
  hint = '',
  error = '',
  className = '',
  children,
}) {
  return (
    <div className={['st-form-field', className].filter(Boolean).join(' ')}>
      {label && (
        <label className="st-form-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="st-form-required" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <div className="st-form-error" role="alert">{error}</div>
      ) : hint ? (
        <div className="st-form-hint">{hint}</div>
      ) : null}
    </div>
  );
}
