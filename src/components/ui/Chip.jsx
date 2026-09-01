export default function Chip({ active = false, className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={['mock-chip', active ? 'active' : '', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
