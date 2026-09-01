export default function SoftPanel({ as: Component = 'section', className = '', children, ...props }) {
  return (
    <Component className={['mock-soft-panel', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </Component>
  );
}
