export default function StatCard({ as: Component = 'div', label, value, icon, className = '', children, ...props }) {
  return (
    <Component className={['mock-card', 'mock-stat', className].filter(Boolean).join(' ')} {...props}>
      {icon && <span className="mock-stat-icon" aria-hidden="true">{icon}</span>}
      <small>{label}</small>
      <strong>{value}</strong>
      {children}
    </Component>
  );
}
